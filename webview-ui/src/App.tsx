import { useState, useEffect, useCallback } from 'react';
import { ReviewPanel } from './pages/ReviewPanel';
import { HistoryPanel } from './pages/HistoryPanel';
import { SettingsPanel } from './pages/SettingsPanel';
import { ResultDisplay } from './components/ResultDisplay';
import { Search, History, Settings, BarChart3, Check, AlertTriangle, X, Sparkles } from 'lucide-react';

declare const acquireVsCodeApi: () => {
  postMessage: (msg: any) => void;
  getState: () => any;
  setState: (state: any) => void;
};

export const vscode = acquireVsCodeApi();

export interface CustomHeader {
  key: string;
  value: string;
}

export interface ProviderInfo {
  alias: string;
  name: string;
  configured: boolean;
  active: boolean;
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  endpoint?: string;
  deployment?: string;
  apiVersion?: string;
  useBearerAuth?: boolean;
  customHeaders?: Record<string, string>;
  supportsCustomEndpoint?: boolean;
}

export interface ProviderStatus {
  activeProvider: string;
  providers: ProviderInfo[];
}

export interface PlatformTokens {
  githubToken: string;
  gitlabToken: string;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

const isSidebarMode = window.location.search.includes('mode=sidebar');

const navItems = [
  { id: 'review', label: 'Review', icon: Search },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function App() {
  const [activeSection, setActiveSection] = useState('review');
  const [reviewResult, setReviewResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [platformTokens, setPlatformTokens] = useState<PlatformTokens>({ githubToken: '', gitlabToken: '' });
  const [providerTest, setProviderTest] = useState<{ success: boolean; message?: string; error?: string } | null>(null);
  const [postReviewLoading, setPostReviewLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: Toast['type'], message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    vscode.postMessage({ command: 'getProviderStatus' });
    vscode.postMessage({ command: 'getPlatformTokens' });
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.command) {
        case 'reviewComplete':
          setReviewResult(message.data);
          setIsLoading(false);
          setActiveSection('results');
          showToast('success', `Review complete: ${message.data.findings?.length || 0} findings`);
          break;
        case 'reviewError':
          setError(message.error);
          setIsLoading(false);
          showToast('error', message.error);
          break;
        case 'showPRResult':
          setReviewResult(message.data.result);
          setActiveSection('results');
          break;
        case 'showFileResult':
          setReviewResult(message.data.result);
          setActiveSection('results');
          break;
        case 'showSelectionResult':
          setReviewResult(message.data.result);
          setActiveSection('results');
          break;
        case 'historyData':
          // handled by HistoryPanel
          break;
        case 'providerStatus':
          setProviderStatus(message.data);
          setProviderTest(null);
          break;
        case 'platformTokensData':
          setPlatformTokens(message.data || { githubToken: '', gitlabToken: '' });
          break;
        case 'providerSaved':
          showToast('success', 'Provider configuration saved');
          setError(null);
          vscode.postMessage({ command: 'getProviderStatus' });
          break;
        case 'providerSaveError':
          showToast('error', message.error);
          break;
        case 'providerTestResult':
          setProviderTest({ success: message.success, message: message.message, error: message.error });
          if (message.success) {
            showToast('success', message.message || 'Connection successful');
          } else {
            showToast('error', message.error || 'Connection test failed');
          }
          break;
        case 'configSaved':
          showToast('success', 'Platform tokens saved');
          vscode.postMessage({ command: 'getPlatformTokens' });
          break;
        case 'postReviewSuccess':
          setPostReviewLoading(false);
          showToast('success', 'Review posted successfully');
          break;
        case 'postReviewError':
          setPostReviewLoading(false);
          showToast('error', message.error);
          break;
        case 'configError':
          showToast('error', message.error);
          break;
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [showToast]);

  const showResultsNav = !!reviewResult;

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className={`flex flex-col text-[var(--vscode-foreground)] bg-[var(--vscode-editor-background)] ${isSidebarMode ? 'h-full' : 'h-screen'}`}>
      {/* Top tab bar */}
      <nav className="flex items-center border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)] px-2">
        <div className="flex items-center gap-1 py-1.5">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-all ${
                  activeSection === item.id
                    ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
                    : 'hover:bg-[var(--vscode-list-hoverBackground)] opacity-80'
                }`}
              >
                <Icon className="w-4 h-4 text-blue-500" />
                <span>{item.label}</span>
              </button>
            );
          })}
          {showResultsNav && (
            <button
              onClick={() => setActiveSection('results')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-all ${
                activeSection === 'results'
                  ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
                  : 'hover:bg-[var(--vscode-list-hoverBackground)] opacity-80'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-green-500" />
              <span>Results</span>
            </button>
          )}
        </div>
      </nav>

      {/* Main content area */}
      <main className={`flex-1 overflow-auto ${isSidebarMode ? 'p-3' : 'p-5'}`}>
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500 rounded text-red-300 text-sm flex items-start justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-2 text-sm"><X className="w-4 h-4" /></button>
          </div>
        )}

        {activeSection === 'review' && (
          <ReviewPanel
            isSidebarMode={isSidebarMode}
            providerStatus={providerStatus}
            isLoading={isLoading}
            onReview={(data) => { setIsLoading(true); setError(null); vscode.postMessage({ command: 'review', data }); }}
          />
        )}

        {activeSection === 'results' && reviewResult && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setActiveSection('review')} className="text-sm opacity-70 hover:opacity-100 flex items-center gap-1">
                ← Back to Review
              </button>
            </div>
            <ResultDisplay
              result={reviewResult}
              isPosting={postReviewLoading}
              onPostReview={() => {
                setPostReviewLoading(true);
                vscode.postMessage({ command: 'postReview', data: reviewResult });
              }}
            />
          </div>
        )}

        {activeSection === 'history' && <HistoryPanel isSidebarMode={isSidebarMode} />}

        {activeSection === 'settings' && (
          <SettingsPanel
            isSidebarMode={isSidebarMode}
            providerStatus={providerStatus}
            platformTokens={platformTokens}
            onTest={(data) => { setProviderTest(null); vscode.postMessage({ command: 'testProvider', data }); }}
            onSave={(data) => { setProviderTest(null); vscode.postMessage({ command: 'setActiveProvider', data }); }}
            onSavePlatformTokens={(data) => vscode.postMessage({ command: 'updateConfig', data })}
            testResult={providerTest}
            onDone={() => setActiveSection('review')}
          />
        )}
      </main>

      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-2 px-4 py-3 rounded shadow-lg text-sm min-w-[240px] max-w-[400px] animate-in slide-in-from-right ${
              toast.type === 'success' ? 'bg-green-800/90 text-green-100 border border-green-600' :
              toast.type === 'error' ? 'bg-red-800/90 text-red-100 border border-red-600' :
              'bg-blue-800/90 text-blue-100 border border-blue-600'
            }`}
          >
            {toast.type === 'success' ? <Check className="w-5 h-5 flex-shrink-0 text-green-300" /> :
             toast.type === 'error' ? <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-300" /> :
             <Sparkles className="w-5 h-5 flex-shrink-0 text-blue-300" />}
            <span className="flex-1">{toast.message}</span>
            <button onClick={() => dismissToast(toast.id)} className="flex-shrink-0 opacity-70 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
