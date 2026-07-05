import * as vscode from 'vscode';
import { ConfigService } from '../services/ConfigService';
import { PRInfo, ChangedFile, ReviewResult, Repository } from '../types';
import { Logger, formatError } from '../utils/logger';

const SOURCE = 'GitHub';

export class GitHubService {
    private configService: ConfigService;
    private baseUrl = 'https://api.github.com';

    constructor(configService: ConfigService) {
        this.configService = configService;
    }

    private getHeaders(): Record<string, string> {
        const token = this.configService.getGithubToken();
        if (!token) {
            throw new Error('GitHub token not configured. Set repovisor.githubToken in settings.');
        }
        return {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Repovisor-VSCode/1.0'
        };
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
        logger.info(SOURCE, `Fetching PR info for ${repo}#${prNumber}`);

        const [owner, repoName] = repo.split('/');
        if (!owner || !repoName) {
            throw new Error('Invalid repo format. Use owner/repo');
        }

        const prResponse = await this.fetch(
            `${this.baseUrl}/repos/${owner}/${repoName}/pulls/${prNumber}`
        );

        if (!prResponse.ok) {
            if (prResponse.status === 404) {
                throw new Error(`[${SOURCE}] PR #${prNumber} not found in ${repo}`);
            }
            const errorBody = await prResponse.text();
            logger.error(SOURCE, `Failed to fetch PR #${prNumber} in ${repo}`, errorBody);
            throw new Error(`[${SOURCE}] API error (${prResponse.status}): ${errorBody}`);
        }

        const prData = await prResponse.json() as any;

        const diffResponse = await this.fetch(
            `${this.baseUrl}/repos/${owner}/${repoName}/pulls/${prNumber}`,
            {
                headers: {
                    'Accept': 'application/vnd.github.v3.diff'
                }
            }
        );

        const diffContent = diffResponse.ok ? await diffResponse.text() : '';

        const filesResponse = await this.fetch(
            `${this.baseUrl}/repos/${owner}/${repoName}/pulls/${prNumber}/files`
        );

        const filesData = filesResponse.ok ? await filesResponse.json() as any[] : [];
        const changedFiles: ChangedFile[] = filesData.map((f: any) => ({
            filename: f.filename,
            status: f.status,
            additions: f.additions,
            deletions: f.deletions,
            patch: f.patch || '',
            previousFilename: f.previous_filename
        }));

        return {
            number: prData.number,
            title: prData.title,
            state: prData.state,
            branch: prData.head.ref,
            author: prData.user.login,
            htmlUrl: prData.html_url,
            diffContent,
            changedFiles
        };
    }

    async getOpenPRs(repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<PRInfo[]> {
        const [owner, repoName] = repo.split('/');
        if (!owner || !repoName) {
            throw new Error('Invalid repo format. Use owner/repo');
        }

        const response = await this.fetch(
            `${this.baseUrl}/repos/${owner}/${repoName}/pulls?state=${state}&per_page=30`
        );

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`[${SOURCE}] API error (${response.status}): ${errorBody}`);
        }

        const data = await response.json() as any[];
        return data.map((pr: any) => ({
            number: pr.number,
            title: pr.title,
            state: pr.state,
            branch: pr.head.ref,
            author: pr.user.login,
            htmlUrl: pr.html_url,
            diffContent: '',
            changedFiles: []
        }));
    }

    async postReview(repo: string, prNumber: number, result: ReviewResult): Promise<void> {
        const logger = Logger.getInstance();
        logger.info(SOURCE, `Posting review to ${repo}#${prNumber}`);

        const [owner, repoName] = repo.split('/');
        const body = this.buildReviewBody(result);

        // Post the review body first (without inline comments) so it always succeeds
        const reviewResponse = await this.fetch(
            `${this.baseUrl}/repos/${owner}/${repoName}/pulls/${prNumber}/reviews`,
            {
                method: 'POST',
                body: JSON.stringify({
                    body,
                    event: result.riskLevel === 'critical' ? 'REQUEST_CHANGES' : 'COMMENT'
                })
            }
        );

        if (!reviewResponse.ok) {
            const error = await reviewResponse.text();
            logger.error(SOURCE, `Failed to post review body to ${repo}#${prNumber}`, error);
            throw new Error(`[${SOURCE}] Failed to post review: ${error}`);
        }

        // Fetch the PR head commit SHA for posting individual line comments
        const prResponse = await this.fetch(
            `${this.baseUrl}/repos/${owner}/${repoName}/pulls/${prNumber}`
        );

        if (!prResponse.ok) {
            logger.warn(SOURCE, `Could not fetch PR head SHA for ${repo}#${prNumber}, skipping inline comments`);
            return;
        }

        const prData = await prResponse.json() as any;
        const headSha = prData.head?.sha as string | undefined;

        if (!headSha) {
            logger.warn(SOURCE, `PR head SHA not available for ${repo}#${prNumber}, skipping inline comments`);
            return;
        }

        // Post each finding as a separate PR comment; skip those that fail (e.g. line not in diff)
        let postedCount = 0;
        let failedCount = 0;

        for (const finding of result.findings) {
            try {
                const commentResponse = await this.fetch(
                    `${this.baseUrl}/repos/${owner}/${repoName}/pulls/${prNumber}/comments`,
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            body: `**[${finding.severity.toUpperCase()}] ${finding.category}**\n\n${finding.message}\n\n**Suggestion:** ${finding.suggestion}`,
                            commit_id: headSha,
                            path: finding.filePath,
                            line: finding.lineStart,
                            side: 'RIGHT'
                        })
                    }
                );

                if (!commentResponse.ok) {
                    const commentError = await commentResponse.text();
                    logger.warn(SOURCE, `Failed to post comment on ${finding.filePath}:${finding.lineStart}`, commentError);
                    failedCount++;
                } else {
                    postedCount++;
                }
            } catch (error) {
                logger.warn(SOURCE, `Error posting comment on ${finding.filePath}:${finding.lineStart}`, error);
                failedCount++;
            }
        }

        logger.info(SOURCE, `Posted ${postedCount} inline comments, ${failedCount} failed for ${repo}#${prNumber}`);
    }

    async getRepository(repo: string): Promise<Repository> {
        const [owner, repoName] = repo.split('/');
        const response = await this.fetch(
            `${this.baseUrl}/repos/${owner}/${repoName}`
        );

        if (!response.ok) {
            throw new Error(`[${SOURCE}] Repository not found: ${repo}`);
        }

        const data = await response.json() as any;
        return {
            id: data.id,
            fullName: data.full_name,
            cloneUrl: data.clone_url,
            platform: 'github',
            defaultBranch: data.default_branch,
            stars: data.stargazers_count
        };
    }

    async checkHealth(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; latency: number }> {
        const start = Date.now();
        try {
            const response = await this.fetch(`${this.baseUrl}/rate_limit`);
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
