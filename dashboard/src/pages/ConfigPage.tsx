import { useState, useEffect } from 'react';
import { api } from '../api';

export function ConfigPage() {
  const [envVars, setEnvVars] = useState<{ key: string, value: string }[]>([]);
  const [opencodeRaw, setOpencodeRaw] = useState('');
  const [opencodeObj, setOpencodeObj] = useState<any>(null);
  const [baseURL, setBaseURL] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [providerKey, setProviderKey] = useState('aic');
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const getEnvValue = (key: string) => {
    const variable = envVars.find(v => v.key === key);
    return variable ? variable.value : '';
  };

  const setEnvValue = (key: string, value: string) => {
    setEnvVars(prev => {
      const exists = prev.some(v => v.key === key);
      if (exists) {
        return prev.map(v => v.key === key ? { ...v, value } : v);
      } else {
        return [...prev, { key, value }];
      }
    });
  };

  const handleProviderChange = (newPKey: string) => {
    setProviderKey(newPKey);
    const customProviders = opencodeObj?.provider || {};
    const provider = customProviders[newPKey] || {};
    const options = provider.options || {};
    setBaseURL(options.baseURL || '');
    setApiKey(options.apiKey || '');
  };

  const fetchModels = async () => {
    if (!baseURL) {
      setStatus('Base URL is required to fetch models');
      return;
    }
    setStatus('Fetching models...');
    try {
      const url = baseURL.endsWith('/') ? `${baseURL}models` : `${baseURL}/models`;
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const result = await res.json();
      
      if (result && Array.isArray(result.data)) {
        const ids = result.data.map((m: any) => m.id || m.name).filter(Boolean);
        setAvailableModels(ids);
        setStatus(`Successfully fetched ${ids.length} models!`);
        setTimeout(() => setStatus(''), 3000);
      } else {
        throw new Error('Response data is not an array of models');
      }
    } catch (err) {
      console.error(err);
      setStatus(`Failed to fetch models: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  const uniqueModels = Array.from(new Set([
    ...availableModels,
    getEnvValue('MODEL_THINKER'),
    getEnvValue('MODEL_CRAFTER'),
    getEnvValue('MODEL_SPRINTER')
  ].filter(Boolean))) as string[];

  // Helper to strip JSON comments before parsing standard JSON if needed
  const parseJsonc = (str: string) => {
    try {
      const clean = str.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
      return JSON.parse(clean);
    } catch (e) {
      return JSON.parse(str);
    }
  };

  useEffect(() => {
    api.getConfig().then((data: any) => {
      // Parse basic .env string to key-value pairs
      const parsedEnv = data.env.split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line && !line.startsWith('#'))
        .map((line: string) => {
          const idx = line.indexOf('=');
          if (idx === -1) return { key: line, value: '' };
          return {
            key: line.slice(0, idx).trim(),
            value: line.slice(idx + 1).trim()
          };
        });
        
      setEnvVars(parsedEnv.length ? parsedEnv : [{ key: '', value: '' }]);
      setOpencodeRaw(data.opencode);
      
      try {
        const obj = parseJsonc(data.opencode);
        setOpencodeObj(obj);
        // Find custom provider key or fallback to 'aic'
        const customProviders = obj.provider || {};
        const pKey = Object.keys(customProviders).find(k => k !== 'openai' && k !== 'anthropic') || 'aic';
        setProviderKey(pKey);
        const provider = customProviders[pKey] || {};
        const options = provider.options || {};
        setBaseURL(options.baseURL || '');
        setApiKey(options.apiKey || '');
      } catch (err) {
        console.error('Failed to parse opencode.jsonc', err);
      }
      
      setLoading(false);
    }).catch((err: any) => {
      setStatus(`Error loading config: ${err.message}`);
      setLoading(false);
    });
  }, []);

  const handleEnvChange = (index: number, field: 'key' | 'value', val: string) => {
    const newVars = [...envVars];
    newVars[index][field] = val;
    setEnvVars(newVars);
  };

  const handleAddEnv = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const handleRemoveEnv = (index: number) => {
    const newVars = envVars.filter((_, i) => i !== index);
    setEnvVars(newVars.length ? newVars : [{ key: '', value: '' }]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('Saving...');
    
    // Reconstruct .env string
    const envString = envVars
      .filter(v => v.key)
      .map(v => `${v.key}=${v.value}`)
      .join('\n');

    // Update opencodeObj/opencodeRaw before saving
    let nextOpencode = opencodeRaw;
    try {
      const obj = { ...(opencodeObj || {}) };
      if (!obj.provider) {
        obj.provider = {};
      }
      // Remove any existing provider key not selected if we change provider keys, or just keep them? Let's just manage the current providerKey.
      const customProviders = obj.provider;
      const pKey = providerKey;
      if (!customProviders[pKey]) {
        customProviders[pKey] = {
          npm: "@ai-sdk/openai-compatible",
          name: "AIC Proxy",
          options: {},
          models: {
            Opus: { name: "Opus" },
            Sonnet: { name: "Sonnet" },
            Haiku: { name: "Haiku" }
          }
        };
      }
      if (!customProviders[pKey].options) {
        customProviders[pKey].options = {};
      }
      customProviders[pKey].options.baseURL = baseURL;
      customProviders[pKey].options.apiKey = apiKey;
      nextOpencode = JSON.stringify(obj, null, 2);
    } catch (err) {
      setStatus(`JSON construction error: ${err instanceof Error ? err.message : 'Unknown'}`);
      return;
    }

    try {
      await api.saveConfig({ env: envString, opencode: nextOpencode });
      setStatus('Saved successfully!');
      setTimeout(() => setStatus(''), 2000);
    } catch (err) {
      setStatus(`Save failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  if (loading) {
    return <div className="text-aic-accent p-6 font-pixel">LOADING CONFIG...</div>;
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        <div>
          <h2 className="font-pixel text-aic-accent text-px-md uppercase drop-shadow-[0_0_5px_rgba(0,255,255,0.5)] mb-6">
            SYSTEM CONFIGURATION
          </h2>
          <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded p-6 shadow-lg">
            <form onSubmit={handleSave} className="flex flex-col gap-8">
              
              <div className="grid grid-cols-2 gap-8">
                {/* Dynamic .env Form */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-aic-accent text-px-sm font-pixel">▶</span>
                    <h3 className="font-pixel text-px-sm text-aic-text-bright uppercase">Environment Variables (.env)</h3>
                  </div>
                  
                  <div className="flex flex-col gap-3 bg-aic-bg-dark/50 p-4 border border-aic-border/30 rounded">
                    {envVars.map((v, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input 
                          type="text"
                          placeholder="KEY"
                          value={v.key}
                          onChange={(e) => handleEnvChange(i, 'key', e.target.value)}
                          className="bg-aic-bg-dark border border-aic-border/50 rounded p-2 text-aic-text-bright focus:border-aic-accent focus:outline-none w-1/3 font-mono text-xs"
                        />
                        <span className="text-aic-text-muted font-mono">=</span>
                        <input 
                          type="text"
                          placeholder="VALUE"
                          value={v.value}
                          onChange={(e) => handleEnvChange(i, 'value', e.target.value)}
                          className="bg-aic-bg-dark border border-aic-border/50 rounded p-2 text-aic-text-bright focus:border-aic-accent focus:outline-none flex-1 font-mono text-xs"
                        />
                        <button 
                          type="button" 
                          onClick={() => handleRemoveEnv(i)}
                          className="text-aic-red hover:text-white border border-aic-red/50 hover:bg-aic-red px-2 py-1.5 rounded transition-colors text-xs font-mono"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button 
                      type="button" 
                      onClick={handleAddEnv}
                      className="self-start mt-2 font-pixel text-[10px] text-aic-green border border-aic-green/50 hover:bg-aic-green hover:text-black px-3 py-1.5 rounded transition-colors"
                    >
                      + ADD VARIABLE
                    </button>
                  </div>
                </div>

                {/* Opencode Fields Form */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-aic-accent text-px-sm font-pixel">▶</span>
                    <h3 className="font-pixel text-px-sm text-aic-text-bright uppercase">Opencode Settings (opencode.jsonc)</h3>
                  </div>
                  
                  <div className="flex flex-col gap-4 bg-aic-bg-dark/50 p-4 border border-aic-border/30 rounded">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-pixel text-px-xs text-aic-text-muted uppercase">Provider</label>
                      <select
                        value={providerKey}
                        onChange={e => handleProviderChange(e.target.value)}
                        className="bg-aic-bg-dark border border-aic-border/50 rounded p-2 text-aic-text-bright focus:border-aic-accent focus:outline-none font-mono text-xs"
                      >
                        <option value="aic">aic</option>
                        <option value="openai">openai</option>
                        <option value="anthropic">anthropic</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-pixel text-px-xs text-aic-text-muted uppercase">custom_providers.{providerKey}.baseURL</label>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          placeholder="https://..."
                          value={baseURL}
                          onChange={e => setBaseURL(e.target.value)}
                          className="bg-aic-bg-dark border border-aic-border/50 rounded p-2 text-aic-text-bright focus:border-aic-accent focus:outline-none font-mono text-xs flex-1"
                        />
                        <button
                          type="button"
                          onClick={fetchModels}
                          className="font-pixel text-[10px] text-aic-accent border border-aic-accent/50 hover:bg-aic-accent hover:text-black px-3 py-1.5 rounded transition-colors whitespace-nowrap"
                        >
                          FETCH MODELS
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-pixel text-px-xs text-aic-text-muted uppercase">custom_providers.{providerKey}.apiKey</label>
                      <input 
                        type="password"
                        placeholder="sk-..."
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        className="bg-aic-bg-dark border border-aic-border/50 rounded p-2 text-aic-text-bright focus:border-aic-accent focus:outline-none font-mono text-xs"
                      />
                    </div>

                    <div className="border-t border-aic-border/20 pt-4 mt-2 flex flex-col gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="font-pixel text-px-xs text-aic-text-muted uppercase">MODEL_THINKER</label>
                        <select
                          value={getEnvValue('MODEL_THINKER')}
                          onChange={e => setEnvValue('MODEL_THINKER', e.target.value)}
                          className="bg-aic-bg-dark border border-aic-border/50 rounded p-2 text-aic-text-bright focus:border-aic-accent focus:outline-none font-mono text-xs"
                        >
                          <option value="">-- Select Model --</option>
                          {uniqueModels.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="font-pixel text-px-xs text-aic-text-muted uppercase">MODEL_CRAFTER</label>
                        <select
                          value={getEnvValue('MODEL_CRAFTER')}
                          onChange={e => setEnvValue('MODEL_CRAFTER', e.target.value)}
                          className="bg-aic-bg-dark border border-aic-border/50 rounded p-2 text-aic-text-bright focus:border-aic-accent focus:outline-none font-mono text-xs"
                        >
                          <option value="">-- Select Model --</option>
                          {uniqueModels.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="font-pixel text-px-xs text-aic-text-muted uppercase">MODEL_SPRINTER</label>
                        <select
                          value={getEnvValue('MODEL_SPRINTER')}
                          onChange={e => setEnvValue('MODEL_SPRINTER', e.target.value)}
                          className="bg-aic-bg-dark border border-aic-border/50 rounded p-2 text-aic-text-bright focus:border-aic-accent focus:outline-none font-mono text-xs"
                        >
                          <option value="">-- Select Model --</option>
                          {uniqueModels.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit / Status */}
              <div className="flex items-center justify-between border-t border-aic-border/30 pt-6">
                <span className={`font-pixel text-px-sm ${status.includes('fail') || status.includes('Error') ? 'text-aic-red' : 'text-aic-green'}`}>
                  {status}
                </span>
                <button 
                  type="submit"
                  className="font-pixel text-px-sm bg-aic-bg-dark border-2 border-aic-accent text-aic-accent hover:bg-aic-accent hover:text-black px-6 py-3 rounded transition-all shadow-[0_0_15px_rgba(0,255,255,0.2)] hover:shadow-[0_0_20px_rgba(0,255,255,0.5)]"
                >
                  SAVE ALL CONFIG
                </button>
              </div>

            </form>
          </div>
        </div>
      </div>
    </div>
  );
}