import { useState, useEffect } from 'react';
import { api } from '../api';

export function ConfigPage() {
  const [envVars, setEnvVars] = useState<{ key: string, value: string }[]>([]);
  const [opencode, setOpencode] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

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
      setOpencode(data.opencode);
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

    try {
      await api.saveConfig({ env: envString, opencode });
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
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        <div>
          <h2 className="font-pixel text-aic-accent text-px-md uppercase drop-shadow-[0_0_5px_rgba(0,255,255,0.5)] mb-6">
            SYSTEM CONFIGURATION
          </h2>
          <div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded p-6 shadow-lg">
            <form onSubmit={handleSave} className="flex flex-col gap-8">
              
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

              {/* Opencode textarea */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-aic-accent text-px-sm font-pixel">▶</span>
                  <h3 className="font-pixel text-px-sm text-aic-text-bright uppercase">Opencode JSONC (opencode.jsonc)</h3>
                </div>
                <textarea 
                  value={opencode}
                  onChange={e => setOpencode(e.target.value)}
                  className="bg-aic-bg-dark border border-aic-border/50 rounded p-4 text-aic-text-bright focus:border-aic-accent focus:outline-none resize-y min-h-[200px] font-mono text-xs"
                  spellCheck="false"
                />
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