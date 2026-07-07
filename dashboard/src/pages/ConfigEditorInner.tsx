import { useConfig } from '../context/ConfigContext';
import { PageShell } from '../components/shared/PageShell';

export function ConfigEditorInner() {
  const { state, setDraft, save, reset, selfTest } = useConfig();

  return (
    <PageShell title="CONFIG EDITOR">
      <div className="flex flex-col h-full gap-4">
        <div className="flex gap-2 items-center">
          <button onClick={save} disabled={!state.dirty || !!state.parseError || state.saveStatus === 'saving'}
            className="font-pixel text-px-xs px-3 py-1.5 bg-aic-accent text-aic-bg-dark hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity">
            {state.saveStatus === 'saving' ? 'SAVING...' : 'SAVE'}
          </button>
          <button onClick={reset} disabled={!state.dirty}
            className="font-pixel text-px-xs px-3 py-1.5 border-2 border-aic-border text-aic-text hover:border-aic-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            RESET
          </button>
          <button onClick={selfTest} disabled={state.selfTestResult === 'running'}
            className="font-pixel text-px-xs px-3 py-1.5 border-2 border-aic-yellow text-aic-yellow hover:bg-aic-yellow hover:text-aic-bg-dark disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            {state.selfTestResult === 'running' ? 'TESTING...' : 'SELF TEST'}
          </button>
          <div className="flex-1" />
          {state.parseError && (
            <span className="font-pixel text-px-xs text-aic-red">PARSE ERROR</span>
          )}
          {state.saveStatus === 'saved' && !state.dirty && (
            <span className="font-pixel text-px-xs text-aic-green">SAVED</span>
          )}
          {state.saveStatus === 'error' && (
            <span className="font-pixel text-px-xs text-aic-red">SAVE FAILED</span>
          )}
          {state.selfTestResult === 'pass' && (
            <span className="font-pixel text-px-xs text-aic-green">TEST PASS</span>
          )}
          {state.selfTestResult === 'fail' && (
            <span className="font-pixel text-px-xs text-aic-red">TEST FAIL: {state.selfTestDetails}</span>
          )}
        </div>
        <textarea
          value={state.draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
          className="flex-1 min-h-[400px] bg-aic-bg-dark border-2 border-aic-border text-aic-text font-mono text-sm p-4 resize-y focus:outline-none focus:border-aic-accent"
          placeholder="Loading config..."
        />
      </div>
    </PageShell>
  );
}
