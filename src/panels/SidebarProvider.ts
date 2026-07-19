import * as vscode from 'vscode';
import { ReviewService } from '../services/ReviewService';
import { ConfigService } from '../services/ConfigService';
import { RepovisorPanel } from './RepovisorPanel';
import { Logger } from '../utils/logger';

export class SidebarProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _reviewService: ReviewService;
    private _configService: ConfigService;
    private _extensionUri: vscode.Uri;

    constructor(extensionUri: vscode.Uri, reviewService: ReviewService, configService: ConfigService) {
        this._extensionUri = extensionUri;
        this._reviewService = reviewService;
        this._configService = configService;
    }

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist')]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'openPanel':
                    vscode.commands.executeCommand('repovisor.openPanel');
                    break;
                case 'quickReview':
                    vscode.commands.executeCommand('repovisor.quickReview');
                    break;
                case 'reviewFile':
                    vscode.commands.executeCommand('repovisor.reviewCurrentFile');
                    break;
                case 'reviewSelection':
                    vscode.commands.executeCommand('repovisor.reviewSelection');
                    break;
                case 'sidebarReview':
                    this._runSidebarReview(message.data);
                    break;
                case 'review':
                    // Same message as main panel; treat as sidebar review
                    this._runSidebarReview(message.data);
                    break;
                case 'getHistory':
                    const history = this._reviewService.getReviewHistory(
                        message.data.page,
                        message.data.perPage,
                        message.data.query
                    );
                    webviewView.webview.postMessage({ command: 'historyData', data: history });
                    break;
                case 'getProviderStatus':
                    this._sendProviderStatus();
                    break;
                case 'setActiveProvider':
                    this._setActiveProvider(message.data).then(() => {
                        this._sendProviderStatus();
                        webviewView.webview.postMessage({ command: 'providerSaved' });
                    }).catch(error => {
                        webviewView.webview.postMessage({
                            command: 'providerSaveError',
                            error: error instanceof Error ? error.message : String(error)
                        });
                    });
                    break;
                case 'testProvider':
                    Logger.getInstance().info('SidebarProvider', `Testing provider ${message.data?.alias}`);
                    this._testProvider(message.data).catch(error => {
                        Logger.getInstance().error('SidebarProvider', 'Provider test failed', error);
                        webviewView.webview.postMessage({
                            command: 'providerTestResult',
                            success: false,
                            error: error instanceof Error ? error.message : String(error)
                        });
                    });
                    break;
                case 'getModelConfig':
                    webviewView.webview.postMessage({
                        command: 'modelConfigData',
                        data: this._configService.getModelConfig()
                    });
                    break;
                case 'getPlatformTokens':
                    webviewView.webview.postMessage({
                        command: 'platformTokensData',
                        data: this._configService.getPlatformTokens()
                    });
                    break;
                case 'setModelConfig':
                    this._configService.setModelConfig(message.data).then(() => {
                        webviewView.webview.postMessage({ command: 'modelConfigSaved' });
                    }).catch(error => {
                        webviewView.webview.postMessage({
                            command: 'modelConfigError',
                            error: error instanceof Error ? error.message : String(error)
                        });
                    });
                    break;
                case 'updateConfig':
                    {
                        const cfg = message.data;
                        const config = vscode.workspace.getConfiguration('repovisor');
                        if (cfg.githubToken !== undefined) {
                            config.update('githubToken', cfg.githubToken, true);
                        }
                        if (cfg.gitlabToken !== undefined) {
                            config.update('gitlabToken', cfg.gitlabToken, true);
                        }
                        webviewView.webview.postMessage({ command: 'configSaved' });
                    }
                    break;
                case 'postReview':
                    {
                        const result = message.data;
                        if (!result.repo || !result.prNumber || !result.platform) {
                            webviewView.webview.postMessage({
                                command: 'postReviewError',
                                error: 'Missing repository, PR number, or platform'
                            });
                            break;
                        }
                        vscode.window.withProgress({
                            location: vscode.ProgressLocation.Notification,
                            title: `Posting review to ${result.platform}...`,
                            cancellable: false
                        }, async () => {
                            try {
                                await this._reviewService.postReview(result, result.repo, result.prNumber, result.platform);
                                webviewView.webview.postMessage({ command: 'postReviewSuccess' });
                                vscode.window.showInformationMessage('Review posted successfully');
                            } catch (error) {
                                Logger.getInstance().error('SidebarProvider', 'Failed to post review', error);
                                webviewView.webview.postMessage({
                                    command: 'postReviewError',
                                    error: error instanceof Error ? error.message : String(error)
                                });
                                vscode.window.showErrorMessage(`Failed to post review: ${error}`);
                            }
                        });
                    }
                    break;
            }
        });
    }

    private async _runSidebarReview(data: any) {
        const { repo, prNumber, platform, profile, autoPost } = data;
        if (!repo || !prNumber || !platform) {
            vscode.window.showWarningMessage('Please fill in all required fields');
            return;
        }

        Logger.getInstance().info('SidebarProvider', `Starting sidebar review for ${platform}:${repo}#${prNumber}`);

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Reviewing ${repo}#${prNumber}...`,
            cancellable: true
        }, async (progress) => {
            try {
                progress.report({ increment: 10, message: 'Fetching PR diff...' });
                const result = await this._reviewService.reviewPullRequest(
                    repo,
                    parseInt(prNumber, 10),
                    platform,
                    { profile, autoPost: !!autoPost }
                );

                progress.report({ increment: 90, message: 'Rendering results...' });
                RepovisorPanel.createOrShow(this._extensionUri, this._reviewService, this._configService);
                RepovisorPanel.currentPanel?.showPRReviewResult(result, repo, parseInt(prNumber, 10));

                vscode.window.showInformationMessage(
                    `✅ PR #${prNumber} review complete: ${result.findings.length} findings`
                );
            } catch (error) {
                Logger.getInstance().error('SidebarProvider', 'Sidebar review failed', error);
                vscode.window.showErrorMessage(`PR review failed: ${error}`);
            }
        });
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
        this._view?.webview.postMessage({
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
                this._view?.webview.postMessage({
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
                healthUrl = endpoint.replace(/\/$/, '') + '/openai/models?api-version=' + (apiVersion || '2024-12-01-preview');
                if (useBearerAuth) {
                    headers['Authorization'] = `Bearer ${apiKey}`;
                } else {
                    headers['api-key'] = apiKey;
                }
                break;
            default:
                throw new Error(`Unsupported provider: ${alias}`);
        }

        const response = await fetch(healthUrl, { headers, method: 'GET' });
        if (!response.ok) {
            throw new Error(`Connection test failed: ${response.status} ${response.statusText}`);
        }
        this._view?.webview.postMessage({
            command: 'providerTestResult',
            success: true,
            message: 'Connection successful'
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist', 'assets', 'index.js')
        ).toString() + '?mode=sidebar';
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
}
