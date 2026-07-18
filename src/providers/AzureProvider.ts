import { BaseProvider } from './BaseProvider';
import { AIProvider } from '../types';
import { Logger } from '../utils/logger';

/**
 * Azure OpenAI provider implementation with comprehensive multi-model support.
 *
 * Ported from a Python reference implementation that used raw HTTP calls
 * (instead of the openai SDK) to support ALL Azure-hosted model families
 * including legacy, v1, Responses API, and Azure AI Foundry endpoints.
 *
 * Supported families:
 * - OpenAI GPT-5.x series (5.1, 5.2, 5.3, 5.4, 5.5, codex, chat, pro, mini, nano)
 * - OpenAI o-series reasoning (o1, o1-mini, o3, o3-mini, o3-pro, o4, o4-mini)
 * - OpenAI GPT-4.x series (4, 4o, 4o-mini, 4.1, 4.1-mini, 4.1-nano)
 * - Non-OpenAI via Azure AI Foundry: DeepSeek, Meta Llama, Mistral, Cohere, Phi,
 *   NVIDIA Nemotron, Grok, Kimi, Jamba, MiniMax, gpt-oss, and others.
 */

export enum AzureAPIPattern {
    AZURE_OPENAI_LEGACY = 'azure_openai_legacy',
    AZURE_OPENAI_V1 = 'azure_openai_v1',
    AZURE_RESPONSES = 'azure_responses',
    AZURE_AI_FOUNDRY = 'azure_ai_foundry',
}

export interface ModelFamilyConfig {
    family: string;
    supportedPatterns: AzureAPIPattern[];
    defaultPattern: AzureAPIPattern;
    prefersDeveloperRole?: boolean;
    usesMaxCompletionTokens?: boolean;
    supportsReasoningEffort?: boolean;
    supportsTemperature?: boolean;
}

export interface ChatMessage {
    role: string;
    content: string;
}

export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
}

// Sensible default: everything supports temperature unless overridden below.
function makeConfig(
    family: string,
    supportedPatterns: AzureAPIPattern[],
    defaultPattern: AzureAPIPattern,
    opts: Partial<ModelFamilyConfig> = {}
): ModelFamilyConfig {
    return {
        family,
        supportedPatterns,
        defaultPattern,
        prefersDeveloperRole: opts.prefersDeveloperRole ?? false,
        usesMaxCompletionTokens: opts.usesMaxCompletionTokens ?? false,
        supportsReasoningEffort: opts.supportsReasoningEffort ?? false,
        supportsTemperature: opts.supportsTemperature ?? true,
    };
}

// Shared config for all the "reasoning-style" GPT-5.x / o-series models:
// developer role, max_completion_tokens, reasoning_effort, no temperature.
function reasoningConfig(family: string, patterns: AzureAPIPattern[], defaultPattern: AzureAPIPattern): ModelFamilyConfig {
    return makeConfig(family, patterns, defaultPattern, {
        prefersDeveloperRole: true,
        usesMaxCompletionTokens: true,
        supportsReasoningEffort: true,
        supportsTemperature: false,
    });
}

const V1_THEN_RESPONSES = [AzureAPIPattern.AZURE_OPENAI_V1, AzureAPIPattern.AZURE_RESPONSES];
const RESPONSES_THEN_V1 = [AzureAPIPattern.AZURE_RESPONSES, AzureAPIPattern.AZURE_OPENAI_V1];

