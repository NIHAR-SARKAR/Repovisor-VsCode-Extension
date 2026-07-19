import * as vscode from 'vscode';
import { AIProvider, CustomRule, ReviewProfile, ModelConfig } from '../types';

export class ConfigService {
    private readonly providerDefinitions: Omit<AIProvider, 'apiKey' | 'enabled' | 'health'>[] = [
        {
            alias: 'openai',
            name: 'OpenAI',
            baseUrl: 'https://api.openai.com/v1',
            defaultModel: 'gpt-4o'
        },
        {
            alias: 'anthropic',
            name: 'Anthropic Claude',
            baseUrl: 'https://api.anthropic.com',
            defaultModel: 'claude-3-5-sonnet-20241022'
        },
        {
            alias: 'moonshot',
            name: 'Moonshot (Kimi)',
            baseUrl: 'https://api.moonshot.cn/v1',
            defaultModel: 'kimi-k2-6'
        },
        {
            alias: 'deepseek',
            name: 'DeepSeek',
            baseUrl: 'https://api.deepseek.com',
            defaultModel: 'deepseek-chat'
        },
        {
            alias: 'azure',
            name: 'Azure OpenAI',
            baseUrl: '',
            defaultModel: 'gpt-4o',
            endpoint: '',
            deployment: 'gpt-4o',
            apiVersion: '2024-12-01-preview',
            useBearerAuth: false
        },
        {
            alias: 'openai-compatible',
            name: 'OpenAI Compatible',
            baseUrl: 'https://api.openai.com/v1',
            defaultModel: 'gpt-4o'
        }
    ];

    private getConfig(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration('repovisor');
    }

    getGithubToken(): string {
        return this.getConfig().get('githubToken', '');
    }

    getGitlabToken(): string {
        return this.getConfig().get('gitlabToken', '');
    }

    getPlatformTokens(): { githubToken: string; gitlabToken: string } {
        return {
            githubToken: this.getGithubToken(),
            gitlabToken: this.getGitlabToken()
        };
    }

    getGitlabUrl(): string {
        return this.getConfig().get('gitlabUrl', 'https://gitlab.com');
    }

    getActiveProviderAlias(): string {
        return this.getConfig().get('activeProvider', '');
    }

    getActiveProvider(): AIProvider | undefined {
        const alias = this.getActiveProviderAlias();
        if (!alias) {
            return undefined;
        }
        const provider = this.getProviderByAlias(alias);
        return provider?.enabled ? provider : undefined;
    }

    isProviderConfigured(alias: string): boolean {
        const hasKey = !!this.getProviderApiKey(alias);
        if (!hasKey) {
            return false;
        }
        if (alias === 'azure') {
            return !!this.getConfig().get('azureEndpoint', '');
        }
        return true;
    }

    async setActiveProvider(alias: string): Promise<void> {
        await this.getConfig().update('activeProvider', alias, true);
    }

    getProviderApiKey(alias: string): string {
        const keyMap: Record<string, string> = {
            'openai': 'openaiApiKey',
            'anthropic': 'anthropicApiKey',
            'moonshot': 'moonshotApiKey',
            'deepseek': 'deepseekApiKey',
            'azure': 'azureApiKey'
        };
        return this.getConfig().get(keyMap[alias] || '', '');
    }

    async setProviderApiKey(alias: string, apiKey: string): Promise<void> {
        const keyMap: Record<string, string> = {
            'openai': 'openaiApiKey',
            'anthropic': 'anthropicApiKey',
            'moonshot': 'moonshotApiKey',
            'deepseek': 'deepseekApiKey',
            'azure': 'azureApiKey'
        };
        if (keyMap[alias]) {
            await this.getConfig().update(keyMap[alias], apiKey, true);
        }
    }

    async setProviderConfig(alias: string, cfg: Partial<AIProvider>): Promise<void> {
        if (alias === 'azure') {
            if (cfg.endpoint !== undefined) {
                await this.getConfig().update('azureEndpoint', cfg.endpoint, true);
            }
            if (cfg.deployment !== undefined) {
                await this.getConfig().update('azureDeployment', cfg.deployment, true);
            }
            if (cfg.apiVersion !== undefined) {
                await this.getConfig().update('azureApiVersion', cfg.apiVersion, true);
            }
            if (cfg.useBearerAuth !== undefined) {
                await this.getConfig().update('azureUseBearerAuth', cfg.useBearerAuth, true);
            }
        }
        if (cfg.baseUrl !== undefined) {
            await this.getConfig().update(`${alias}BaseUrl`, cfg.baseUrl, true);
        }
        if (cfg.defaultModel !== undefined) {
            await this.setProviderModel(alias, cfg.defaultModel);
        }
    }

