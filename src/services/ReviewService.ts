import * as vscode from 'vscode';
import { ConfigService } from './ConfigService';
import { IHistoryService } from './HistoryService';
import { GitHubService } from '../github/GitHubService';
import { GitLabService } from '../gitlab/GitLabService';
import { 
    ReviewResult, Finding, ReviewConfig, AIProvider, 
    PRInfo, ChangedFile, CustomRule, RuleResult, ReviewProfile, ReviewHistory
} from '../types';
import { OpenAIProvider } from '../providers/OpenAIProvider';
import { AnthropicProvider } from '../providers/AnthropicProvider';
import { MoonshotProvider } from '../providers/MoonshotProvider';
import { DeepSeekProvider } from '../providers/DeepSeekProvider';
import { AzureProvider } from '../providers/AzureProvider';
import { RuleEngine } from '../rules/RuleEngine';
import { v4 as uuidv4 } from '../utils/uuid';
import { Logger } from '../utils/logger';

export class ReviewService {
    private configService: ConfigService;
    private historyService: IHistoryService;
    private githubService: GitHubService;
    private gitlabService: GitLabService;
    private ruleEngine: RuleEngine;

    constructor(
        configService: ConfigService,
        historyService: IHistoryService,
        githubService: GitHubService,
        gitlabService: GitLabService
    ) {
        this.configService = configService;
        this.historyService = historyService;
        this.githubService = githubService;
        this.gitlabService = gitlabService;
        this.ruleEngine = new RuleEngine();
    }

    async reviewPullRequest(
        repo: string,
        prNumber: number,
        platform: 'github' | 'gitlab',
        config: ReviewConfig
    ): Promise<ReviewResult> {
        const logger = Logger.getInstance();
        const startTime = Date.now();
        logger.info('ReviewService', `Starting PR review for ${platform}:${repo}#${prNumber} with profile ${config.profile}`);

        let prInfo: PRInfo;
        try {
            if (platform === 'github') {
                prInfo = await this.githubService.getPRInfo(repo, prNumber);
            } else {
                prInfo = await this.gitlabService.getPRInfo(repo, prNumber);
            }
        } catch (error) {
            logger.error('ReviewService', `Failed to fetch PR info from ${platform}`, error);
            throw error;
        }

        const ruleResults = this.configService.getEnableRules() 
            ? this.ruleEngine.evaluate(prInfo.diffContent, prInfo.changedFiles)
            : [];

        const provider = this.getActiveProvider();
        logger.info('ReviewService', `Using AI provider ${provider.alias} (${provider.defaultModel})`);

        let aiFindings: Finding[];
        try {
            aiFindings = await this.runAIReview(provider, prInfo, config);
            logger.info('ReviewService', `AI review returned ${aiFindings.length} findings`);
        } catch (error) {
            logger.error('ReviewService', `AI review failed with provider ${provider.alias}`, error);
            throw error;
        }

        const ruleFindings = this.convertRuleResults(ruleResults, prInfo.changedFiles);
        const allFindings = [...aiFindings, ...ruleFindings];
        const uniqueFindings = this.deduplicateFindings(allFindings);

        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        uniqueFindings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

        const riskLevel = this.calculateRiskLevel(uniqueFindings);
        const summary = this.generateSummary(uniqueFindings, prInfo);

        const result: ReviewResult = {
            id: uuidv4(),
            repo,
            prNumber,
            platform,
            providerUsed: provider.alias,
            modelUsed: config.model || provider.defaultModel,
            summary,
            riskLevel,
            findings: uniqueFindings,
            rulesTriggered: ruleResults,
            timestamp: new Date(),
            duration: Date.now() - startTime
        };

        this.historyService.saveReview(result);
        logger.info('ReviewService', `Review completed in ${result.duration}ms with ${uniqueFindings.length} findings`);

        if (config.autoPost) {
            try {
                await this.postReview(result, repo, prNumber, platform);
                logger.info('ReviewService', `Review posted to ${platform}:${repo}#${prNumber}`);
            } catch (error) {
                logger.error('ReviewService', `Auto-post to ${platform} failed`, error);
            }
        }

        return result;
    }

