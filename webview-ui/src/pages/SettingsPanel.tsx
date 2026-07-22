import { useState, useEffect } from 'react';
import { ProviderStatus, CustomHeader, PlatformTokens } from '../App';
import { Settings, Server, AlertTriangle, Key, Check, Plus, Trash2 } from 'lucide-react';

interface SettingsPanelProps {
  providerStatus: ProviderStatus | null;
  platformTokens: PlatformTokens;
  onTest: (data: any) => void;
  onSave: (data: any) => void;
  onSavePlatformTokens: (data: PlatformTokens) => void;
  testResult: { success: boolean; message?: string; error?: string } | null;
  isSidebarMode?: boolean;
  onDone?: () => void;
}

interface ProviderFormState {
  apiKey: string;
  baseUrl: string;
  model: string;
  endpoint: string;
  deployment: string;
  apiVersion: string;
  useBearerAuth: boolean;
  setApiVersion: boolean;
  useAzureIdentity: boolean;
  customHeaders: CustomHeader[];
}

export function SettingsPanel({
  providerStatus,
  platformTokens,
  onTest,
  onSave,
  onSavePlatformTokens,
  testResult,
  isSidebarMode,
  onDone
}: SettingsPanelProps) {
  const [selectedAlias, setSelectedAlias] = useState('');
  const [form, setForm] = useState<ProviderFormState>({
    apiKey: '',
    baseUrl: '',
    model: '',
    endpoint: '',
    deployment: 'gpt-4o',
    apiVersion: '2024-12-01-preview',
    useBearerAuth: false,
    setApiVersion: false,
    useAzureIdentity: false,
    customHeaders: []
  });
  const [localTokens, setLocalTokens] = useState<PlatformTokens>({ githubToken: '', gitlabToken: '' });
  const [tokensSaved, setTokensSaved] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);

  useEffect(() => {
    if (providerStatus) {
      setSelectedAlias(providerStatus.activeProvider || '');
    }
  }, [providerStatus]);

  useEffect(() => {
    if (providerStatus && selectedAlias) {
      const provider = providerStatus.providers.find(p => p.alias === selectedAlias);
      if (provider) {
        const headers = Object.entries(provider.customHeaders || {}).map(([key, value]) => ({ key, value }));
        setForm({
          apiKey: provider.apiKey || '',
          baseUrl: provider.baseUrl || '',
          model: provider.defaultModel || '',
          endpoint: provider.endpoint || '',
          deployment: provider.deployment || 'gpt-4o',
          apiVersion: provider.apiVersion || '2024-12-01-preview',
          useBearerAuth: provider.useBearerAuth || false,
          setApiVersion: !!provider.apiVersion,
          useAzureIdentity: false,
          customHeaders: headers.length ? headers : [{ key: '', value: '' }]
        });
        setApiKeySaved(!!provider.apiKey);
      }
    }
  }, [selectedAlias]);

  useEffect(() => {
    setLocalTokens(platformTokens);
  }, [platformTokens]);

  const selectedProvider = providerStatus?.providers.find(p => p.alias === selectedAlias);
  const isAzure = selectedAlias === 'azure';
  const isOpenAICompatible = selectedProvider?.supportsCustomEndpoint || false;

  const updateForm = (patch: Partial<ProviderFormState>) => {
    setForm(prev => ({ ...prev, ...patch }));
  };

  const handleSave = () => {
    if (!selectedAlias) return;
    const customHeaders: Record<string, string> = {};
    form.customHeaders.forEach(h => {
      if (h.key.trim()) {
        customHeaders[h.key.trim()] = h.value;
      }
    });
    onSave({
      alias: selectedAlias,
      apiKey: form.apiKey,
      baseUrl: isAzure ? (form.endpoint || form.baseUrl) : form.baseUrl,
      model: form.model,
      endpoint: isAzure ? form.endpoint : undefined,
      deployment: isAzure ? form.deployment : undefined,
      apiVersion: isAzure && form.setApiVersion ? form.apiVersion : undefined,
      useBearerAuth: isAzure ? form.useBearerAuth : undefined,
      customHeaders
    });
  };

  const handleTest = () => {
    if (!selectedAlias) return;
    const customHeaders: Record<string, string> = {};
    form.customHeaders.forEach(h => {
      if (h.key.trim()) {
        customHeaders[h.key.trim()] = h.value;
      }
    });
    onTest({
      alias: selectedAlias,
      apiKey: form.apiKey,
      baseUrl: isAzure ? (form.endpoint || form.baseUrl) : form.baseUrl,
      endpoint: isAzure ? form.endpoint : undefined,
      deployment: isAzure ? form.deployment : undefined,
      apiVersion: isAzure && form.setApiVersion ? form.apiVersion : undefined,
      useBearerAuth: isAzure ? form.useBearerAuth : undefined,
      customHeaders
    });
  };

  const savePlatformTokens = () => {
    onSavePlatformTokens(localTokens);
    setTokensSaved(true);
    setTimeout(() => setTokensSaved(false), 2000);
  };

  const addHeader = () => {
    updateForm({ customHeaders: [...form.customHeaders, { key: '', value: '' }] });
  };

  const removeHeader = (index: number) => {
    updateForm({ customHeaders: form.customHeaders.filter((_, i) => i !== index) });
  };

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const headers = [...form.customHeaders];
    headers[index][field] = value;
    updateForm({ customHeaders: headers });
  };

  const keyLabel = selectedProvider ? `${selectedProvider.name} API Key` : 'API Key';

  return (
    <div className={`space-y-6 ${isSidebarMode ? '' : 'max-w-2xl'}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="section-title flex items-center gap-2">
          <Settings className="w-6 h-6 text-blue-500" />
          Settings
        </h1>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          >
            Done
          </button>
        )}
      </div>

      {/* API Configuration */}
      <div className="card space-y-5">
        <div className="subsection-header">
          <Server className="w-4 h-4 text-blue-500" />
          <span>API Configuration</span>
        </div>

        <div>
          <label className="form-label">API Provider</label>
          <select
            value={selectedAlias}
            onChange={e => setSelectedAlias(e.target.value)}
            className="select-field"
          >
            <option value="">Select a provider...</option>
            {providerStatus?.providers.map(p => (
              <option key={p.alias} value={p.alias}>
                {p.name} {p.active ? '(active)' : ''}
              </option>
            ))}
          </select>
        </div>

        {!selectedAlias && (
          <p className="text-sm text-yellow-300 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" /> Select a provider above to configure it.
          </p>
        )}

        {selectedAlias && (
          <>
            {(isOpenAICompatible || isAzure) && (
              <div>
                <label className="form-label">
                  {isAzure ? 'Azure Endpoint' : 'Base URL'}
                  {isOpenAICompatible && <span className="text-red-500 ml-1">●</span>}
                </label>
                <input
                  type="text"
                  value={isAzure ? form.endpoint : form.baseUrl}
                  onChange={e => isAzure ? updateForm({ endpoint: e.target.value }) : updateForm({ baseUrl: e.target.value })}
                  placeholder={isAzure ? 'https://your-resource.openai.azure.com' : 'https://api.openai.com/v1'}
                  className="input-field"
                />
              </div>
            )}

            <div>
              <label className="form-label">
                {keyLabel}
                <span className="text-red-500 ml-1">●</span>
              </label>
              <input
                type="password"
                value={form.apiKey}
                onChange={e => { updateForm({ apiKey: e.target.value }); setApiKeySaved(false); }}
                placeholder={apiKeyPlaceholder(selectedAlias)}
                className="input-field"
              />
              <p className="helper-text">
                This key is stored locally and only used to make API requests from this extension.
              </p>
              {apiKeySaved && !form.apiKey && (
                <p className="text-xs text-green-400 mt-1 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> API key is saved.</p>
              )}
            </div>

            <div>
              <label className="form-label">
                Model ID
                <span className="text-red-500 ml-1">●</span>
              </label>
              <input
                type="text"
                value={form.model}
                onChange={e => updateForm({ model: e.target.value })}
                placeholder={selectedProvider?.defaultModel || 'gpt-4.1'}
                className="input-field"
              />
            </div>

            {isAzure && (
              <>
                <div>
                  <label className="form-label">Deployment Name</label>
                  <input
                    type="text"
                    value={form.deployment}
                    onChange={e => updateForm({ deployment: e.target.value })}
                    placeholder="gpt-4o"
                    className="input-field"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input
                    type="checkbox"
                    checked={form.setApiVersion}
                    onChange={e => updateForm({ setApiVersion: e.target.checked })}
                    className="checkbox"
                  />
                  <span className="text-sm">Set Azure API version</span>
                </label>

                {form.setApiVersion && (
                  <div className="pl-6">
                    <input
                      type="text"
                      value={form.apiVersion}
                      onChange={e => updateForm({ apiVersion: e.target.value })}
                      placeholder="2025-01-01-preview"
                      className="input-field"
                    />
                  </div>
                )}

                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input
                    type="checkbox"
                    checked={form.useBearerAuth}
                    onChange={e => updateForm({ useBearerAuth: e.target.checked })}
                    className="checkbox"
                  />
                  <span className="text-sm">Use Azure Identity Authentication</span>
                </label>
              </>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="form-label mb-0">Custom Headers</label>
                <button type="button" onClick={addHeader} className="add-btn flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add Header
                </button>
              </div>
              {form.customHeaders.map((header, index) => (
                <div key={index} className="key-value-row">
                  <input
                    type="text"
                    value={header.key}
                    onChange={e => updateHeader(index, 'key', e.target.value)}
                    placeholder="Header name"
                    className="key-value-input"
                  />
                  <input
                    type="text"
                    value={header.value}
                    onChange={e => updateHeader(index, 'value', e.target.value)}
                    placeholder="Value"
                    className="key-value-input"
                  />
                  <button type="button" onClick={() => removeHeader(index)} className="remove-btn">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleTest}
                disabled={!form.apiKey && !selectedProvider?.configured}
                className="btn-secondary flex-1 py-2 rounded text-sm"
              >
                Test Connection
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!form.apiKey && !selectedProvider?.configured}
                className="btn-primary flex-1 py-2 rounded text-sm"
              >
                Save & Activate
              </button>
            </div>

            {testResult && (
              <div className={`p-2 rounded text-xs flex items-center gap-1 ${testResult.success ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
                {testResult.success ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {testResult.success ? testResult.message : testResult.error}
              </div>
            )}
          </>
        )}
      </div>

      {/* Platform Tokens */}
      <div className="card space-y-4">
        <div className="subsection-header">
          <Key className="w-4 h-4 text-blue-500" />
          <span>Platform Tokens</span>
        </div>
        <div>
          <label className="form-label">GitHub Token</label>
          <input
            type="password"
            value={localTokens.githubToken}
            onChange={e => setLocalTokens({ ...localTokens, githubToken: e.target.value })}
            placeholder="ghp_xxxxxxxxxxxx"
            className="input-field"
          />
        </div>
        <div>
          <label className="form-label">GitLab Token</label>
          <input
            type="password"
            value={localTokens.gitlabToken}
            onChange={e => setLocalTokens({ ...localTokens, gitlabToken: e.target.value })}
            placeholder="glpat-xxxxxxxxxxxx"
            className="input-field"
          />
        </div>
        <button onClick={savePlatformTokens} className="btn-primary w-full py-2 rounded text-sm flex items-center justify-center gap-2">
          <Check className="w-4 h-4" /> Save Platform Tokens
        </button>
        {tokensSaved && <p className="text-xs text-green-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Saved</p>}
      </div>
    </div>
  );
}

function apiKeyPlaceholder(alias: string): string {
  switch (alias) {
    case 'anthropic': return 'sk-ant-...';
    case 'azure': return 'Azure OpenAI key';
    default: return 'sk-...';
  }
}