    getProviderModel(alias: string): string {
        const models = this.getConfig().get('providerModels', {}) as Record<string, string>;
        return models[alias] || '';
    }

    async setProviderModel(alias: string, model: string): Promise<void> {
        const models = this.getConfig().get('providerModels', {}) as Record<string, string>;
        models[alias] = model;
        await this.getConfig().update('providerModels', models, true);
    }

    getDefaultProvider(): string {
        return this.getActiveProviderAlias() || 'openai';
    }

    getDefaultProfile(): ReviewProfile {
        return this.getConfig().get('defaultProfile', 'standard') as ReviewProfile;
    }

    getCustomHeaders(alias: string): Record<string, string> {
        const allHeaders = this.getConfig().get('customHeaders', {}) as Record<string, Record<string, string>>;
        return allHeaders[alias] || {};
    }

    async setCustomHeaders(alias: string, headers: Record<string, string>): Promise<void> {
        const allHeaders = this.getConfig().get('customHeaders', {}) as Record<string, Record<string, string>>;
        allHeaders[alias] = headers;
        await this.getConfig().update('customHeaders', allHeaders, true);
    }

    getModelConfig(): ModelConfig {
        return this.getConfig().get('modelConfig', {}) as ModelConfig;
    }

    async setModelConfig(cfg: ModelConfig): Promise<void> {
        await this.getConfig().update('modelConfig', cfg, true);
    }

    getAutoPost(): boolean {
        return this.getConfig().get('autoPostComments', false);
    }

    getEnableRules(): boolean {
        return this.getConfig().get('enableRules', true);
    }

    getMaxContextLines(): number {
        return this.getConfig().get('maxContextLines', 5);
    }

    getAllProviders(): AIProvider[] {
        const activeAlias = this.getActiveProviderAlias();
        const config = this.getConfig();
        return this.providerDefinitions.map(def => {
            const apiKey = this.getProviderApiKey(def.alias);
            const isAzure = def.alias === 'azure';
            const baseUrl = isAzure
                ? (config.get('azureBaseUrl', '') || config.get('azureEndpoint', ''))
                : (config.get(`${def.alias}BaseUrl`, '') || def.baseUrl);
            const endpoint = isAzure ? config.get('azureEndpoint', '') : undefined;
            const deployment = isAzure ? config.get('azureDeployment', 'gpt-4o') : undefined;
            const apiVersion = isAzure ? config.get('azureApiVersion', '2024-12-01-preview') : undefined;
            const useBearerAuth = isAzure ? config.get('azureUseBearerAuth', false) : undefined;
            const customHeaders = this.getCustomHeaders(def.alias);
            const savedModel = this.getProviderModel(def.alias);
            const enabled = activeAlias === def.alias && !!apiKey && (def.alias !== 'azure' || !!endpoint);
            const defaultModel = savedModel || def.defaultModel;

            return {
                ...def,
                baseUrl: baseUrl || (isAzure ? '' : def.baseUrl),
                defaultModel,
                apiKey,
                enabled,
                endpoint,
                deployment,
                apiVersion,
                useBearerAuth,
                customHeaders,
                reasoningEffort: undefined,
                supportsCustomEndpoint: ['openai-compatible', 'openai'].includes(def.alias)
            } as AIProvider;
        });
    }

    getEnabledProviders(): AIProvider[] {
        return this.getAllProviders().filter(p => p.enabled);
    }

    getProviderByAlias(alias: string): AIProvider | undefined {
        return this.getAllProviders().find(p => p.alias === alias);
    }

    async updateConfig(key: string, value: any): Promise<void> {
        await this.getConfig().update(key, value, true);
    }

    async getCustomRules(context: vscode.ExtensionContext): Promise<CustomRule[]> {
        return context.globalState.get<CustomRule[]>('repovisor.customRules', []);
    }

    async addCustomRule(context: vscode.ExtensionContext, rule: CustomRule): Promise<void> {
        const rules = await this.getCustomRules(context);
        rules.push(rule);
        await context.globalState.update('repovisor.customRules', rules);
    }

    async deleteCustomRule(context: vscode.ExtensionContext, ruleId: string): Promise<void> {
        const rules = await this.getCustomRules(context);
        const filtered = rules.filter(r => r.id !== ruleId);
        await context.globalState.update('repovisor.customRules', filtered);
    }

    async updateCustomRules(context: vscode.ExtensionContext, rules: CustomRule[]): Promise<void> {
        await context.globalState.update('repovisor.customRules', rules);
    }
}
