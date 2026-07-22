import * as vscode from 'vscode';
import { ReviewService } from '../services/ReviewService';
import { ReviewResult } from '../types';

export class HistoryTreeProvider implements vscode.TreeDataProvider<HistoryItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<HistoryItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private reviewService: ReviewService) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: HistoryItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: HistoryItem): Promise<HistoryItem[]> {
        if (!element) {
            const history = this.reviewService.getReviewHistory(1, 1000);
            const repos = new Map<string, ReviewResult>();
            for (const review of history.reviews) {
                if (review.repo && !repos.has(review.repo)) {
                    repos.set(review.repo, review);
                }
            }
            return Array.from(repos.keys()).map(repo => new HistoryItem(
                repo,
                vscode.TreeItemCollapsibleState.Collapsed,
                'repo'
            ));
        }

        if (element.type === 'repo') {
            const history = this.reviewService.getReviewHistory(1, 1000);
            const prs = new Map<number, ReviewResult>();
            for (const review of history.reviews) {
                if (review.repo === element.label && review.prNumber) {
                    const existing = prs.get(review.prNumber);
                    if (!existing || new Date(review.timestamp) > new Date(existing.timestamp)) {
                        prs.set(review.prNumber, review);
                    }
                }
            }
            return Array.from(prs.entries()).map(([prNumber, review]) => {
                const item = new HistoryItem(
                    `#${prNumber}`,
                    vscode.TreeItemCollapsibleState.None,
                    'pr',
                    review.platform || 'github'
                );
                item.tooltip = new vscode.MarkdownString(
                    `**${review.platform?.toUpperCase() || 'GitHub'}** — ${review.riskLevel.toUpperCase()}\n\n` +
                    `${review.summary}\n\n` +
                    `*${new Date(review.timestamp).toLocaleString()}*`
                );
                item.command = {
                    command: 'repovisor.openPrefilledReview',
                    title: 'Open Review',
                    arguments: [review.repo, review.prNumber, review.platform || 'github']
                };
                return item;
            });
        }

        return [];
    }
}

export class HistoryItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: 'repo' | 'pr',
        public readonly platform?: 'github' | 'gitlab'
    ) {
        super(label, collapsibleState);
        if (type === 'repo') {
            this.iconPath = new vscode.ThemeIcon('repo');
            this.contextValue = 'repo';
        } else if (type === 'pr') {
            this.iconPath = new vscode.ThemeIcon('git-pull-request');
            this.contextValue = 'pr';
            if (platform === 'gitlab') {
                this.iconPath = new vscode.ThemeIcon('git-merge');
            }
        }
    }
}
