import { useDashboard } from '../context/DashboardContext';
import { WORKERS } from '../data/workers';
import { PageShell } from '../components/shared/PageShell';
import { StatusBadge } from '../components/shared/StatusBadge';
import { MetricCard } from '../components/shared/MetricCard';

export function WorkersMonitorPage() {
  const { state } = useDashboard();

  const active = WORKERS.filter((w) => state.agents[w.id]?.status === 'working').length;
  const complete = WORKERS.filter((w) => state.agents[w.id]?.status === 'complete').length;
  const errors = WORKERS.filter((w) => state.agents[w.id]?.status === 'error').length;

  return (
    <PageShell title="WORKERS">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Total" value={WORKERS.length} color="#00d4ff" />
          <MetricCard label="Active" value={active} color="#ffcc00" />
          <MetricCard label="Complete" value={complete} color="#00ff88" />
          <MetricCard label="Errors" value={errors} color="#ff4444" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {WORKERS.map((worker) => {
            const agent = state.agents[worker.id];
            const status = agent?.status ?? 'idle';
            return (
              <div key={worker.id} className="panel p-3">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-pixel text-px-sm text-white">{worker.name}</div>
                    <div className="font-pixel text-px-xs text-aic-text-dim">{worker.role}</div>
                  </div>
                  <StatusBadge status={status} />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-pixel text-px-xs text-aic-accent">{worker.model}</span>
                  {agent?.engine && status === 'working' && (
                    <span className={`font-pixel text-px-xs ${agent.engine === 'opencode' ? 'text-aic-purple' : 'text-aic-accent'}`}>
                      {agent.engine === 'opencode' ? '⚡ OPENCODE' : '🧠 DELEGATE'}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <span className="font-pixel text-px-xs text-aic-text-muted">CB:</span>
                  <span className="w-2 h-2 inline-block bg-aic-green" style={{ imageRendering: 'pixelated' }} />
                  <span className="font-pixel text-px-xs text-aic-green">CLOSED</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}
