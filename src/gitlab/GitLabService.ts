import * as vscode from 'vscode';
import { ConfigService } from '../services/ConfigService';
import { PRInfo, ChangedFile, ReviewResult, Repository } from '../types';
import { Logger, formatError } from '../utils/logger';

const SOURCE = 'GitLab';

export class GitLabService {
    private configService: ConfigService;

    constructor(configService: ConfigService) {
        this.configService = configService;
    }

    private getBaseUrl(): string {
        return this.configService.getGitlabUrl().replace(/\/$/, '');
    }

    private getHeaders(): Record<string, string> {
        const token = this.configService.getGitlabToken();
        if (!token) {
            throw new Error('GitLab token not configured. Set repovisor.gitlabToken in settings.');
        }
        return {
            'PRIVATE-TOKEN': token,
            'Content-Type': 'application/json'
        };
    }

    private encodePath(repo: string): string {
        return encodeURIComponent(repo);
    }

    private async fetch(url: string, options?: RequestInit): Promise<Response> {
        const logger = Logger.getInstance();
        logger.debug(SOURCE, `Request: ${options?.method || 'GET'} ${url}`);
        try {
            const response = await fetch(url, { ...options, headers: { ...this.getHeaders(), ...(options?.headers || {}) } });
            logger.debug(SOURCE, `Response: ${response.status}`);
            return response;
        } catch (error) {
            logger.error(SOURCE, `Network request failed for ${url}`, error);
            throw new Error(formatError(SOURCE, error));
        }
    }

    async getPRInfo(repo: string, prNumber: number): Promise<PRInfo> {
        const logger = Logger.getInstance();
        logger.info(SOURCE, `Fetching MR info for ${repo}!${prNumber}`);

        const baseUrl = this.getBaseUrl();
        const encodedRepo = this.encodePath(repo);

        const mrResponse = await this.fetch(
            `${baseUrl}/api/v4/projects/${encodedRepo}/merge_requests/${prNumber}`
        );

        if (!mrResponse.ok) {
            if (mrResponse.status === 404) {
                throw new Error(`[${SOURCE}] MR !${prNumber} not found in ${repo}`);
            }
            const errorBody = await mrResponse.text();
            logger.error(SOURCE, `Failed to fetch MR !${prNumber} in ${repo}`, errorBody);
            throw new Error(`[${SOURCE}] API error (${mrResponse.status}): ${errorBody}`);
        }

        const mrData = await mrResponse.json() as any;

        const diffResponse = await this.fetch(
            `${baseUrl}/api/v4/projects/${encodedRepo}/merge_requests/${prNumber}/changes`
        );

        const diffData = diffResponse.ok ? await diffResponse.json() as any : { changes: [] };

        let diffContent = '';
        const changedFiles: ChangedFile[] = (diffData.changes || []).map((change: any) => {
            diffContent += `diff --git a/${change.old_path} b/${change.new_path}\n`;
            diffContent += change.diff || '';

            return {
                filename: change.new_path,
                status: change.new_file ? 'added' : change.deleted_file ? 'removed' : change.renamed_file ? 'renamed' : 'modified',
                additions: change.additions || 0,
                deletions: change.deletions || 0,
                patch: change.diff || '',
                previousFilename: change.old_path !== change.new_path ? change.old_path : undefined
            };
        });

        return {
            number: mrData.iid,
            title: mrData.title,
            state: mrData.state,
            branch: mrData.source_branch,
            author: mrData.author?.username || 'unknown',
            htmlUrl: mrData.web_url,
            diffContent,
            changedFiles
        };
    }

    async getOpenPRs(repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<PRInfo[]> {
        const baseUrl = this.getBaseUrl();
        const encodedRepo = this.encodePath(repo);
        const stateMap = { open: 'opened', closed: 'closed', all: 'all' };

        const response = await this.fetch(
            `${baseUrl}/api/v4/projects/${encodedRepo}/merge_requests?state=${stateMap[state]}&per_page=30`
        );

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`[${SOURCE}] API error (${response.status}): ${errorBody}`);
        }

