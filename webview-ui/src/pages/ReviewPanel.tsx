import { useState, useEffect } from 'react';
import { vscode, ProviderStatus } from '../App';
import { Search, Server, Sparkles, Cpu, AlertTriangle } from 'lucide-react';

interface PrefillData {
  repo: string;
  prNumber: number;
  platform: 'github' | 'gitlab';
}

interface ReviewPanelProps {
  onReview: (data: any) => void;
  providerStatus: ProviderStatus | null;
  isSidebarMode?: boolean;
  isLoading?: boolean;
  prefillData?: PrefillData | null;
  onPrefillApplied?: () => void;
}

export function ReviewPanel({ onReview, providerStatus, isSidebarMode, isLoading, prefillData, onPrefillApplied }: ReviewPanelProps) {
  const [repo, setRepo] = useState('');
  const [prNumber, setPrNumber] = useState('');
  const [platform, setPlatform] = useState<'github' | 'gitlab'>('github');
  const [profile, setProfile] = useState<'fast' | 'standard' | 'deep'>('standard');
  const [autoPost, setAutoPost] = useState(false);

  useEffect(() => {
    if (prefillData) {
      setRepo(prefillData.repo);
      setPrNumber(String(prefillData.prNumber));
      setPlatform(prefillData.platform);
      onPrefillApplied?.();
    }
  }, [prefillData, onPrefillApplied]);

  const activeProvider = providerStatus?.providers.find(p => p.alias === providerStatus?.activeProvider);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProvider) {
      vscode.postMessage({ command: 'getProviderStatus' });
      return;
    }
    onReview({ repo, prNumber: parseInt(prNumber), platform, provider: activeProvider.alias, profile, autoPost });
  };

  const buttonBase = 'py-2 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors';
  const activePlatformClass = 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]';
  const inactivePlatformClass = 'bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]';

  return (
    <div className={`space-y-6 ${isSidebarMode ? '' : 'max-w-2xl'}`}>
      <div>
        <h1 className="section-title flex items-center gap-2">
          <Search className="w-6 h-6 text-[var(--vscode-button-background)]" />
          Review
        </h1>
        <p className="text-sm opacity-70 mt-1">Run AI-powered code reviews on pull requests.</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5">
        <div className="subsection-header">
          <Search className="w-4 h-4 text-[var(--vscode-button-background)]" />
          <span>Pull Request Review</span>
        </div>

        {!activeProvider && (
          <div className="p-3 border rounded text-sm flex items-start gap-2 bg-[var(--vscode-inputValidation-warningBackground)] border-[var(--vscode-inputValidation-warningBorder)] text-[var(--vscode-inputValidation-warningForeground)]">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>No AI provider configured. Go to <strong>Settings</strong> to set one up.</span>
          </div>
        )}

        {activeProvider && (
          <div className="p-2 rounded text-sm flex items-center gap-2 bg-[var(--vscode-editor-inactiveSelectionBackground)]">
            <Cpu className="w-4 h-4 text-[var(--vscode-button-background)]" />
            <span>Active provider: <strong>{activeProvider.name}</strong></span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setPlatform('github')}
            className={`${buttonBase} ${platform === 'github' ? activePlatformClass : inactivePlatformClass}`}>
            <Server className="w-4 h-4" /> GitHub
          </button>
          <button type="button" onClick={() => setPlatform('gitlab')}
            className={`${buttonBase} ${platform === 'gitlab' ? activePlatformClass : inactivePlatformClass}`}>
            <Server className="w-4 h-4" /> GitLab
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="form-label">Repository (owner/repo)</label>
            <input type="text" value={repo} onChange={e => setRepo(e.target.value)}
              placeholder="facebook/react" className="input-field" required />
          </div>

          <div>
            <label className="form-label">PR/MR Number</label>
            <input type="number" value={prNumber} onChange={e => setPrNumber(e.target.value)}
              placeholder="42" className="input-field" required />
          </div>

          <div>
            <label className="form-label">Review Profile</label>
            <select value={profile} onChange={e => setProfile(e.target.value as any)} className="select-field">
              <option value="fast">Fast (~10s, critical only)</option>
              <option value="standard">Standard (~30s, balanced)</option>
              <option value="deep">Deep (~2min, exhaustive)</option>
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={autoPost} onChange={e => setAutoPost(e.target.checked)} className="checkbox" />
            <span className="text-sm">Auto-post review comments to {platform}</span>
          </label>
        </div>

        <button type="submit" className="btn-primary w-full py-2 rounded text-sm flex items-center justify-center gap-2" disabled={!activeProvider || isLoading}>
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--vscode-button-foreground)]" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> Start Review
            </>
          )}
        </button>
      </form>

      <div className="card space-y-3">
        <div className="subsection-header">
          <Sparkles className="w-4 h-4 text-[var(--vscode-button-background)]" />
          <span>Quick Actions</span>
        </div>
        <div className="space-y-2">
          <button type="button" onClick={() => vscode.postMessage({ command: 'reviewFile' })}
            className="w-full py-2 px-3 rounded text-sm transition-colors text-left flex items-center gap-2 bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]">
            <Search className="w-4 h-4" /> Review Current File
          </button>
          <button type="button" onClick={() => vscode.postMessage({ command: 'reviewSelection' })}
            className="w-full py-2 px-3 rounded text-sm transition-colors text-left flex items-center gap-2 bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]">
            <Search className="w-4 h-4" /> Review Selected Code
          </button>
        </div>
      </div>
    </div>
  );
}