// Longest-prefix-match registry, mirroring the Python _MODEL_REGISTRY.
// Order doesn't matter for matching (longest prefix wins), but is kept
// grouped for readability.
const MODEL_REGISTRY: Record<string, ModelFamilyConfig> = {
    // GPT-5.x series
    'gpt-5.5': reasoningConfig('gpt-5.5', V1_THEN_RESPONSES, AzureAPIPattern.AZURE_OPENAI_V1),
    'gpt-5.4': reasoningConfig('gpt-5.4', V1_THEN_RESPONSES, AzureAPIPattern.AZURE_OPENAI_V1),
    'gpt-5.3-codex': reasoningConfig('gpt-5.3-codex', RESPONSES_THEN_V1, AzureAPIPattern.AZURE_RESPONSES),
    'gpt-5.3-chat': reasoningConfig('gpt-5.3-chat', V1_THEN_RESPONSES, AzureAPIPattern.AZURE_OPENAI_V1),
    'gpt-5.2-codex': reasoningConfig('gpt-5.2-codex', RESPONSES_THEN_V1, AzureAPIPattern.AZURE_RESPONSES),
    'gpt-5.2-chat': reasoningConfig('gpt-5.2-chat', V1_THEN_RESPONSES, AzureAPIPattern.AZURE_OPENAI_V1),
    'gpt-5.2': reasoningConfig('gpt-5.2', V1_THEN_RESPONSES, AzureAPIPattern.AZURE_OPENAI_V1),
    'gpt-5.1-codex-max': reasoningConfig('gpt-5.1-codex-max', RESPONSES_THEN_V1, AzureAPIPattern.AZURE_RESPONSES),
    'gpt-5.1-codex': reasoningConfig('gpt-5.1-codex', RESPONSES_THEN_V1, AzureAPIPattern.AZURE_RESPONSES),
    'gpt-5.1-codex-mini': reasoningConfig('gpt-5.1-codex-mini', RESPONSES_THEN_V1, AzureAPIPattern.AZURE_RESPONSES),
    'gpt-5.1-chat': reasoningConfig('gpt-5.1-chat', V1_THEN_RESPONSES, AzureAPIPattern.AZURE_OPENAI_V1),
    'gpt-5.1': reasoningConfig('gpt-5.1', V1_THEN_RESPONSES, AzureAPIPattern.AZURE_OPENAI_V1),
    'gpt-5-pro': reasoningConfig('gpt-5-pro', V1_THEN_RESPONSES, AzureAPIPattern.AZURE_OPENAI_V1),
    'gpt-5-codex': reasoningConfig('gpt-5-codex', RESPONSES_THEN_V1, AzureAPIPattern.AZURE_RESPONSES),
    'gpt-5': reasoningConfig('gpt-5', V1_THEN_RESPONSES, AzureAPIPattern.AZURE_OPENAI_V1),
    'gpt-5-mini': reasoningConfig('gpt-5-mini', V1_THEN_RESPONSES, AzureAPIPattern.AZURE_OPENAI_V1),
    'gpt-5-nano': reasoningConfig('gpt-5-nano', V1_THEN_RESPONSES, AzureAPIPattern.AZURE_OPENAI_V1),

    // o-series
    'o4-mini': reasoningConfig('o4-mini', V1_THEN_RESPONSES, AzureAPIPattern.AZURE_OPENAI_V1),
    'o4': reasoningConfig('o4', V1_THEN_RESPONSES, AzureAPIPattern.AZURE_OPENAI_V1),
    'o3-pro': reasoningConfig('o3-pro', V1_THEN_RESPONSES, AzureAPIPattern.AZURE_OPENAI_V1),
    'o3-mini': reasoningConfig('o3-mini', V1_THEN_RESPONSES, AzureAPIPattern.AZURE_OPENAI_V1),
    'o3': reasoningConfig('o3', V1_THEN_RESPONSES, AzureAPIPattern.AZURE_OPENAI_V1),
    'o1-mini': makeConfig('o1-mini', V1_THEN_RESPONSES, AzureAPIPattern.AZURE_OPENAI_V1, {
        prefersDeveloperRole: true,
        usesMaxCompletionTokens: true,
        supportsReasoningEffort: false,
        supportsTemperature: false,
    }),
    'o1': reasoningConfig('o1', V1_THEN_RESPONSES, AzureAPIPattern.AZURE_OPENAI_V1),

    // GPT-4.x
    'gpt-4.1-nano': makeConfig('gpt-4.1-nano', [AzureAPIPattern.AZURE_OPENAI_V1, AzureAPIPattern.AZURE_OPENAI_LEGACY], AzureAPIPattern.AZURE_OPENAI_V1),
    'gpt-4.1-mini': makeConfig('gpt-4.1-mini', [AzureAPIPattern.AZURE_OPENAI_V1, AzureAPIPattern.AZURE_OPENAI_LEGACY], AzureAPIPattern.AZURE_OPENAI_V1),
    'gpt-4.1': makeConfig('gpt-4.1', [AzureAPIPattern.AZURE_OPENAI_V1, AzureAPIPattern.AZURE_OPENAI_LEGACY], AzureAPIPattern.AZURE_OPENAI_V1),
    'gpt-4o-mini': makeConfig('gpt-4o-mini', [AzureAPIPattern.AZURE_OPENAI_V1, AzureAPIPattern.AZURE_OPENAI_LEGACY], AzureAPIPattern.AZURE_OPENAI_V1),
    'gpt-4o': makeConfig('gpt-4o', [AzureAPIPattern.AZURE_OPENAI_V1, AzureAPIPattern.AZURE_OPENAI_LEGACY], AzureAPIPattern.AZURE_OPENAI_V1),
    'gpt-4-turbo': makeConfig('gpt-4-turbo', [AzureAPIPattern.AZURE_OPENAI_LEGACY, AzureAPIPattern.AZURE_OPENAI_V1], AzureAPIPattern.AZURE_OPENAI_LEGACY),
    'gpt-4': makeConfig('gpt-4', [AzureAPIPattern.AZURE_OPENAI_LEGACY, AzureAPIPattern.AZURE_OPENAI_V1], AzureAPIPattern.AZURE_OPENAI_LEGACY),

    // Azure AI Foundry / non-OpenAI
    'deepseek': makeConfig('deepseek', [AzureAPIPattern.AZURE_AI_FOUNDRY], AzureAPIPattern.AZURE_AI_FOUNDRY),
    'llama': makeConfig('llama', [AzureAPIPattern.AZURE_AI_FOUNDRY], AzureAPIPattern.AZURE_AI_FOUNDRY),
    'meta-llama': makeConfig('meta-llama', [AzureAPIPattern.AZURE_AI_FOUNDRY], AzureAPIPattern.AZURE_AI_FOUNDRY),
    'mistral': makeConfig('mistral', [AzureAPIPattern.AZURE_AI_FOUNDRY], AzureAPIPattern.AZURE_AI_FOUNDRY),
    'cohere': makeConfig('cohere', [AzureAPIPattern.AZURE_AI_FOUNDRY], AzureAPIPattern.AZURE_AI_FOUNDRY),
    'phi': makeConfig('phi', [AzureAPIPattern.AZURE_AI_FOUNDRY], AzureAPIPattern.AZURE_AI_FOUNDRY),
    'nemotron': makeConfig('nemotron', [AzureAPIPattern.AZURE_AI_FOUNDRY], AzureAPIPattern.AZURE_AI_FOUNDRY),
    'grok': makeConfig('grok', [AzureAPIPattern.AZURE_AI_FOUNDRY], AzureAPIPattern.AZURE_AI_FOUNDRY),
    'jamba': makeConfig('jamba', [AzureAPIPattern.AZURE_AI_FOUNDRY], AzureAPIPattern.AZURE_AI_FOUNDRY),
    'minimax': makeConfig('minimax', [AzureAPIPattern.AZURE_AI_FOUNDRY], AzureAPIPattern.AZURE_AI_FOUNDRY),
    'kimi': makeConfig('kimi', [AzureAPIPattern.AZURE_AI_FOUNDRY], AzureAPIPattern.AZURE_AI_FOUNDRY),
    'claude': makeConfig('claude', [AzureAPIPattern.AZURE_AI_FOUNDRY], AzureAPIPattern.AZURE_AI_FOUNDRY),
    'anthropic': makeConfig('anthropic', [AzureAPIPattern.AZURE_AI_FOUNDRY], AzureAPIPattern.AZURE_AI_FOUNDRY),
    'gpt-oss': makeConfig('gpt-oss', [AzureAPIPattern.AZURE_AI_FOUNDRY], AzureAPIPattern.AZURE_AI_FOUNDRY),
    'qwen': makeConfig('qwen', [AzureAPIPattern.AZURE_AI_FOUNDRY], AzureAPIPattern.AZURE_AI_FOUNDRY),
    'granite': makeConfig('granite', [AzureAPIPattern.AZURE_AI_FOUNDRY], AzureAPIPattern.AZURE_AI_FOUNDRY),
    'command': makeConfig('command', [AzureAPIPattern.AZURE_AI_FOUNDRY], AzureAPIPattern.AZURE_AI_FOUNDRY),
    'wizard': makeConfig('wizard', [AzureAPIPattern.AZURE_AI_FOUNDRY], AzureAPIPattern.AZURE_AI_FOUNDRY),
    'falcon': makeConfig('falcon', [AzureAPIPattern.AZURE_AI_FOUNDRY], AzureAPIPattern.AZURE_AI_FOUNDRY),
    'mamba': makeConfig('mamba', [AzureAPIPattern.AZURE_AI_FOUNDRY], AzureAPIPattern.AZURE_AI_FOUNDRY),
    'nous': makeConfig('nous', [AzureAPIPattern.AZURE_AI_FOUNDRY], AzureAPIPattern.AZURE_AI_FOUNDRY),
    'yi': makeConfig('yi', [AzureAPIPattern.AZURE_AI_FOUNDRY], AzureAPIPattern.AZURE_AI_FOUNDRY),
    'baichuan': makeConfig('baichuan', [AzureAPIPattern.AZURE_AI_FOUNDRY], AzureAPIPattern.AZURE_AI_FOUNDRY),
};

