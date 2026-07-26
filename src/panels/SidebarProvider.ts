import * as vscode from 'vscode';
import { ReviewService } from '../services/ReviewService';
import { ConfigService } from '../services/ConfigService';
import { Logger } from '../utils/logger';

export class SidebarProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;
    private _reviewService: ReviewService;
    private _configService: ConfigService;

    constructor(extensionUri: vscode.Uri, reviewService: ReviewService, configService: ConfigService) {
        this._extensionUri = extensionUri;
        this._reviewService = reviewService;
        this._configService = configService;
    }

    resolveWebviewView(webviewView: vscode.WebviewView) {
        try {
            Logger.getInstance().info('SidebarProvider', 'resolveWebviewView called');
            this._view = webviewView;
            webviewView.webview.options = {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'codicons', 'dist')]
            };
            webviewView.webview.html = this._getHtml(webviewView.webview);

            webviewView.webview.onDidReceiveMessage(message => {
                Logger.getInstance().debug('SidebarProvider', `Received command ${message?.command}`);
                switch (message.command) {
                    case 'getDashboardData':
                    case 'ready':
                        this._sendDashboardData();
                        break;
                    case 'openSettings':
                        vscode.commands.executeCommand('workbench.action.openSettings', 'repovisor');
                        break;
                    case 'viewHistory':
                        vscode.commands.executeCommand('repovisor.refreshHistory');
                        try {
                            vscode.commands.executeCommand('repovisor.history.focus');
                        } catch { /* ignore */ }
                        break;
                    case 'openPanel':
                        vscode.commands.executeCommand('repovisor.openPanel');
                        break;
                }
            });

            // Send data immediately and periodically until acknowledged
            this._sendDashboardData();
            const interval = setInterval(() => {
                if (!this._view) {
                    clearInterval(interval);
                    return;
                }
                this._sendDashboardData();
            }, 1000);
            // Stop after 10 seconds
            setTimeout(() => clearInterval(interval), 10000);
        } catch (error) {
            Logger.getInstance().error('SidebarProvider', 'resolveWebviewView failed', error);
            vscode.window.showErrorMessage(`Repovisor Review Hub failed to load: ${error}`);
        }
    }

    private _sendDashboardData(): void {
        try {
            const activeProvider = this._configService.getActiveProvider();
            const isConfigured = activeProvider
                ? this._configService.isProviderConfigured(activeProvider.alias)
                : false;

            const githubConfigured = !!this._configService.getGithubToken();
            const gitlabConfigured = !!this._configService.getGitlabToken();

            const history = this._reviewService.getReviewHistory(1, 1000);
            const reviews = history.reviews;

            const now = new Date();
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const reviewsThisWeek = reviews.filter(r => new Date(r.timestamp) > oneWeekAgo).length;

            const avgDuration = reviews.length > 0
                ? Math.round(reviews.reduce((sum, r) => sum + r.duration, 0) / reviews.length / 1000)
                : 0;

            const latest = reviews[0] || null;

            const payload = {
                command: 'dashboardData',
                data: {
                    provider: activeProvider ? {
                        name: activeProvider.name,
                        model: activeProvider.defaultModel,
                        configured: isConfigured
                    } : null,
                    platforms: {
                        github: githubConfigured,
                        gitlab: gitlabConfigured
                    },
                    stats: {
                        total: history.total,
                        thisWeek: reviewsThisWeek,
                        avgDuration
                    },
                    latest: latest ? {
                        summary: latest.summary,
                        riskLevel: latest.riskLevel,
                        repo: latest.repo,
                        prNumber: latest.prNumber,
                        platform: latest.platform,
                        findingsCount: latest.findings?.length || 0,
                        timestamp: latest.timestamp
                    } : null
                }
            };

            Logger.getInstance().debug('SidebarProvider', 'Sending dashboardData');
            this._view?.webview.postMessage(payload);
        } catch (error) {
            Logger.getInstance().error('SidebarProvider', 'Failed to build dashboard data', error);
            this._view?.webview.postMessage({
                command: 'dashboardError',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private _getHtml(webview: vscode.Webview): string {
        const codiconsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css')
        );

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${codiconsUri}">
  <style>
    body {
      padding: 20px 16px 14px;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    .section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin: 18px 0 8px;
    }
    .section-title:first-child {
      margin-top: 0;
    }
    .card {
      background: var(--vscode-editor-inactiveSelectionBackground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 8px 10px;
      margin-bottom: 8px;
    }
    .status-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      margin-bottom: 4px;
    }
    .status-row:last-child {
      margin-bottom: 0;
    }
    .status-label {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      display: inline-block;
      flex-shrink: 0;
    }
    .status-dot.ok { background: var(--vscode-testing-iconPassed, #89d185); }
    .status-dot.warn { background: var(--vscode-charts-yellow, #cca700); }
    .status-dot.error { background: var(--vscode-testing-iconFailed, #f14c4c); }
    .status-value {
      font-weight: 600;
    }
    .provider-name {
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 2px;
    }
    .provider-meta {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .stat-box {
      text-align: center;
      padding: 8px 6px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
    }
    .stat-number {
      font-size: 15px;
      font-weight: 700;
      color: var(--vscode-foreground);
    }
    .stat-label {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
    }
    .latest-review {
      font-size: 11px;
      line-height: 1.4;
    }
    .latest-title {
      font-weight: 600;
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .latest-summary {
      color: var(--vscode-descriptionForeground);
      margin-bottom: 6px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .latest-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
    }
    .risk {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .risk-critical { background: var(--vscode-inputValidation-errorBackground, #f14c4c33); color: var(--vscode-inputValidation-errorForeground, #f14c4c); border: 1px solid var(--vscode-inputValidation-errorBorder, #f14c4c); }
    .risk-high { background: var(--vscode-inputValidation-warningBackground, #cca70033); color: var(--vscode-inputValidation-warningForeground, #cca700); border: 1px solid var(--vscode-inputValidation-warningBorder, #cca700); }
    .risk-medium { background: var(--vscode-inputValidation-infoBackground, #89d18533); color: var(--vscode-inputValidation-infoForeground, #89d185); border: 1px solid var(--vscode-inputValidation-infoBorder, #89d185); }
    .risk-low { background: var(--vscode-charts-blue, #75beff33); color: var(--vscode-charts-blue, #75beff); opacity: 0.8; }
    .button-row {
      display: flex;
      gap: 6px;
      margin-top: 8px;
    }
    .button {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      padding: 5px 8px;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
      text-align: center;
      transition: background-color 0.15s;
    }
    .button:hover {
      opacity: 0.9;
    }
    .button-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .button-primary:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .button-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .button-secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .empty-state, .error-state, .init-state {
      text-align: center;
      padding: 12px 0;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    .error-state {
      color: var(--vscode-errorForeground);
    }
    .divider {
      height: 1px;
      background: var(--vscode-panel-border);
      margin: 14px 0;
    }
  </style>
</head>
<body>
  <div id="content">
    <div class="init-state">Initializing Review Hub...</div>
  </div>

  <script>
    console.log('[Repovisor ReviewHub] script start');
    const vscode = acquireVsCodeApi();
    console.log('[Repovisor ReviewHub] vscode api acquired');

    let dataReceived = false;

    function basename(path) {
      if (!path) return '';
      return path.replace(/\\\\/g, '/').split('/').pop() || path;
    }

    function render(data) {
      try {
        console.log('[Repovisor ReviewHub] render called', data);
        dataReceived = true;
        const container = document.getElementById('content');
        if (!data) {
          container.innerHTML = '<div class="empty-state">No data available</div>';
          return;
        }

        let html = '';

        html += '<div class="section-title">AI Provider</div>';
        if (data.provider) {
          const statusClass = data.provider.configured ? 'ok' : 'error';
          const statusText = data.provider.configured ? 'Connected' : 'Not configured';
          html += '<div class="card">';
          html += '<div class="provider-name">' + escapeHtml(data.provider.name) + '</div>';
          html += '<div class="provider-meta">' + escapeHtml(data.provider.model) + '</div>';
          html += '<div class="status-row" style="margin-top:4px;">';
          html += '<span class="status-label"><span class="status-dot ' + statusClass + '"></span>' + escapeHtml(statusText) + '</span>';
          html += '</div>';
          html += '</div>';
        } else {
          html += '<div class="card empty-state">No provider selected</div>';
        }

        html += '<div class="section-title">Platform Tokens</div>';
        html += '<div class="card">';
        html += '<div class="status-row">';
        html += '<span class="status-label"><i class="codicon codicon-github-inverted"></i> GitHub</span>';
        html += '<span class="status-value">' + (data.platforms.github ? 'Configured' : 'Missing') + '</span>';
        html += '</div>';
        html += '<div class="status-row">';
        html += '<span class="status-label"><i class="codicon codicon-git-merge"></i> GitLab</span>';
        html += '<span class="status-value">' + (data.platforms.gitlab ? 'Configured' : 'Missing') + '</span>';
        html += '</div>';
        html += '</div>';

        html += '<div class="section-title">Review Stats</div>';
        html += '<div class="stats-grid">';
        html += '<div class="stat-box"><div class="stat-number">' + data.stats.total + '</div><div class="stat-label">Total</div></div>';
        html += '<div class="stat-box"><div class="stat-number">' + data.stats.thisWeek + '</div><div class="stat-label">This Week</div></div>';
        html += '<div class="stat-box"><div class="stat-number">' + (data.stats.avgDuration > 0 ? data.stats.avgDuration + 's' : '—') + '</div><div class="stat-label">Avg Duration</div></div>';
        html += '</div>';

        if (data.latest) {
          html += '<div class="section-title">Latest Review</div>';
          html += '<div class="card latest-review">';
          const repoTitle = data.latest.repo || '';
          const repoBasename = basename(data.latest.repo);
          const repoText = data.latest.repo ? (repoBasename + (data.latest.prNumber ? ' #' + data.latest.prNumber : '')) : 'File review';
          html += '<div class="latest-title" title="' + escapeHtml(repoTitle) + '">' + escapeHtml(repoText) + '</div>';
          html += '<div class="latest-summary">' + escapeHtml(data.latest.summary) + '</div>';
          html += '<div class="latest-meta">';
          html += '<span class="risk risk-' + data.latest.riskLevel + '">' + data.latest.riskLevel + '</span>';
          html += '<span>' + data.latest.findingsCount + ' findings</span>';
          html += '</div>';
          html += '</div>';
        }

        html += '<div class="divider"></div>';
        html += '<div class="button-row">';
        html += '<button class="button button-secondary" id="btnSettings">⚙️ Settings</button>';
        html += '<button class="button button-secondary" id="btnHistory">🕒 History</button>';
        html += '</div>';
        html += '<button class="button button-primary" style="width:100%;margin-top:8px;" id="btnPanel">📋 Open Review Panel</button>';

        container.innerHTML = html;

        document.getElementById('btnSettings').addEventListener('click', () => vscode.postMessage({ command: 'openSettings' }));
        document.getElementById('btnHistory').addEventListener('click', () => vscode.postMessage({ command: 'openPanel' }));
        document.getElementById('btnPanel').addEventListener('click', () => vscode.postMessage({ command: 'openPanel' }));
      } catch (err) {
        console.error('[Repovisor ReviewHub] render error', err);
        document.getElementById('content').innerHTML = '<div class="error-state">Failed to render: ' + escapeHtml(err.message) + '</div>';
      }
    }

    function showError(message) {
      document.getElementById('content').innerHTML = '<div class="error-state">' + escapeHtml(message) + '</div>';
    }

    function escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    window.addEventListener('message', (event) => {
      console.log('[Repovisor ReviewHub] message received', event.data);
      const message = event.data;
      if (message.command === 'dashboardData') {
        render(message.data);
      } else if (message.command === 'dashboardError') {
        showError(message.error || 'Dashboard error');
      }
    });

    // Tell extension we're ready
    console.log('[Repovisor ReviewHub] posting ready');
    vscode.postMessage({ command: 'ready' });
  </script>
</body>
</html>`;
    }
}
