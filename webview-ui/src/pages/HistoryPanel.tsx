import { useState, useEffect } from 'react';
import { vscode } from '../App';
import { ResultDisplay } from '../components/ResultDisplay';
import { History, Search, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';

export interface HistoryData {
  reviews: any[];
  total: number;
  page: number;
  perPage: number;
}

interface HistoryPanelProps {
  isSidebarMode?: boolean;
}

export function HistoryPanel({ isSidebarMode }: HistoryPanelProps) {
  const [history, setHistory] = useState<HistoryData>({ reviews: [], total: 0, page: 1, perPage: 10 });
  const [query, setQuery] = useState('');
  const [selectedReview, setSelectedReview] = useState<any | null>(null);

  const loadHistory = (page: number, q: string) => {
    vscode.postMessage({ command: 'getHistory', data: { page, perPage: 10, query: q } });
  };

  useEffect(() => {
    loadHistory(1, query);
    const handler = (event: MessageEvent) => {
      if (event.data.command === 'historyData') setHistory(event.data.data);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadHistory(1, query);
  };

  const totalPages = Math.max(1, Math.ceil(history.total / history.perPage));

  return (
    <div className={`space-y-6 ${isSidebarMode ? '' : 'max-w-2xl'}`}>
      <div>
        <h1 className="section-title flex items-center gap-2">
          <History className="w-6 h-6 text-blue-500" />
          History
        </h1>
        <p className="text-sm opacity-70 mt-1">Past reviews are stored locally in SQLite.</p>
      </div>

      <div className="card space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search repo, summary, findings..."
            className="input-field flex-1"
          />
          <button type="submit" className="btn-primary px-3 py-2 rounded text-sm flex items-center gap-1">
            <Search className="w-4 h-4" /> Search
          </button>
        </form>

        <p className="text-xs opacity-60 flex items-center gap-1">
          <BarChart3 className="w-3.5 h-3.5" /> {history.total} total review(s)
        </p>

        {selectedReview ? (
          <div className="space-y-4">
            <button
              onClick={() => setSelectedReview(null)}
              className="text-sm opacity-70 hover:opacity-100 flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Back to History
            </button>
            <ResultDisplay result={selectedReview} />
          </div>
        ) : history.reviews.length === 0 ? (
          <div className="text-center opacity-60 py-10">
            <History className="w-12 h-12 mx-auto mb-2 text-gray-500" />
            <p>No reviews yet</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {history.reviews.map((item, i) => (
                <div key={item.id || i} onClick={() => setSelectedReview(item)} className="card hover:bg-[var(--vscode-list-hoverBackground)] cursor-pointer transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm flex items-center gap-1">
                      <Search className="w-3.5 h-3.5" />
                      {item.repo ? `${item.repo}#${item.prNumber}` : 'File Review'}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      item.riskLevel === 'critical' ? 'bg-red-600' :
                      item.riskLevel === 'high' ? 'bg-orange-600' :
                      item.riskLevel === 'medium' ? 'bg-yellow-600' : 'bg-green-600'
                    }`}>
                      {item.riskLevel}
                    </span>
                  </div>
                  <p className="text-xs opacity-70 mt-1">{item.summary}</p>
                  <div className="flex gap-3 mt-2 text-xs opacity-50">
                    <span>{item.providerUsed}</span>
                    <span>{item.findings?.length || 0} findings</span>
                    <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                disabled={history.page <= 1}
                onClick={() => loadHistory(history.page - 1, query)}
                className="text-sm px-3 py-1 rounded bg-gray-700 disabled:opacity-40 hover:bg-gray-600 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <span className="text-xs opacity-70">Page {history.page} of {totalPages}</span>
              <button
                disabled={history.page >= totalPages}
                onClick={() => loadHistory(history.page + 1, query)}
                className="text-sm px-3 py-1 rounded bg-gray-700 disabled:opacity-40 hover:bg-gray-600 flex items-center gap-1"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