// api-version for the Azure AI Model Inference API (Foundry unified endpoint).
// This is independent of the Azure OpenAI Service api-version setting.
const AZURE_AI_FOUNDRY_API_VERSION = '2024-05-01-preview';

const UNKNOWN_CONFIG: ModelFamilyConfig = makeConfig(
    'unknown',
    [AzureAPIPattern.AZURE_OPENAI_LEGACY],
    AzureAPIPattern.AZURE_OPENAI_LEGACY
);

export class AzureProvider extends BaseProvider {
    private deployment: string;
    private apiVersion: string;
    private useBearerAuth: boolean;

    constructor(provider: AIProvider) {
        super(provider);
        this.deployment = provider.deployment || 'gpt-4o';
        this.apiVersion = provider.apiVersion || '2024-12-01-preview';
        this.useBearerAuth = provider.useBearerAuth || false;
    }

    // ---------------------------------------------------------------
    // Model family detection (longest-prefix match, same as Python)
    // ---------------------------------------------------------------
    private detectModelConfig(modelOrDeployment: string): ModelFamilyConfig {
        const modelLower = modelOrDeployment.toLowerCase().replace(/_/g, '-').replace(/\s/g, '-');

        let bestMatch: string | null = null;
        let bestLen = 0;
        for (const prefix of Object.keys(MODEL_REGISTRY)) {
            const prefixLower = prefix.toLowerCase();
            if (modelLower.startsWith(prefixLower) && prefixLower.length > bestLen) {
                bestMatch = prefix;
                bestLen = prefixLower.length;
            }
        }
        if (bestMatch) {
            return MODEL_REGISTRY[bestMatch];
        }

        for (const [prefix, cfg] of Object.entries(MODEL_REGISTRY)) {
            if (modelLower.includes(prefix.toLowerCase())) {
                return cfg;
            }
        }

        return UNKNOWN_CONFIG;
    }

