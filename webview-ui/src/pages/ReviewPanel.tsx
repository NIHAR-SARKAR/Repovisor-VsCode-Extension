import { useState } from 'react';
import { vscode, ProviderStatus } from '../App';
import { Search, Server, Sparkles, Cpu, AlertTriangle } from 'lucide-react';

interface ReviewPanelProps {
  onReview: (data: any) => void;
  providerStatus: ProviderStatus | null;
  isSidebarMode?: boolean;
  isLoading?: boolean;
}

export function ReviewPanel({ onReview, providerStatus, isSidebarMode, isLoading }: ReviewPanelProps) {
  const [repo, setRepo] = useState('');
  const [prNumber, setPrNumber] = useState('');
  const [platform, setPlatform] = useState<'github' | 'gitlab'>('github');
  const [profile, setProfile] = useState<'fast' | 'standard' | 'deep'>('standard');
  const [autoPost, setAutoPost] = useState(false);

  const activeProvider = providerStatus?.providers.find(p => p.alias === providerStatus?.activeProvider);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProvider) {
      vscode.postMessage({ command: 'getProviderStatus' });
      return;
    }
    onReview({ repo, prNumber: parseInt(prNumber), platform, provider: activeProvider.alias, profile, autoPost });
  };

  return (
    <div className={`space-y-6 ${isSidebarMode ? '' : 'max-w-2xl'}`}>
      <div>
        <h1 className="section-title flex items-center gap-2">
          <Search className="w-6 h-6 text-blue-500" />
          Review
        </h1>
        <p className="text-sm opacity-70 mt-1">Run AI-powered code reviews on pull requests.</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5">
        <div className="subsection-header">
          <Search className="w-4 h-4 text-blue-500" />
          <span>Pull Request Review</span>
        </div>

        {!activeProvider && (
          <div className="p-3 bg-yellow-900/30 border border-yellow-600 rounded text-sm text-yellow-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>No AI provider configured. Go to <strong>Settings</strong> to set one up.</span>
          </div>
        )}

        {activeProvider && (
          <div className="p-2 bg-blue-900/20 rounded text-sm flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-400" />
            <span>Active provider: <strong>{activeProvider.name}</strong></span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setPlatform('github')}
            className={`py-2 rounded text-sm font-medium flex items-center justify-center gap-2 ${platform === 'github' ? 'bg-blue-600' : 'bg-gray-700'}`}>
            <Server className="w-4 h-4" /> GitHub
          </button>
          <button type="button" onClick={() => setPlatform('gitlab')}
            className={`py-2 rounded text-sm font-medium flex items-center justify-center gap-2 ${platform === 'gitlab' ? 'bg-orange-600' : 'bg-gray-700'}`}>
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
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
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
          <Sparkles className="w-4 h-4 text-blue-500" />
          <span>Quick Actions</span>
        </div>
        <div className="space-y-2">
          <button type="button" onClick={() => vscode.postMessage({ command: 'reviewFile' })}
            className="w-full py-2 px-3 bg-gray-700 rounded text-sm hover:bg-gray-600 transition-colors text-left flex items-center gap-2">
            <Search className="w-4 h-4" /> Review Current File
          </button>
          <button type="button" onClick={() => vscode.postMessage({ command: 'reviewSelection' })}
            className="w-full py-2 px-3 bg-gray-700 rounded text-sm hover:bg-gray-600 transition-colors text-left flex items-center gap-2">
            <Search className="w-4 h-4" /> Review Selected Code
          </button>
        </div>
      </div>
    </div>
  );
}
