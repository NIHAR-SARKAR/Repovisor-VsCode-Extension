import * as vscode from 'vscode';
import { RepovisorPanel } from './panels/RepovisorPanel';
import { ReviewService } from './services/ReviewService';
import { ConfigService } from './services/ConfigService';
import { HistoryService, IHistoryService } from './services/HistoryService';
import { MemoryHistoryService } from './services/MemoryHistoryService';
import { GitHubService } from './github/GitHubService';
import { GitLabService } from './gitlab/GitLabService';
import { SidebarProvider } from './panels/SidebarProvider';
import { HistoryTreeProvider } from './panels/HistoryTreeProvider';
import { QuickActionsProvider } from './panels/QuickActionsProvider';
import { ReviewCodeLensProvider } from './providers/ReviewCodeLensProvider';
import { Logger } from './utils/logger';

let reviewService: ReviewService;
let sidebarProvider: SidebarProvider;
let historyTreeProvider: HistoryTreeProvider;
let historyService: IHistoryService;

export function activate(context: vscode.ExtensionContext) {
    Logger.initialize(context);
    const logger = Logger.getInstance();
    logger.info('Extension', 'Repovisor AI extension activated');

    const configService = new ConfigService();
    try {
        historyService = new HistoryService(context.globalStorageUri);
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.error('Failed to initialize SQLite history:', reason);
        vscode.window.showWarningMessage(
            `Repovisor AI: SQLite history unavailable (${reason}). Reviews will be stored in memory only until reload.`
        );
        historyService = new MemoryHistoryService();
    }
    const githubService = new GitHubService(configService);
    const gitlabService = new GitLabService(configService);
    reviewService = new ReviewService(configService, historyService, githubService, gitlabService);

    sidebarProvider = new SidebarProvider(context.extensionUri, reviewService, configService);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'repovisorSidebar',
            sidebarProvider,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    historyTreeProvider = new HistoryTreeProvider(reviewService);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('repovisor.history', historyTreeProvider)
    );

    const quickActionsProvider = new QuickActionsProvider(context.extensionUri, configService);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'repovisor.quickActions',
            quickActionsProvider,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    const codeLensProvider = new ReviewCodeLensProvider();
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
            { pattern: '**/*' },
            codeLensProvider
        )
    );

    const openPanelCmd = vscode.commands.registerCommand('repovisor.openPanel', () => {
        RepovisorPanel.createOrShow(context.extensionUri, reviewService, configService);
    });

    const openCodeReviewerCmd = vscode.commands.registerCommand('repovisor.openCodeReviewer', () => {
        RepovisorPanel.createOrShow(context.extensionUri, reviewService, configService);
    });

    const reviewFileCmd = vscode.commands.registerCommand('repovisor.reviewCurrentFile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor found');
            return;
        }
        const document = editor.document;
        const content = document.getText();
        const fileName = document.fileName.split('/').pop() || document.fileName;

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Reviewing ${fileName}...`,
            cancellable: true
        }, async (progress, token) => {
            try {
                const result = await reviewService.reviewCode(content, fileName, {
                    profile: configService.getDefaultProfile()
                });

                if (result.findings.length === 0) {
                    vscode.window.showInformationMessage(`✅ No issues found in ${fileName}`);
                    return;
                }

                RepovisorPanel.createOrShow(context.extensionUri, reviewService, configService);
                RepovisorPanel.currentPanel?.showFileReviewResult(result, fileName);

                const severityCount = result.findings.reduce((acc, f) => {
                    acc[f.severity] = (acc[f.severity] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);

                const summary = Object.entries(severityCount)
                    .map(([sev, count]) => `${count} ${sev}`)
                    .join(', ');

                vscode.window.showInformationMessage(
                    `🔍 Found ${result.findings.length} issues in ${fileName}: ${summary}`
                );
            } catch (error) {
                vscode.window.showErrorMessage(`Review failed: ${error}`);
            }
        });
    });

    const reviewSelectionCmd = vscode.commands.registerCommand('repovisor.reviewSelection', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showWarningMessage('No code selected');
            return;
        }
        const selection = editor.document.getText(editor.selection);
        const fileName = editor.document.fileName.split('/').pop() || 'selection';

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Reviewing selected code...',
            cancellable: true
        }, async () => {
            try {
                const result = await reviewService.reviewCode(selection, fileName, {
                    profile: configService.getDefaultProfile()
                });

                RepovisorPanel.createOrShow(context.extensionUri, reviewService, configService);
                RepovisorPanel.currentPanel?.showSelectionReviewResult(result, selection);

                vscode.window.showInformationMessage(
                    `🔍 Found ${result.findings.length} issues in selection`
                );
            } catch (error) {
                vscode.window.showErrorMessage(`Review failed: ${error}`);
            }
        });
    });

    const refreshHistoryCmd = vscode.commands.registerCommand('repovisor.refreshHistory', () => {
        historyTreeProvider.refresh();
    });

    const openPrefilledReviewCmd = vscode.commands.registerCommand('repovisor.openPrefilledReview', (repo: string, prNumber: number, platform: 'github' | 'gitlab') => {
        RepovisorPanel.createOrShow(context.extensionUri, reviewService, configService);
        RepovisorPanel.currentPanel?.showReviewForm(repo, prNumber, platform);
    });

    const quickReviewCmd = vscode.commands.registerCommand('repovisor.quickReview', async () => {
        const repoInput = await vscode.window.showInputBox({
            prompt: 'Enter repository (owner/repo)',
            placeHolder: 'facebook/react',
            validateInput: (value) => {
                if (!value || !value.includes('/')) {
                    return 'Please enter in format: owner/repo';
                }
                return null;
            }
        });
        if (!repoInput) return;

        const prInput = await vscode.window.showInputBox({
            prompt: 'Enter PR number',
            placeHolder: '42',
            validateInput: (value) => {
                if (!value || isNaN(parseInt(value))) {
                    return 'Please enter a valid PR number';
                }
                return null;
            }
        });
        if (!prInput) return;

        const platform = await vscode.window.showQuickPick(
            ['GitHub', 'GitLab'],
            { placeHolder: 'Select platform' }
        );
        if (!platform) return;

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Reviewing PR #${prInput}...`,
            cancellable: true
        }, async (progress) => {
            try {
                progress.report({ increment: 10, message: 'Fetching PR diff...' });
                const result = await reviewService.reviewPullRequest(
                    repoInput,
                    parseInt(prInput),
                    platform.toLowerCase() as 'github' | 'gitlab',
                    {
                        profile: configService.getDefaultProfile(),
                        autoPost: configService.getAutoPost()
                    }
                );

                progress.report({ increment: 90, message: 'Rendering results...' });
                RepovisorPanel.createOrShow(context.extensionUri, reviewService, configService);
                RepovisorPanel.currentPanel?.showPRReviewResult(result, repoInput, parseInt(prInput));

                vscode.window.showInformationMessage(
                    `✅ PR #${prInput} review complete: ${result.findings.length} findings`
                );
                historyTreeProvider.refresh();
            } catch (error) {
                vscode.window.showErrorMessage(`PR review failed: ${error}`);
            }
        });
    });

    context.subscriptions.push(
        openPanelCmd,
        openCodeReviewerCmd,
        reviewFileCmd,
        reviewSelectionCmd,
        quickReviewCmd,
        refreshHistoryCmd,
        openPrefilledReviewCmd
    );

    vscode.commands.executeCommand('setContext', 'repovisor:enabled', true);

    const config = vscode.workspace.getConfiguration('repovisor');
    if (!config.get('githubToken') && !config.get('gitlabToken')) {
        vscode.window.showWarningMessage(
            'Repovisor AI: Please configure your GitHub/GitLab token in settings',
            'Open Settings'
        ).then(selection => {
            if (selection === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'repovisor');
            }
        });
    }

    if (!configService.getActiveProvider()) {
        vscode.window.showWarningMessage(
            'Repovisor AI: Please configure an AI provider in the Repovisor panel',
            'Open Repovisor'
        ).then(selection => {
            if (selection === 'Open Repovisor') {
                vscode.commands.executeCommand('repovisor.openPanel');
            }
        });
    }
}

export function deactivate() {
    console.log('Repovisor AI extension deactivated');
    historyService?.close();
}