    // ---------------------------------------------------------------
    // Resolve which API pattern to use, based on base URL + config
    // ---------------------------------------------------------------
    private resolvePattern(config: ModelFamilyConfig, baseUrl: string, useResponsesApi: boolean): AzureAPIPattern {
        const url = (baseUrl || '').toLowerCase().replace(/\/$/, '');

        // Foundry resources can also expose the OpenAI/v1 API under /openai/v1,
        // so check the explicit path before the domain.
        if (url.includes('/openai/v1')) {
            if (useResponsesApi) {
                return AzureAPIPattern.AZURE_RESPONSES;
            }
            return AzureAPIPattern.AZURE_OPENAI_V1;
        }
        if (url.includes('.services.ai.azure.com')) {
            return AzureAPIPattern.AZURE_AI_FOUNDRY;
        }
        if (url.includes('/openai/deployments/')) {
            return AzureAPIPattern.AZURE_OPENAI_LEGACY;
        }
        // A plain Azure OpenAI resource endpoint (e.g. https://<res>.openai.azure.com)
        // without an explicit path should use the legacy deployment-based endpoint,
        // which is the standard Azure OpenAI Service URL shape.
        if (url.includes('.openai.azure.com')) {
            return AzureAPIPattern.AZURE_OPENAI_LEGACY;
        }

        // No URL match -> fall back to the model family's default pattern.
        // (Auth style is a separate, independent decision -- see buildHeaders.)
        return config.defaultPattern;
    }

