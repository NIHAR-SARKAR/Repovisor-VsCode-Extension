export interface AIProvider {
    alias: string;
    name: string;
    apiKey: string;
    baseUrl: string;
    defaultModel: string;
    enabled: boolean;
    health?: ProviderHealth;
    endpoint?: string;
    deployment?: string;
    apiVersion?: string;
    useBearerAuth?: boolean;
    customHeaders?: Record<string, string>;
    reasoningEffort?: 'low' | 'medium' | 'high';
    supportsCustomEndpoint?: boolean;
}

export interface ProviderHealth {
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency: number;
    lastChecked: Date;
    error?: string;
}

export interface ReviewConfig {
    provider?: string;
    profile: ReviewProfile;
    model?: string;
    autoPost?: boolean;
    customRules?: CustomRule[];
}

export type ReviewProfile = 'fast' | 'standard' | 'deep';

export interface ReviewResult {
    id: string;
    repo?: string;
    prNumber?: number;
    platform?: 'github' | 'gitlab';
    providerUsed: string;
    modelUsed: string;
    summary: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    findings: Finding[];
    rulesTriggered: RuleResult[];
    timestamp: Date;
    duration: number;
}

export interface Finding {
    id: string;
    category: 'code_quality' | 'performance' | 'security' | 'reliability' | 'maintainability';
    severity: 'critical' | 'high' | 'medium' | 'low';
    filePath: string;
    lineStart: number;
    lineEnd: number;
    message: string;
    suggestion: string;
    codeSnippet: string;
    confidence: number;
}

export interface RuleResult {
    ruleName: string;
    ruleType: string;
    severity: string;
    matched: boolean;
    matches?: string[];
}

export interface CustomRule {
    id: string;
    name: string;
    description: string;
    ruleType: 'regex' | 'file_presence' | 'ast';
    config: RuleConfig;
    enabled: boolean;
    severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface RuleConfig {
    pattern?: string;
    message?: string;
    suggestion?: string;
    files?: string[];
    [key: string]: any;
}

export interface PRInfo {
    number: number;
    title: string;
    state: string;
    branch: string;
    author: string;
    htmlUrl: string;
    diffContent: string;
    changedFiles: ChangedFile[];
}

export interface ChangedFile {
    filename: string;
    status: 'added' | 'removed' | 'modified' | 'renamed';
    additions: number;
    deletions: number;
    patch: string;
    previousFilename?: string;
}

export interface Repository {
    id: number;
    fullName: string;
    cloneUrl: string;
    platform: 'github' | 'gitlab';
    defaultBranch: string;
    stars: number;
}

export interface ReviewHistory {
    reviews: ReviewResult[];
    total: number;
    page: number;
    perPage: number;
}

export interface DiffHunk {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: DiffLine[];
}

export interface DiffLine {
    type: 'context' | 'addition' | 'deletion';
    content: string;
    oldLineNumber?: number;
    newLineNumber?: number;
}

export interface PlatformConfig {
    type: 'github' | 'gitlab';
    token: string;
    baseUrl?: string;
}

export interface ModelConfig {
    reasoningEffort?: 'low' | 'medium' | 'high';
    contextWindow?: string;
    inputPricing?: string;
    outputPricing?: string;
    useDifferentModelsForModes?: boolean;
}
