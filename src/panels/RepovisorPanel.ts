import * as vscode from 'vscode';
import { ReviewService } from '../services/ReviewService';
import { ConfigService } from '../services/ConfigService';
import { ReviewResult, AIProvider } from '../types';
import { Logger } from '../utils/logger';
import { AzureProvider } from '../providers/AzureProvider';

export class RepovisorPanel {
    public static currentPanel: RepovisorPanel | undefined;
    public static readonly viewType = 'repovisorPanel';
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _reviewService: ReviewService;
    private _configService: ConfigService;

    public static createOrShow(
        extensionUri: vscode.Uri,
        reviewService: ReviewService,
        configService: ConfigService
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (RepovisorPanel.currentPanel) {
            RepovisorPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            RepovisorPanel.viewType,
            'Repovisor AI',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'webview-ui', 'dist')]
            }
        );

        RepovisorPanel.currentPanel = new RepovisorPanel(panel, extensionUri, reviewService, configService);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        reviewService: ReviewService,
        configService: ConfigService
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._reviewService = reviewService;
        this._configService = configService;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'review':
                        try {
                            Logger.getInstance().info('RepovisorPanel', 'Starting review from panel');
                            const result = await this._reviewService.reviewPullRequest(
                                message.data.repo,
                                message.data.prNumber,
                                message.data.platform,
                                {
                                    profile: message.data.profile,
                                    autoPost: message.data.autoPost
                                }
                            );
                            this._panel.webview.postMessage({ command: 'reviewComplete', data: result });
                        } catch (error) {
                            Logger.getInstance().error('RepovisorPanel', 'Review failed', error);
                            this._panel.webview.postMessage({ 
                                command: 'reviewError', 
                                error: error instanceof Error ? error.message : String(error) 
                            });
                        }
                        break;
                    case 'getHistory':
                        const history = this._reviewService.getReviewHistory(
                            message.data.page,
                            message.data.perPage,
                            message.data.query
                        );
                        this._panel.webview.postMessage({ command: 'historyData', data: history });
                        break;
                    case 'getProviderStatus':
                        this._sendProviderStatus();
                        break;
                    case 'setActiveProvider':
                        try {
                            await this._setActiveProvider(message.data);
                            this._sendProviderStatus();
                            this._panel.webview.postMessage({ command: 'providerSaved' });
                        } catch (error) {
                            this._panel.webview.postMessage({
                                command: 'providerSaveError',
                                error: error instanceof Error ? error.message : String(error)
                            });
                        }
                        break;
                    case 'testProvider':
                        try {
                            Logger.getInstance().info('RepovisorPanel', `Testing provider ${message.data?.alias}`);
                            await this._testProvider(message.data);
                        } catch (error) {
                            Logger.getInstance().error('RepovisorPanel', 'Provider test failed', error);
                            this._panel.webview.postMessage({
                                command: 'providerTestResult',
                                success: false,
                                error: error instanceof Error ? error.message : String(error)
                            });
                        }
                        break;
                    case 'getModelConfig':
                        this._panel.webview.postMessage({
                            command: 'modelConfigData',
                            data: this._configService.getModelConfig()
                        });
                        break;
                    case 'getPlatformTokens':
                        this._panel.webview.postMessage({
                            command: 'platformTokensData',
                            data: this._configService.getPlatformTokens()
                        });
                        break;
                    case 'setModelConfig':
                        try {
                            await this._configService.setModelConfig(message.data);
                            this._panel.webview.postMessage({ command: 'modelConfigSaved' });
                        } catch (error) {
                            this._panel.webview.postMessage({
                                command: 'modelConfigError',
                                error: error instanceof Error ? error.message : String(error)
                            });
                        }
                        break;
                    case 'updateConfig':
                        try {
                            const cfg = message.data;
                            const config = vscode.workspace.getConfiguration('repovisor');
                            if (cfg.githubToken !== undefined) {
                                await config.update('githubToken', cfg.githubToken, true);
                            }
                            if (cfg.gitlabToken !== undefined) {
                                await config.update('gitlabToken', cfg.gitlabToken, true);
                            }
                            this._panel.webview.postMessage({ command: 'configSaved' });
                        } catch (error) {
                            this._panel.webview.postMessage({ command: 'configError', error: String(error) });
                        }
                        break;
                    case 'postReview':
                        try {
                            const result = message.data;
                            if (!result.repo || !result.prNumber || !result.platform) {
                                throw new Error('Missing repository, PR number, or platform');
                            }
                            await this._reviewService.postReview(result, result.repo, result.prNumber, result.platform);
                            this._panel.webview.postMessage({ command: 'postReviewSuccess' });
                        } catch (error) {
                            Logger.getInstance().error('RepovisorPanel', 'Failed to post review', error);
                            this._panel.webview.postMessage({
                                command: 'postReviewError',
                                error: error instanceof Error ? error.message : String(error)
                            });
                        }
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    private _sendProviderStatus(): void {
        const activeAlias = this._configService.getActiveProviderAlias();
        const providers = this._configService.getAllProviders().map(p => ({
            alias: p.alias,
            name: p.name,
            configured: this._configService.isProviderConfigured(p.alias),
            active: p.alias === activeAlias,
            apiKey: p.apiKey,
            baseUrl: p.baseUrl,
            defaultModel: p.defaultModel,
            endpoint: p.endpoint,
            deployment: p.deployment,
            apiVersion: p.apiVersion,
            useBearerAuth: p.useBearerAuth,
            customHeaders: p.customHeaders,
            reasoningEffort: p.reasoningEffort,
            supportsCustomEndpoint: p.supportsCustomEndpoint
        }));
        this._panel.webview.postMessage({
            command: 'providerStatus',
            data: {
                activeProvider: activeAlias,
                providers
            }
        });
    }

    private async _setActiveProvider(data: any): Promise<void> {
        const { alias, apiKey, baseUrl, model, endpoint, deployment, apiVersion, useBearerAuth, customHeaders } = data;
        await this._configService.setActiveProvider(alias);
        if (apiKey) {
            await this._configService.setProviderApiKey(alias, apiKey);
        }
        await this._configService.setProviderConfig(alias, {
            baseUrl,
            defaultModel: model,
            endpoint,
            deployment,
            apiVersion,
            useBearerAuth
        });
        if (customHeaders !== undefined) {
            await this._configService.setCustomHeaders(alias, customHeaders);
        }
    }

    private async _testProvider(data: any): Promise<void> {
        const { alias, apiKey, baseUrl, endpoint, deployment, apiVersion, useBearerAuth, customHeaders } = data;
        const provider: AIProvider = {
            alias,
            name: '',
            apiKey: apiKey || '',
            baseUrl: baseUrl || '',
            defaultModel: '',
            enabled: true,
            endpoint,
            deployment,
            apiVersion,
            useBearerAuth,
            customHeaders: customHeaders || {}
        };

        let healthUrl: string;
        let headers: Record<string, string> = {
            ...(customHeaders || {})
        };

        switch (alias) {
            case 'openai':
            case 'openai-compatible':
                healthUrl = (baseUrl || 'https://api.openai.com/v1') + '/models';
                headers['Authorization'] = `Bearer ${apiKey}`;
                break;
            case 'anthropic':
                this._panel.webview.postMessage({
                    command: 'providerTestResult',
                    success: true,
                    message: 'Anthropic provider configured. Connection test is skipped because the API requires a POST request.'
                });
                return;
            case 'moonshot':
                healthUrl = (baseUrl || 'https://api.moonshot.cn/v1') + '/models';
                headers['Authorization'] = `Bearer ${apiKey}`;
                break;
            case 'deepseek':
                healthUrl = (baseUrl || 'https://api.deepseek.com') + '/models';
                headers['Authorization'] = `Bearer ${apiKey}`;
                break;
            case 'azure':
                if (!endpoint) {
                    throw new Error('Azure endpoint is required');
                }
                {
                    const azureProvider: AIProvider = {
                        alias: 'azure',
                        name: 'Azure OpenAI',
                        apiKey: apiKey || '',
                        baseUrl: baseUrl || endpoint || '',
                        defaultModel: deployment || '',
                        enabled: true,
                        endpoint,
                        deployment,
                        apiVersion,
                        useBearerAuth,
                        customHeaders: customHeaders || {}
                    };
                    const testResult = await new AzureProvider(azureProvider).testConnection();
                    if (!testResult.success) {
                        throw new Error(`Connection test failed: ${testResult.error}`);
                    }
                    this._panel.webview.postMessage({
                        command: 'providerTestResult',
                        success: true,
                        message: `Connection successful: ${testResult.response}`
                    });
                    return;
                }
            default:
                throw new Error(`Unsupported provider: ${alias}`);
        }

        const response = await fetch(healthUrl, { headers, method: 'GET' });
        if (!response.ok) {
            throw new Error(`Connection test failed: ${response.status} ${response.statusText}`);
        }
        this._panel.webview.postMessage({
            command: 'providerTestResult',
            success: true,
            message: 'Connection successful'
        });
    }

    public showPRReviewResult(result: ReviewResult, repo: string, prNumber: number) {
        this._panel.webview.postMessage({
            command: 'showPRResult',
            data: { result, repo, prNumber }
        });
    }

    public showFileReviewResult(result: ReviewResult, fileName: string) {
        this._panel.webview.postMessage({
            command: 'showFileResult',
            data: { result, fileName }
        });
    }

    public showSelectionReviewResult(result: ReviewResult, selection: string) {
        this._panel.webview.postMessage({
            command: 'showSelectionResult',
            data: { result, selection }
        });
    }

    public showReviewForm(repo: string, prNumber: number, platform: 'github' | 'gitlab') {
        this._panel.webview.postMessage({
            command: 'prefillReview',
            data: { repo, prNumber, platform }
        });
    }

    private _update() {
        const webview = this._panel.webview;
        webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist', 'assets', 'index.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist', 'assets', 'index.css')
        );

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Repovisor AI</title>
                <link rel="stylesheet" href="${styleUri}">
            </head>
            <body>
                <div id="root"></div>
                <script type="module" src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    public dispose() {
        RepovisorPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