    // ---------------------------------------------------------------
    // Build the full request URL for a given pattern
    // ---------------------------------------------------------------
    private getUrl(baseUrl: string, deployment: string, pattern: AzureAPIPattern, apiVersion: string): string {
        let base = baseUrl.replace(/\/$/, '');

        switch (pattern) {
            case AzureAPIPattern.AZURE_OPENAI_LEGACY: {
                if (!base.includes('/openai/deployments/')) {
                    base = `${base}/openai/deployments/${deployment}`;
                }
                return `${base}/chat/completions?api-version=${apiVersion}`;
            }
            case AzureAPIPattern.AZURE_OPENAI_V1: {
                if (!base.includes('/openai/v1')) {
                    base = `${base}/openai/v1`;
                }
                // OpenAI/v1 API on Azure does not use an api-version query parameter.
                return `${base}/chat/completions`;
            }
            case AzureAPIPattern.AZURE_RESPONSES: {
                if (!base.includes('/openai/v1')) {
                    base = `${base}/openai/v1`;
                }
                return `${base}/responses?api-version=2025-04-01-preview`;
            }
            case AzureAPIPattern.AZURE_AI_FOUNDRY: {
                // Azure AI Model Inference API uses a fixed path under the resource:
                // https://<resource>.services.ai.azure.com/models/chat/completions?api-version=2024-05-01-preview
                // Normalize any configured URL (with or without /models, /chat/completions, etc.)
                // to the standard Foundry inference path.
                try {
                    const url = new URL(baseUrl);
                    url.pathname = '/models/chat/completions';
                    url.search = `?api-version=${AZURE_AI_FOUNDRY_API_VERSION}`;
                    return url.toString();
                } catch {
                    // Fallback for non-URL values (shouldn't happen in practice).
                    return `${base}/models/chat/completions?api-version=${AZURE_AI_FOUNDRY_API_VERSION}`;
                }
            }
            default:
                throw new Error(`Unsupported API pattern: ${pattern}`);
        }
    }

    // ---------------------------------------------------------------
    // Convert "system" -> "developer" role when the model prefers it
    // ---------------------------------------------------------------
    private buildMessages(config: ModelFamilyConfig, messages: ChatMessage[]): ChatMessage[] {
        return messages.map((msg) => {
            if (msg.role === 'system' && config.prefersDeveloperRole) {
                return { role: 'developer', content: msg.content };
            }
            return msg;
        });
    }

    // ---------------------------------------------------------------
    // Build the request body for either Chat Completions or Responses API
    // ---------------------------------------------------------------
    private buildRequestBody(
        pattern: AzureAPIPattern,
        modelConfig: ModelFamilyConfig,
        messages: ChatMessage[],
        deployment: string,
        temperature: number,
        maxTokens: number,
        stream: boolean
    ): Record<string, any> {
        if (pattern === AzureAPIPattern.AZURE_RESPONSES) {
            const inputs = messages.map((msg) => {
                if (msg.role === 'system' || msg.role === 'developer') {
                    return { role: 'developer', content: msg.content };
                }
                return { role: msg.role, content: msg.content };
            });

            const body: Record<string, any> = {
                model: deployment,
                input: inputs,
                stream,
            };
            if (maxTokens > 0) {
                body.max_output_tokens = maxTokens;
            }
            // Responses API does NOT support temperature.
            return body;
        }

        // Chat Completions API
        const body: Record<string, any> = {
            messages,
            stream,
        };

        if (pattern === AzureAPIPattern.AZURE_OPENAI_V1 || pattern === AzureAPIPattern.AZURE_AI_FOUNDRY) {
            body.model = deployment;
        }

        // Only include temperature if the model family supports it and it's a real number.
        if (modelConfig.supportsTemperature && temperature !== null && !Number.isNaN(temperature)) {
            body.temperature = temperature;
        }

        if (maxTokens > 0) {
            if (modelConfig.usesMaxCompletionTokens && pattern !== AzureAPIPattern.AZURE_AI_FOUNDRY) {
                body.max_completion_tokens = maxTokens;
            } else {
                body.max_tokens = maxTokens;
            }
        }

        return body;
    }

