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

  const handleSave = async () => {
    setStatus('Saving...');
    try {
      await api.saveConfig({ env, opencode });
      setStatus('Saved successfully!');
      setTimeout(() => setStatus(''), 2000);
    } catch (err) {
      setStatus(`Save failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  if (loading) return <div className="text-slate-400 p-4">Loading config...</div>;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 font-mono text-sm shadow-xl flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-green-400 font-bold uppercase tracking-wider">System Config</h2>
        <div className="flex items-center gap-4">
          <span className="text-yellow-400">{status}</span>
          <button 
            onClick={handleSave}
            className="bg-green-600 hover:bg-green-500 text-white px-4 py-1 rounded text-xs font-bold transition-colors"
          >
            SAVE CHANGES
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-4">
        <div className="flex flex-col">
          <label className="text-blue-400 mb-1 text-xs">.env (Provider Config)</label>
          <textarea 
            value={env}
            onChange={e => setEnv(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 text-slate-300 p-2 rounded focus:border-blue-500 focus:outline-none resize-none"
            spellCheck="false"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-blue-400 mb-1 text-xs">opencode.jsonc (Custom Provider)</label>
          <textarea 
            value={opencode}
            onChange={e => setOpencode(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 text-slate-300 p-2 rounded focus:border-blue-500 focus:outline-none resize-none"
            spellCheck="false"
          />
        </div>
      </div>
    </div>
  );
}