import { useState, useEffect } from 'react';
import { api } from '../../api';

export function ConfigEditor() {
  const [env, setEnv] = useState('');
  const [opencode, setOpencode] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getConfig().then(data => {
      setEnv(data.env);
      setOpencode(data.opencode);
      setLoading(false);
    }).catch(err => {
      setStatus(`Error loading config: ${err.message}`);
      setLoading(false);
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('Saving...');
    try {
      await api.saveConfig({ env, opencode });
      setStatus('Saved successfully!');
      setTimeout(() => setStatus(''), 2000);
    } catch (err) {
      setStatus(`Save failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-aic-accent text-px-sm">▶</span>
        <h3 className="font-pixel text-px-sm text-aic-accent uppercase">CONFIG SETTINGS</h3>
      </div>
      <div className="bg-aic-bg-panel border border-aic-border/50 rounded p-4">
        {loading ? (
          <div className="text-aic-text-muted font-pixel text-px-xs">Loading...</div>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-4 font-body text-sm">
            
            <div className="flex flex-col gap-1">
              <label className="font-pixel text-px-xs text-aic-text-bright uppercase">.env variables</label>
              <textarea 
                value={env}
                onChange={e => setEnv(e.target.value)}
                className="bg-aic-bg-dark border border-aic-border/50 rounded p-2 text-aic-text-bright focus:border-aic-accent focus:outline-none resize-none h-24 font-mono text-xs"
                spellCheck="false"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-pixel text-px-xs text-aic-text-bright uppercase">opencode.jsonc</label>
              <textarea 
                value={opencode}
                onChange={e => setOpencode(e.target.value)}
                className="bg-aic-bg-dark border border-aic-border/50 rounded p-2 text-aic-text-bright focus:border-aic-accent focus:outline-none resize-none h-32 font-mono text-xs"
                spellCheck="false"
              />
            </div>

            <div className="flex items-center justify-between mt-2">
              <span className={`font-pixel text-px-xs ${status.includes('fail') || status.includes('Error') ? 'text-aic-red' : 'text-aic-green'}`}>
                {status}
              </span>
              <button 
                type="submit"
                className="font-pixel text-px-xs bg-aic-bg-dark border border-aic-accent text-aic-accent hover:bg-aic-accent hover:text-black px-4 py-2 rounded transition-colors"
              >
                SAVE
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}