    // ---------------------------------------------------------------
    // Parse a single SSE line, returning delta text if present
    // ---------------------------------------------------------------
    private parseStreamChunk(pattern: AzureAPIPattern, rawLine: string): string | null {
        let line = rawLine.trim();
        if (!line || line.startsWith(':')) {
            return null;
        }
        if (line.startsWith('data: ')) {
            line = line.slice(6);
        }
        if (line === '[DONE]') {
            return null;
        }

        let chunk: any;
        try {
            chunk = JSON.parse(line);
        } catch {
            return null;
        }

        if (pattern === AzureAPIPattern.AZURE_RESPONSES) {
            for (const item of chunk.output ?? []) {
                if (item.type === 'message') {
                    for (const content of item.content ?? []) {
                        if (content.type === 'output_text' && content.text) {
                            return content.text;
                        }
                    }
                }
            }
            return null;
        }

        const choices = chunk.choices ?? [];
        if (choices.length > 0) {
            const delta = choices[0].delta ?? {};
            if (delta.content) {
                return delta.content;
            }
        }
        return null;
    }

    // ---------------------------------------------------------------
    // Extract token usage from a parsed SSE chunk, if present
    // ---------------------------------------------------------------
    private parseUsage(pattern: AzureAPIPattern, chunk: any): TokenUsage | null {
        const usage = chunk?.usage;
        if (!usage) {
            return null;
        }
        if (pattern === AzureAPIPattern.AZURE_RESPONSES) {
            return {
                inputTokens: usage.input_tokens ?? 0,
                outputTokens: usage.output_tokens ?? 0,
            };
        }
        return {
            inputTokens: usage.prompt_tokens ?? 0,
            outputTokens: usage.completion_tokens ?? 0,
        };
    }

    // ---------------------------------------------------------------
    // Parse a non-streaming response body into plain text
    // ---------------------------------------------------------------
    private parseResponse(pattern: AzureAPIPattern, responseJson: any): string {
        if (pattern === AzureAPIPattern.AZURE_RESPONSES) {
            if (responseJson.output_text) {
                return responseJson.output_text;
            }
            const output = responseJson.output;
            if (Array.isArray(output) && output.length > 0) {
                const content = output[0].content;
                if (Array.isArray(content) && content.length > 0) {
                    return content[0].text ?? '';
                }
            }
            return JSON.stringify(responseJson);
        }

        const choices = responseJson.choices;
        if (Array.isArray(choices) && choices.length > 0) {
            return choices[0].message?.content ?? '';
        }
        return JSON.stringify(responseJson);
    }

    // ---------------------------------------------------------------
    // Build auth headers. This is independent of the resolved API
    // pattern -- matches the Python logic exactly: default to
    // "api-key", and ONLY switch to "Authorization: Bearer" when the
    // explicit useBearerAuth flag is set. It does NOT auto-switch based
    // on endpoint shape (e.g. Foundry URLs), so if your Foundry resource
    // needs bearer auth you must set useBearerAuth=true on the provider.
    // ---------------------------------------------------------------
    private buildHeaders(_pattern: AzureAPIPattern): Record<string, string> {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (this.useBearerAuth) {
            headers['Authorization'] = `Bearer ${this.provider.apiKey}`;
        } else {
            headers['api-key'] = this.provider.apiKey;
        }
        return headers;
    }

