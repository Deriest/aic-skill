import { useState, useEffect } from 'react';
import { PageShell } from '../components/shared/PageShell';
import { useConfig } from '../context/ConfigContext';

export function ConfigEditorInner() {
  const { state, setDraft, save, reset, selfTest } = useConfig();
  
  // State for form parsing
  const [providerUrl, setProviderUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [thinker, setThinker] = useState('');
  const [crafter, setCrafter] = useState('');
  const [sprinter, setSprinter] = useState('');

  const [activeTab, setActiveTab] = useState<'env' | 'opencode'>('env');

  // Parse draft to form fields on load
  useEffect(() => {
    if (state.draft && activeTab === 'env') {
      const lines = state.draft.split('\n');
      for (const line of lines) {
        if (line.startsWith('BASE_URL=')) setProviderUrl(line.split('=')[1] || '');
        if (line.startsWith('API_KEY=')) setApiKey(line.split('=')[1] || '');
        if (line.startsWith('MODEL_THINKER=')) setThinker(line.split('=')[1] || '');
        if (line.startsWith('MODEL_CRAFTER=')) setCrafter(line.split('=')[1] || '');
        if (line.startsWith('MODEL_SPRINTER=')) setSprinter(line.split('=')[1] || '');
      }
    }
  }, [state.draft, activeTab]);

  // Update draft when form changes
  const updateEnvDraft = () => {
    if (activeTab !== 'env') return;
    const newEnv = `PROVIDER_ID=tvd
API_KEY=${apiKey}
BASE_URL=${providerUrl}
MODEL_THINKER=${thinker}
MODEL_CRAFTER=${crafter}
MODEL_SPRINTER=${sprinter}
`;
    setDraft(newEnv);
  };

  return (
    <PageShell title="CONFIGURATIONS">
      <div className="flex flex-col h-full gap-4 max-w-2xl mx-auto w-full">
        <div className="flex justify-between items-center bg-aic-bg-dark p-3 border border-aic-border">
          <div className="flex gap-4">
            <div className="flex gap-2">
              <button onClick={() => setActiveTab('env')} className={`font-pixel text-px-xs px-3 py-1 ${activeTab === 'env' ? 'bg-aic-accent text-aic-bg-dark' : 'text-aic-text-muted hover:text-white'}`}>.ENV</button>
              <button onClick={() => setActiveTab('opencode')} className={`font-pixel text-px-xs px-3 py-1 ${activeTab === 'opencode' ? 'bg-aic-accent text-aic-bg-dark' : 'text-aic-text-muted hover:text-white'}`}>OPENCODE.JSON</button>
            </div>
            <div className="border-l border-aic-border mx-2"></div>
            <div className="flex gap-2">
              <button onClick={save} disabled={!state.dirty || !!state.parseError || state.saveStatus === 'saving'}
                className="font-pixel text-px-xs px-4 py-2 bg-aic-accent text-aic-bg-dark hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed">
                {state.saveStatus === 'saving' ? 'SAVING...' : 'APPLY CONFIG'}
              </button>
              <button onClick={reset} disabled={!state.dirty}
                className="font-pixel text-px-xs px-4 py-2 border border-aic-border text-aic-text hover:border-aic-accent disabled:opacity-30">
                DISCARD
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {state.saveStatus === 'saved' && !state.dirty && <span className="font-pixel text-px-xs text-aic-green">✓ APPLIED</span>}
            {state.selfTestResult === 'pass' && <span className="font-pixel text-px-xs text-aic-green">✓ TEST PASSED</span>}
            {state.selfTestResult === 'fail' && <span className="font-pixel text-px-xs text-aic-red">✗ TEST FAILED</span>}
          </div>
        </div>

        {activeTab === 'env' ? (
          <div className="space-y-6 bg-aic-surface p-6 border-2 border-aic-border">
            <div>
              <h3 className="font-pixel text-px-sm text-aic-accent mb-1 border-b border-aic-border pb-2">CONNECTION</h3>
              <p className="text-xs text-aic-text-muted mb-4 font-mono">Setup your OpenAI-compatible API endpoint.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block font-pixel text-px-xs text-aic-text mb-1">Base URL</label>
                  <input type="text" value={providerUrl} onChange={e => { setProviderUrl(e.target.value); updateEnvDraft(); }}
                    className="w-full bg-aic-bg-dark border border-aic-border p-2 font-mono text-sm focus:outline-none focus:border-aic-accent text-white" 
                    placeholder="http://192.168.2.11:20128/v1" />
                </div>
                <div>
                  <label className="block font-pixel text-px-xs text-aic-text mb-1">API Key</label>
                  <input type="text" value={apiKey} onChange={e => { setApiKey(e.target.value); updateEnvDraft(); }}
                    className="w-full bg-aic-bg-dark border border-aic-border p-2 font-mono text-sm focus:outline-none focus:border-aic-accent text-white" 
                    placeholder="sk-..." />
                  {apiKey.includes('REDACTED') && <div className="text-xs text-aic-yellow mt-1 font-mono">Key is currently redacted for security. Enter a new key to change it.</div>}
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-pixel text-px-sm text-aic-accent mb-1 border-b border-aic-border pb-2 mt-8">MODEL TIERS</h3>
              <p className="text-xs text-aic-text-muted mb-4 font-mono">Assign models to the 3 intelligence tiers.</p>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-24 shrink-0">
                    <label className="block font-pixel text-px-xs text-aic-text">Thinker</label>
                    <span className="text-[10px] text-aic-text-dim">Max reasoning</span>
                  </div>
                  <input type="text" value={thinker} onChange={e => { setThinker(e.target.value); updateEnvDraft(); }}
                    className="flex-1 bg-aic-bg-dark border border-aic-border p-2 font-mono text-sm focus:outline-none focus:border-aic-accent text-white" 
                    placeholder="TVD/Opus" />
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="w-24 shrink-0">
                    <label className="block font-pixel text-px-xs text-aic-text">Crafter</label>
                    <span className="text-[10px] text-aic-text-dim">Standard dev</span>
                  </div>
                  <input type="text" value={crafter} onChange={e => { setCrafter(e.target.value); updateEnvDraft(); }}
                    className="flex-1 bg-aic-bg-dark border border-aic-border p-2 font-mono text-sm focus:outline-none focus:border-aic-accent text-white" 
                    placeholder="TVD/Sonnet" />
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-24 shrink-0">
                    <label className="block font-pixel text-px-xs text-aic-text">Sprinter</label>
                    <span className="text-[10px] text-aic-text-dim">Fast tasks, QA</span>
                  </div>
                  <input type="text" value={sprinter} onChange={e => { setSprinter(e.target.value); updateEnvDraft(); }}
                    className="flex-1 bg-aic-bg-dark border border-aic-border p-2 font-mono text-sm focus:outline-none focus:border-aic-accent text-white" 
                    placeholder="TVD/Haiku" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-aic-surface border-2 border-aic-border p-4">
            <h3 className="font-pixel text-px-sm text-aic-accent mb-2">ADVANCED OPENCODE JSON</h3>
            <textarea
              value={state.draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              className="w-full min-h-[300px] bg-aic-bg-dark border border-aic-border text-aic-text font-mono text-sm p-4 resize-y focus:outline-none focus:border-aic-accent"
            />
          </div>
        )}
      </div>
    </PageShell>
  );
}