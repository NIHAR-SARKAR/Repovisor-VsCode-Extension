import { BarChart3, Sparkles, Check, Send } from 'lucide-react';

export interface ResultDisplayProps {
  result: any;
  isPosting?: boolean;
  onPostReview?: () => void;
}

const severityColors: Record<string, string> = {
  critical: 'bg-[var(--vscode-inputValidation-errorBackground)] border-[var(--vscode-inputValidation-errorBorder)] text-[var(--vscode-inputValidation-errorForeground)]',
  high: 'bg-[var(--vscode-inputValidation-warningBackground)] border-[var(--vscode-inputValidation-warningBorder)] text-[var(--vscode-inputValidation-warningForeground)]',
  medium: 'bg-[var(--vscode-inputValidation-infoBackground)] border-[var(--vscode-inputValidation-infoBorder)] text-[var(--vscode-inputValidation-infoForeground)]',
  low: '',
};

const severityBorderColors: Record<string, string> = {
  critical: 'border-l-[var(--vscode-inputValidation-errorBorder)]',
  high: 'border-l-[var(--vscode-inputValidation-warningBorder)]',
  medium: 'border-l-[var(--vscode-inputValidation-infoBorder)]',
  low: 'border-l-[var(--vscode-charts-blue)]',
};

const riskBadgeStyle: Record<string, string> = {
  critical: 'bg-[var(--vscode-inputValidation-errorBackground)] border border-[var(--vscode-inputValidation-errorBorder)] text-[var(--vscode-inputValidation-errorForeground)]',
  high: 'bg-[var(--vscode-inputValidation-warningBackground)] border border-[var(--vscode-inputValidation-warningBorder)] text-[var(--vscode-inputValidation-warningForeground)]',
  medium: 'bg-[var(--vscode-inputValidation-infoBackground)] border border-[var(--vscode-inputValidation-infoBorder)] text-[var(--vscode-inputValidation-infoForeground)]',
  low: 'border border-[var(--vscode-input-border)]',
};

export function ResultDisplay({ result, isPosting, onPostReview }: ResultDisplayProps) {
  const canPost = result.repo && result.prNumber && result.platform;

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[var(--vscode-charts-green)]" />
            Review Results
          </h2>
          <div className="flex items-center gap-2">
            {canPost && onPostReview && (
              <button
                onClick={onPostReview}
                disabled={isPosting}
                className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-50"
              >
                {isPosting ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[var(--vscode-button-foreground)]" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {isPosting ? 'Posting...' : `Post to ${result.platform}`}
              </button>
            )}
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${riskBadgeStyle[result.riskLevel] || riskBadgeStyle.low}`}>
              {result.riskLevel}
            </span>
          </div>
        </div>
        <p className="text-sm mt-2 opacity-80">{result.summary}</p>
        <div className="flex gap-4 mt-3 text-xs opacity-70">
          <span>Provider: {result.providerUsed}</span>
          <span>Model: {result.modelUsed}</span>
          <span>Duration: {(result.duration / 1000).toFixed(1)}s</span>
        </div>
      </div>

      <div className="space-y-3">
        {result.findings?.map((finding: any, i: number) => (
          <div key={finding.id || i} className={`card border-l-4 ${severityBorderColors[finding.severity] || severityBorderColors.low}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded ${severityColors[finding.severity] || severityColors.low}`}>
                    {finding.severity}
                  </span>
                  <span className="text-xs opacity-60 uppercase">{finding.category}</span>
                  <span className="text-xs opacity-60">{(finding.confidence * 100).toFixed(0)}% confidence</span>
                </div>
                <p className="font-medium">{finding.message}</p>
                <p className="text-sm mt-1 opacity-80">{finding.filePath}:{finding.lineStart}</p>
              </div>
            </div>

            {finding.codeSnippet && (
              <pre className="mt-3 p-3 bg-[var(--vscode-editor-inactiveSelectionBackground)] rounded text-xs overflow-x-auto">
                <code>{finding.codeSnippet}</code>
              </pre>
            )}

            {finding.suggestion && (
              <div className="mt-3 p-3 border rounded bg-[var(--vscode-inputValidation-infoBackground)] border-[var(--vscode-inputValidation-infoBorder)] text-[var(--vscode-inputValidation-infoForeground)]">
                <p className="text-xs font-semibold mb-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Suggestion
                </p>
                <p className="text-sm">{finding.suggestion}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {result.findings?.length === 0 && (
        <div className="text-center py-10 opacity-60">
          <div className="flex justify-center mb-2">
            <Check className="w-12 h-12 text-[var(--vscode-testing-iconPassed)]" />
          </div>
          <p>No issues found!</p>
        </div>
      )}
    </div>
  );
}