        const data = await response.json() as any[];
        return data.map((mr: any) => ({
            number: mr.iid,
            title: mr.title,
            state: mr.state,
            branch: mr.source_branch,
            author: mr.author?.username || 'unknown',
            htmlUrl: mr.web_url,
            diffContent: '',
            changedFiles: []
        }));
    }

    async postReview(repo: string, prNumber: number, result: ReviewResult): Promise<void> {
        const logger = Logger.getInstance();
        logger.info(SOURCE, `Posting review to ${repo}!${prNumber}`);

        const baseUrl = this.getBaseUrl();
        const encodedRepo = this.encodePath(repo);
        const body = this.buildReviewBody(result);

        const response = await this.fetch(
            `${baseUrl}/api/v4/projects/${encodedRepo}/merge_requests/${prNumber}/discussions`,
            {
                method: 'POST',
                body: JSON.stringify({ body })
            }
        );

        if (!response.ok) {
            const error = await response.text();
            logger.error(SOURCE, `Failed to post review to ${repo}!${prNumber}`, error);
            throw new Error(`[${SOURCE}] Failed to post review: ${error}`);
        }

        for (const finding of result.findings) {
            try {
                await this.fetch(
                    `${baseUrl}/api/v4/projects/${encodedRepo}/merge_requests/${prNumber}/discussions`,
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            body: `**[${finding.severity.toUpperCase()}] ${finding.category}**\n\n${finding.message}\n\n**Suggestion:** ${finding.suggestion}`,
                            position: {
                                base_sha: 'HEAD',
                                head_sha: 'HEAD',
                                start_sha: 'HEAD',
                                position_type: 'text',
                                new_path: finding.filePath,
                                new_line: finding.lineStart
                            }
                        })
                    }
                );
            } catch (e) {
                logger.error(SOURCE, `Failed to post inline comment for ${finding.filePath}:${finding.lineStart}`, e);
            }
        }
    }

    async getRepository(repo: string): Promise<Repository> {
        const baseUrl = this.getBaseUrl();
        const encodedRepo = this.encodePath(repo);

        const response = await this.fetch(
            `${baseUrl}/api/v4/projects/${encodedRepo}`
        );

        if (!response.ok) {
            throw new Error(`[${SOURCE}] Repository not found: ${repo}`);
        }

        const data = await response.json() as any;
        return {
            id: data.id,
            fullName: data.path_with_namespace,
            cloneUrl: data.http_url_to_repo,
            platform: 'gitlab',
            defaultBranch: data.default_branch,
            stars: data.star_count
        };
    }

    async checkHealth(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; latency: number }> {
        const start = Date.now();
        try {
            const response = await this.fetch(`${this.getBaseUrl()}/api/v4/version`);
            const latency = Date.now() - start;
            return {
                status: response.ok ? 'healthy' : 'degraded',
                latency
            };
        } catch (error) {
            Logger.getInstance().error(SOURCE, 'Health check failed', error);
            return { status: 'unhealthy', latency: Date.now() - start };
        }
    }

    private buildReviewBody(result: ReviewResult): string {
        const emoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
        const severityLabels: Record<string, string> = {
            critical: '**🔴 Critical**',
            high: '**🟠 High**',
            medium: '**🟡 Medium**',
            low: '**🟢 Low**'
        };
        const categoryLabels: Record<string, string> = {
            code_quality: 'Code Quality',
            performance: 'Performance',
            security: 'Security',
            reliability: 'Reliability',
            maintainability: 'Maintainability'
        };

        const counts = result.findings.reduce((acc, f) => {
            acc[f.severity] = (acc[f.severity] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        // Group findings by file
        const byFile = result.findings.reduce((acc, f) => {
            if (!acc[f.filePath]) { acc[f.filePath] = []; }
            acc[f.filePath].push(f);
            return acc;
        }, {} as Record<string, typeof result.findings>);

        let body = `## <img src="https://aithread.in/assets/repovisor.png" width="25" alt="Repovisor AI Review" /> **Repovisor AI Review**\n\n`;
        body += `**Provider:** ${result.providerUsed} (${result.modelUsed})\n`;
        body += `**Duration:** ${(result.duration / 1000).toFixed(1)}s\n`;
        body += `**Risk Level:** ${emoji[result.riskLevel]} ${result.riskLevel.toUpperCase()}\n\n`;

        body += `### Overall Summary\n`;
        body += `- ${counts.critical || 0} Critical\n`;
        body += `- ${counts.high || 0} High\n`;
        body += `- ${counts.medium || 0} Medium\n`;
        body += `- ${counts.low || 0} Low\n`;
        body += `- **${result.findings.length}** total issue(s) across **${Object.keys(byFile).length}** file(s)\n\n`;

        if (result.findings.length > 0) {
            body += `### Findings by File\n`;
            for (const [filePath, findings] of Object.entries(byFile)) {
                const fileCounts = findings.reduce((acc, f) => {
                    acc[f.severity] = (acc[f.severity] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);

                const fileSummary = Object.entries(fileCounts)
                    .map(([sev, count]) => `${count} ${sev}`)
                    .join(', ');

                body += `<details>\n<summary><strong>${filePath}</strong> — ${fileSummary}</summary>\n\n`;
                findings.forEach((f, i) => {
                    body += `${i + 1}. ${severityLabels[f.severity]} | ${categoryLabels[f.category] || f.category} | line ${f.lineStart}\n`;
                    body += `   > ${f.message}\n`;
                    if (f.suggestion) {
                        body += `   > 💡 **Suggestion:** ${f.suggestion}\n`;
                    }
                    body += `\n`;
                });
                body += `</details>\n\n`;
            }
        }

        body += `---\n*Reviewed by Repovisor AI VS Code Extension*`;
        return body;
    }
}
