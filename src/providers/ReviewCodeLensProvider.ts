import * as vscode from 'vscode';

export class ReviewCodeLensProvider implements vscode.CodeLensProvider {
    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        const lenses: vscode.CodeLens[] = [];
        const topRange = new vscode.Range(0, 0, 0, 0);
        lenses.push(new vscode.CodeLens(topRange, {
            title: '$(eye) Repovisor: Review File',
            command: 'repovisor.reviewCurrentFile',
            tooltip: 'Review this file with AI'
        }));
        return lenses;
    }
}
