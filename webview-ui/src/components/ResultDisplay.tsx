import { BarChart3, Sparkles, Check, Send } from 'lucide-react';

export interface ResultDisplayProps {
  result: any;
  isPosting?: boolean;
  onPostReview?: () => void;
}

export function ResultDisplay({ result, isPosting, onPostReview }: ResultDisplayProps) {
  const severityColors = {
    critical: 'bg-red-900/40 border-red-500 text-red-300',
    high: 'bg-orange-900/40 border-orange-500 text-orange-300',
    medium: 'bg-yellow-900/40 border-yellow-500 text-yellow-300',
    low: 'bg-blue-900/40 border-blue-500 text-blue-300'
  };

  const canPost = result.repo && result.prNumber && result.platform;

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-green-500" />
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
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {isPosting ? 'Posting...' : `Post to ${result.platform}`}
              </button>
            )}
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
              result.riskLevel === 'critical' ? 'bg-red-600' :
              result.riskLevel === 'high' ? 'bg-orange-600' :
              result.riskLevel === 'medium' ? 'bg-yellow-600' : 'bg-green-600'
            }`}>
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
          <div key={finding.id || i} className={`card border-l-4 ${
            finding.severity === 'critical' ? 'border-l-red-500' :
            finding.severity === 'high' ? 'border-l-orange-500' :
            finding.severity === 'medium' ? 'border-l-yellow-500' : 'border-l-blue-500'
          }`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold uppercase ${severityColors[finding.severity as keyof typeof severityColors]}`}>
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
              <pre className="mt-3 p-3 bg-black/30 rounded text-xs overflow-x-auto">
                <code>{finding.codeSnippet}</code>
              </pre>
            )}

            {finding.suggestion && (
              <div className="mt-3 p-3 bg-green-900/20 border border-green-700/50 rounded">
                <p className="text-xs font-semibold text-green-400 mb-1 flex items-center gap-1">
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
            <Check className="w-12 h-12 text-green-500" />
          </div>
          <p>No issues found!</p>
        </div>
      )}
    </div>
  );
}