    // ---------------------------------------------------------------
    // Public: non-streaming completion (kept for parity with the
    // original class's `complete` method)
    // ---------------------------------------------------------------
    async complete(prompt: string): Promise<string> {
        const baseUrl = this.provider.baseUrl.replace(/\/$/, '');
        const modelConfig = this.detectModelConfig(this.deployment);
        const useResponsesApi = (this.provider as any).useResponsesApi ?? false;
        const pattern = this.resolvePattern(modelConfig, baseUrl, useResponsesApi);

        const url = this.getUrl(baseUrl, this.deployment, pattern, this.apiVersion);
        Logger.getInstance().debug(this.provider.name || this.provider.alias, `Resolved pattern ${pattern} for deployment ${this.deployment} -> ${url}`);
        const headers = this.buildHeaders(pattern);

        const rawMessages: ChatMessage[] = [
            { role: 'system', content: 'You are an expert code reviewer. Always respond with valid JSON arrays only.' },
            { role: 'user', content: prompt },
        ];
        const messages = this.buildMessages(modelConfig, rawMessages);

        const temperature = (this.provider as any).temperature ?? 0.2;
        const body = this.buildRequestBody(pattern, modelConfig, messages, this.deployment, temperature, 4000, false);

        const response = await this.fetchWithAuth(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        const data = (await response.json()) as any;
        const content = this.parseResponse(pattern, data);
        if (!content) {
            throw new Error('Empty response from Azure OpenAI');
        }
        return content;
    }

    // ---------------------------------------------------------------
    // Public: streaming completion, mirrors the Python `generate()`
    // async generator, with retry/backoff on 429/5xx.
    // ---------------------------------------------------------------
    async *generate(
        messages: ChatMessage[],
        maxTokens: number = 2000,
        onUsage?: (usage: TokenUsage) => void
    ): AsyncGenerator<string, void, unknown> {
        const baseUrl = this.provider.baseUrl.replace(/\/$/, '');
        const modelConfig = this.detectModelConfig(this.deployment);
        const useResponsesApi = (this.provider as any).useResponsesApi ?? false;
        const pattern = this.resolvePattern(modelConfig, baseUrl, useResponsesApi);

        const url = this.getUrl(baseUrl, this.deployment, pattern, this.apiVersion);
        Logger.getInstance().debug(this.provider.name || this.provider.alias, `Streaming: resolved pattern ${pattern} for deployment ${this.deployment} -> ${url}`);
        const headers = this.buildHeaders(pattern);
        const processedMessages = this.buildMessages(modelConfig, messages);

        const temperature = (this.provider as any).temperature ?? 0.7;
        const body = this.buildRequestBody(pattern, modelConfig, processedMessages, this.deployment, temperature, maxTokens, true);

        const maxRetries = 2;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const response = await this.fetchWithAuth(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });

                if (!response.ok) {
                    const text = await response.text();
                    const err: any = new Error(`Azure API error ${response.status}: ${text}`);
                    err.status = response.status;
                    throw err;
                }

                let usage: TokenUsage | null = null;
                const reader = (response.body as any)?.getReader?.();
                const decoder = new TextDecoder();
                let buffer = '';

                if (reader) {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() ?? '';
                        for (const line of lines) {
                            const content = this.parseStreamChunk(pattern, line);
                            if (content !== null) {
                                yield content;
                            }
                            const trimmed = line.trim();
                            const jsonStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed;
                            if (jsonStr && jsonStr !== '[DONE]') {
                                try {
                                    const parsed = JSON.parse(jsonStr);
                                    const parsedUsage = this.parseUsage(pattern, parsed);
                                    if (parsedUsage) usage = parsedUsage;
                                } catch {
                                    // ignore non-JSON lines
                                }
                            }
                        }
                    }
                }

                if (onUsage && usage) {
                    onUsage(usage);
                }
                return;
            } catch (e: any) {
                const retriableStatus = [429, 500, 502, 503].includes(e?.status);
                if (retriableStatus && attempt < maxRetries) {
                    await new Promise((res) => setTimeout(res, 2 ** attempt * 1000));
                    continue;
                }
                throw e;
            }
        }
    }

    // ---------------------------------------------------------------
    // Public: connection test, mirrors Python `test_connection`
    // ---------------------------------------------------------------
    async testConnection(): Promise<{ success: boolean; response?: string; error?: string }> {
        try {
            const baseUrl = this.provider.baseUrl.replace(/\/$/, '');
            const modelConfig = this.detectModelConfig(this.deployment);
            const useResponsesApi = (this.provider as any).useResponsesApi ?? false;
            const pattern = this.resolvePattern(modelConfig, baseUrl, useResponsesApi);

            const url = this.getUrl(baseUrl, this.deployment, pattern, this.apiVersion);
            Logger.getInstance().debug(this.provider.name || this.provider.alias, `Test connection: resolved pattern ${pattern} for deployment ${this.deployment} -> ${url}`);
            const headers = this.buildHeaders(pattern);
            const messages = this.buildMessages(modelConfig, [{ role: 'user', content: 'Say hello' }]);

            const temperature = (this.provider as any).temperature ?? 0.7;
            const body = this.buildRequestBody(pattern, modelConfig, messages, this.deployment, temperature, 50, false);

            const response = await this.fetchWithAuth(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const text = await response.text();
                return { success: false, error: `${response.status}: ${text}` };
            }

            const data = await response.json();
            const content = this.parseResponse(pattern, data);
            return { success: true, response: content };
        } catch (e: any) {
            return { success: false, error: e?.message ?? String(e) };
        }
    }
}