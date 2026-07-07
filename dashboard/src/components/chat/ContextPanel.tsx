import { useDashboard } from '../../context/DashboardContext';
import { WORKERS } from '../../data/workers';

export function ContextPanel() {
  const { state } = useDashboard();

  const activeWorkers = WORKERS.filter((w) => state.agents[w.id]?.status === 'working');
  const totalLogs = state.logEntries.length;

  return (
    <div className="w-64 border-l-2 border-aic-border bg-aic-bg-panel-dark overflow-y-auto p-3 hidden xl:block">
      <div className="font-pixel text-px-xs text-aic-accent mb-3 uppercase tracking-wider">Context</div>

      {state.currentTask && (
        <div className="mb-4">
          <div className="font-pixel text-px-xs text-aic-text-dim mb-1">CURRENT TASK</div>
          <div className="font-pixel text-px-xs text-white">{state.currentTask.title}</div>
          <div className="font-pixel text-px-xs text-aic-text-muted">{state.currentTask.type}</div>
        </div>
      )}

      <div className="mb-4">
        <div className="font-pixel text-px-xs text-aic-text-dim mb-1">ACTIVE WORKERS ({activeWorkers.length})</div>
        {activeWorkers.length === 0 ? (
          <div className="font-pixel text-px-xs text-aic-text-muted">None active</div>
        ) : (
          activeWorkers.map((w) => (
            <div key={w.id} className="font-pixel text-px-xs text-aic-yellow py-0.5">► {w.name}</div>
          ))
        )}
      </div>

      <div>
        <div className="font-pixel text-px-xs text-aic-text-dim mb-1">LOG ENTRIES</div>
        <div className="font-pixel text-px-xs text-aic-text-muted">{totalLogs} total</div>
      </div>
    </div>
  );
}