    async reviewCode(
        code: string,
        fileName: string,
        config: ReviewConfig
    ): Promise<ReviewResult> {
        const logger = Logger.getInstance();
        const startTime = Date.now();
        logger.info('ReviewService', `Starting code review for ${fileName} with profile ${config.profile}`);

        const ruleResults = this.configService.getEnableRules()
            ? this.ruleEngine.evaluate(code, [{ filename: fileName, status: 'modified', additions: 0, deletions: 0, patch: code }])
            : [];

        const provider = this.getActiveProvider();
        logger.info('ReviewService', `Using AI provider ${provider.alias} (${provider.defaultModel}) for file review`);
        const prompt = this.buildCodeReviewPrompt(code, fileName, config.profile);
        let response: string;
        try {
            response = await this.callAIProvider(provider, prompt);
        } catch (error) {
            logger.error('ReviewService', `AI review failed with provider ${provider.alias}`, error);
            throw error;
        }
        const aiFindings = this.parseAIResponse(response, fileName);

        const ruleFindings = this.convertRuleResults(ruleResults, [{ filename: fileName, status: 'modified', additions: 0, deletions: 0, patch: code }]);
        const allFindings = [...aiFindings, ...ruleFindings];
        const uniqueFindings = this.deduplicateFindings(allFindings);

        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        uniqueFindings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

        const riskLevel = this.calculateRiskLevel(uniqueFindings);
        const summary = this.generateCodeSummary(uniqueFindings, fileName);

        const result: ReviewResult = {
            id: uuidv4(),
            providerUsed: provider.alias,
            modelUsed: config.model || provider.defaultModel,
            summary,
            riskLevel,
            findings: uniqueFindings,
            rulesTriggered: ruleResults,
            timestamp: new Date(),
            duration: Date.now() - startTime
        };

        this.historyService.saveReview(result);
        logger.info('ReviewService', `File review completed in ${result.duration}ms with ${result.findings.length} findings`);
        return result;
    }

    async postReview(
        result: ReviewResult,
        repo: string,
        prNumber: number,
        platform: 'github' | 'gitlab'
    ): Promise<void> {
        if (platform === 'github') {
            await this.githubService.postReview(repo, prNumber, result);
        } else {
            await this.gitlabService.postReview(repo, prNumber, result);
        }
    }

    getReviewHistory(page: number = 1, perPage: number = 10, query?: string): ReviewHistory {
        return this.historyService.getHistory(page, perPage, query);
    }

    getReviewById(id: string): ReviewResult | undefined {
        return this.historyService.getReviewById(id);
    }

    clearHistory(): void {
        this.historyService.clearHistory();
    }

    private getActiveProvider(): AIProvider {
        const provider = this.configService.getActiveProvider();
        if (!provider) {
            throw new Error('No AI provider is active. Please configure a provider in the Repovisor settings.');
        }
        return provider;
    }

    private async runAIReview(
        provider: AIProvider,
        prInfo: PRInfo,
        config: ReviewConfig
    ): Promise<Finding[]> {
        const prompt = this.buildPRReviewPrompt(prInfo, config.profile);
        const response = await this.callAIProvider(provider, prompt);
        return this.parseAIResponse(response, prInfo.changedFiles);
    }

    private async callAIProvider(provider: AIProvider, prompt: string): Promise<string> {
        switch (provider.alias) {
            case 'openai':
            case 'openai-compatible':
                return new OpenAIProvider(provider).complete(prompt);
            case 'anthropic':
                return new AnthropicProvider(provider).complete(prompt);
            case 'moonshot':
                return new MoonshotProvider(provider).complete(prompt);
            case 'deepseek':
                return new DeepSeekProvider(provider).complete(prompt);
            case 'azure':
                return new AzureProvider(provider).complete(prompt);
            default:
                throw new Error(`Unsupported provider: ${provider.alias}`);
        }
    }

    private buildPRReviewPrompt(prInfo: PRInfo, profile: ReviewProfile): string {
        const maxFindings = profile === 'fast' ? 5 : profile === 'standard' ? 10 : 50;
        const depth = profile === 'fast' ? 'critical issues only' : profile === 'standard' ? 'security, performance, and quality' : 'exhaustive analysis including subtle issues';

        const filesSummary = prInfo.changedFiles.map(f => 
            `- ${f.filename} (${f.status}, +${f.additions}/-${f.deletions})`
        ).join('\n');

        return `You are an expert code reviewer. Review the following pull request and identify issues.

PR: ${prInfo.title}
Branch: ${prInfo.branch}

Changed files:
${filesSummary}

Diff content:
\`\`\`diff
${prInfo.diffContent.substring(0, 150000)}
\`\`\`

Review depth: ${depth}
Maximum findings: ${maxFindings}

Analyze the code for:
- Security vulnerabilities (SQL injection, XSS, path traversal, secrets exposure)
- Performance issues (inefficient algorithms, memory leaks, N+1 queries)
- Code quality (duplication, complexity, naming, comments)
- Reliability (error handling, edge cases, race conditions)
- Maintainability (test coverage, documentation, modularity)

Return your findings as a JSON array with this exact schema:
[
  {
    "category": "security|performance|code_quality|reliability|maintainability",
    "severity": "critical|high|medium|low",
    "file_path": "filename.ext",
    "line_start": 1,
    "line_end": 1,
    "message": "Clear description of the issue",
    "suggestion": "How to fix it",
    "code_snippet": "relevant code",
    "confidence": 0.95
  }
]

If no issues found, return an empty array []. Only return valid JSON, no markdown formatting.`;
    }

    private buildCodeReviewPrompt(code: string, fileName: string, profile: ReviewProfile): string {
        const maxFindings = profile === 'fast' ? 3 : profile === 'standard' ? 8 : 20;

        return `You are an expert code reviewer. Review the following code file and identify issues.

File: ${fileName}

\`\`\`${this.getLanguageFromFile(fileName)}
${code}
\`\`\`

Maximum findings: ${maxFindings}

Analyze for security, performance, code quality, reliability, and maintainability issues.

Return findings as JSON array:
[
  {
    "category": "security|performance|code_quality|reliability|maintainability",
    "severity": "critical|high|medium|low",
    "file_path": "${fileName}",
    "line_start": 1,
    "line_end": 1,
    "message": "description",
    "suggestion": "fix suggestion",
    "code_snippet": "relevant code",
    "confidence": 0.95
  }
]

Return [] if no issues. Valid JSON only, no markdown.`;
    }

