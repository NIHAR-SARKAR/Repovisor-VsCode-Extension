import * as vscode from 'vscode';
import { ConfigService } from '../services/ConfigService';
import { Logger } from '../utils/logger';
import { execSync } from 'child_process';

export class QuickActionsProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'repovisor.quickActions';
    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;
    private _configService: ConfigService;

    constructor(extensionUri: vscode.Uri, configService: ConfigService) {
        this._extensionUri = extensionUri;
        this._configService = configService;
    }

    resolveWebviewView(webviewView: vscode.WebviewView) {
        try {
            Logger.getInstance().info('QuickActionsProvider', 'resolveWebviewView called');
            this._view = webviewView;
            webviewView.webview.options = {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'codicons', 'dist')]
            };
            webviewView.webview.html = this._getHtml(webviewView.webview);

            webviewView.webview.onDidReceiveMessage(async message => {
                Logger.getInstance().debug('QuickActionsProvider', `Received command ${message?.command}`);
                switch (message.command) {
                    case 'reviewFile':
                        vscode.commands.executeCommand('repovisor.reviewCurrentFile');
                        break;
                    case 'reviewSelection':
                        vscode.commands.executeCommand('repovisor.reviewSelection');
                        break;
                    case 'openPanel':
                        vscode.commands.executeCommand('repovisor.openPanel');
                        break;
                    case 'prefillReview': {
                        const repo = this._getCurrentRepo();
                        if (repo) {
                            vscode.commands.executeCommand('repovisor.openPanel');
                            setTimeout(() => {
                                const panel = require('./RepovisorPanel').RepovisorPanel.currentPanel;
                                panel?.showReviewForm(repo, 0, 'github');
                            }, 300);
                        } else {
                            vscode.commands.executeCommand('repovisor.openPanel');
                        }
                        break;
                    }
                    case 'setAutoPost': {
                        const config = vscode.workspace.getConfiguration('repovisor');
                        await config.update('autoPostComments', message.value, true);
                        this._sendAutoPostState();
                        break;
                    }
                    case 'getAutoPost':
                    case 'ready':
                        this._sendAutoPostState();
                        break;
                    case 'refreshHistory':
                        vscode.commands.executeCommand('repovisor.refreshHistory');
                        break;
                }
            });

            this._sendAutoPostState();
            const interval = setInterval(() => {
                if (!this._view) {
                    clearInterval(interval);
                    return;
                }
                this._sendAutoPostState();
            }, 1000);
            setTimeout(() => clearInterval(interval), 10000);
        } catch (error) {
            Logger.getInstance().error('QuickActionsProvider', 'resolveWebviewView failed', error);
            vscode.window.showErrorMessage(`Repovisor Quick Actions failed to load: ${error}`);
        }
    }

    private _sendAutoPostState(): void {
        const autoPost = this._configService.getAutoPost();
        Logger.getInstance().debug('QuickActionsProvider', 'Sending autoPostState: ' + autoPost);
        this._view?.webview.postMessage({ command: 'autoPostState', value: autoPost });
    }

    private _getCurrentRepo(): string | undefined {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) { return undefined; }
        try {
            const remote = execSync('git remote get-url origin', {
                cwd: folder.uri.fsPath,
                encoding: 'utf8',
                timeout: 3000
            }).trim();
            const match = remote.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
            if (match) {
                return `${match[1]}/${match[2]}`;
            }
        } catch {
            // ignore
        }
        return folder.name;
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
      padding: 18px 16px 12px;
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
      margin: 16px 0 8px;
    }
    .section-title:first-child {
      margin-top: 0;
    }
    .button {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 6px 10px;
      margin-bottom: 6px;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      text-align: left;
      font-size: 12px;
      line-height: 1.4;
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
    .row-button {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 6px 10px;
      margin-bottom: 6px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      line-height: 1.4;
      transition: background-color 0.15s;
    }
    .row-button:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .row-button-content {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 28px;
      height: 16px;
      flex-shrink: 0;
    }
    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: var(--vscode-checkbox-background);
      border: 1px solid var(--vscode-checkbox-border);
      transition: .2s;
      border-radius: 16px;
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 10px;
      width: 10px;
      left: 2px;
      bottom: 2px;
      background-color: var(--vscode-button-foreground);
      transition: .2s;
      border-radius: 50%;
    }
    input:checked + .slider {
      background-color: var(--vscode-button-background);
      border-color: var(--vscode-button-background);
    }
    input:checked + .slider:before {
      transform: translateX(12px);
    }
    .divider {
      height: 1px;
      background: var(--vscode-panel-border);
      margin: 14px 0;
    }
  </style>
</head>
<body>
  <div class="section-title">Actions</div>
  <button class="button button-primary" id="startReview">
    <i class="codicon codicon-rocket"></i> Start Review
  </button>
  <button class="button button-primary" id="reviewFile">
    <i class="codicon codicon-file-code"></i> Review Current File
  </button>
  <button class="button button-secondary" id="reviewSelection">
    <i class="codicon codicon-selection"></i> Review Selected Code
  </button>

  <div class="divider"></div>

  <div class="section-title">Options</div>
  <label class="row-button" for="autoPost">
    <span class="row-button-content">
      <i class="codicon codicon-comment-discussion"></i> Auto-post comments
    </span>
    <span class="toggle-switch">
      <input type="checkbox" id="autoPost">
      <span class="slider"></span>
    </span>
  </label>

  <div class="divider"></div>

  <button class="button button-secondary" id="refreshHistory">
    <i class="codicon codicon-refresh"></i> Refresh History
  </button>

  <script>
    console.log('[Repovisor QuickActions] script start');
    const vscode = acquireVsCodeApi();
    console.log('[Repovisor QuickActions] vscode api acquired');

    let stateReceived = false;

    document.getElementById('reviewFile').addEventListener('click', () => {
      vscode.postMessage({ command: 'reviewFile' });
    });
    document.getElementById('reviewSelection').addEventListener('click', () => {
      vscode.postMessage({ command: 'reviewSelection' });
    });
    document.getElementById('startReview').addEventListener('click', () => {
      vscode.postMessage({ command: 'prefillReview' });
    });
    document.getElementById('refreshHistory').addEventListener('click', () => {
      vscode.postMessage({ command: 'refreshHistory' });
    });

    const autoPostCheckbox = document.getElementById('autoPost');
    autoPostCheckbox.addEventListener('change', (e) => {
      vscode.postMessage({ command: 'setAutoPost', value: e.target.checked });
    });

    window.addEventListener('message', (event) => {
      console.log('[Repovisor QuickActions] message received', event.data);
      const message = event.data;
      if (message.command === 'autoPostState') {
        stateReceived = true;
        autoPostCheckbox.checked = message.value;
      }
    });

    console.log('[Repovisor QuickActions] posting ready');
    vscode.postMessage({ command: 'ready' });
  </script>
</body>
</html>`;
    }
}