    private parseAIResponse(response: string, files: ChangedFile[] | string): Finding[] {
        try {
            let cleaned = response.trim();
            if (cleaned.startsWith('\`\`\`json')) {
                cleaned = cleaned.slice(7);
            }
            if (cleaned.startsWith('\`\`\`')) {
                cleaned = cleaned.slice(3);
            }
            if (cleaned.endsWith('\`\`\`')) {
                cleaned = cleaned.slice(0, -3);
            }
            cleaned = cleaned.trim();

            const parsed = JSON.parse(cleaned);
            if (!Array.isArray(parsed)) {
                return [];
            }

            return parsed.map((item: any, index: number) => ({
                id: uuidv4(),
                category: item.category || 'code_quality',
                severity: item.severity || 'medium',
                filePath: item.file_path || (typeof files === 'string' ? files : files[0]?.filename || 'unknown'),
                lineStart: item.line_start || 1,
                lineEnd: item.line_end || item.line_start || 1,
                message: item.message || 'Unknown issue',
                suggestion: item.suggestion || 'No suggestion provided',
                codeSnippet: item.code_snippet || '',
                confidence: Math.min(Math.max(item.confidence || 0.5, 0), 1)
            }));
        } catch (error) {
            Logger.getInstance().error('ReviewService', 'Failed to parse AI response', error);
            Logger.getInstance().debug('ReviewService', `Raw response: ${response.substring(0, 1000)}`);
            return [];
        }
    }

    private convertRuleResults(ruleResults: RuleResult[], files: ChangedFile[]): Finding[] {
        return ruleResults
            .filter(r => r.matched)
            .map((r, index) => ({
                id: uuidv4(),
                category: 'security' as const,
                severity: r.severity as 'critical' | 'high' | 'medium' | 'low',
                filePath: files[0]?.filename || 'unknown',
                lineStart: 1,
                lineEnd: 1,
                message: `${r.ruleName}: ${r.matches?.join(', ') || 'Rule matched'}`,
                suggestion: 'Review and fix the flagged issue',
                codeSnippet: r.matches?.[0] || '',
                confidence: 1.0
            }));
    }

    private deduplicateFindings(findings: Finding[]): Finding[] {
        const seen = new Set<string>();
        return findings.filter(f => {
            const key = `${f.filePath}:${f.lineStart}:${f.message}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    private calculateRiskLevel(findings: Finding[]): 'low' | 'medium' | 'high' | 'critical' {
        if (findings.some(f => f.severity === 'critical')) return 'critical';
        if (findings.some(f => f.severity === 'high')) return 'high';
        if (findings.some(f => f.severity === 'medium')) return 'medium';
        return 'low';
    }

    private generateSummary(findings: Finding[], prInfo: PRInfo): string {
        const counts = findings.reduce((acc, f) => {
            acc[f.severity] = (acc[f.severity] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const parts = [];
        if (counts.critical) parts.push(`${counts.critical} critical`);
        if (counts.high) parts.push(`${counts.high} high`);
        if (counts.medium) parts.push(`${counts.medium} medium`);
        if (counts.low) parts.push(`${counts.low} low`);

        return `Reviewed PR #${prInfo.number}: ${parts.join(', ') || 'no'} issues found across ${prInfo.changedFiles.length} files.`;
    }

    private generateCodeSummary(findings: Finding[], fileName: string): string {
        const counts = findings.reduce((acc, f) => {
            acc[f.severity] = (acc[f.severity] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const parts = [];
        if (counts.critical) parts.push(`${counts.critical} critical`);
        if (counts.high) parts.push(`${counts.high} high`);
        if (counts.medium) parts.push(`${counts.medium} medium`);
        if (counts.low) parts.push(`${counts.low} low`);

        return `Reviewed ${fileName}: ${parts.join(', ') || 'no'} issues found.`;
    }

    private getLanguageFromFile(fileName: string): string {
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        const langMap: Record<string, string> = {
            'js': 'javascript', 'ts': 'typescript', 'jsx': 'jsx', 'tsx': 'tsx',
            'py': 'python', 'java': 'java', 'go': 'go', 'rs': 'rust',
            'cpp': 'cpp', 'c': 'c', 'cs': 'csharp', 'rb': 'ruby',
            'php': 'php', 'swift': 'swift', 'kt': 'kotlin', 'scala': 'scala',
            'html': 'html', 'css': 'css', 'scss': 'scss', 'sql': 'sql',
            'sh': 'bash', 'yml': 'yaml', 'yaml': 'yaml', 'json': 'json',
            'md': 'markdown', 'dockerfile': 'dockerfile'
        };
        return langMap[ext] || '';
    }
}
