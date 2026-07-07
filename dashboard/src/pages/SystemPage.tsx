import { useState, useEffect } from 'react';
import { PageShell } from '../components/shared/PageShell';
import { MetricCard } from '../components/shared/MetricCard';
import { getHealth, getCost, resetState } from '../api/system';
import type { SystemHealth, CostData } from '../types';

export function SystemPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [cost, setCost] = useState<CostData | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => {});
    getCost().then(setCost).catch(() => {});
  }, []);

  const handleReset = async () => {
    if (!confirm('Reset all state? This cannot be undone.')) return;
    setResetting(true);
    try {
      await resetState();
      window.location.reload();
    } catch {
      setResetting(false);
    }
  };

  return (
    <PageShell title="SYSTEM">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="Health"
            value={health?.ok ? 'OK' : 'DOWN'}
            color={health?.ok ? '#00ff88' : '#ff4444'}
            sub={`Port ${health?.port ?? '?'}`}
          />
          <MetricCard
            label="Uptime"
            value={health ? `${Math.floor((health.uptime ?? 0) / 60)}m` : '?'}
            color="#00d4ff"
          />
          <MetricCard
            label="Total Tokens"
            value={cost ? (cost.tokens.input + cost.tokens.output).toLocaleString() : '?'}
            color="#ffcc00"
            sub={cost ? `In: ${cost.tokens.input.toLocaleString()} / Out: ${cost.tokens.output.toLocaleString()}` : ''}
          />
          <MetricCard
            label="Total Cost"
            value={cost ? `$${cost.cost.toFixed(4)}` : '?'}
            color="#ff8800"
          />
        </div>

        <div className="panel p-4">
          <div className="font-pixel text-px-xs text-aic-text-dim mb-3 uppercase">Environment</div>
          <div className="font-pixel text-px-xs text-aic-text space-y-1">
            <div><span className="text-aic-text-dim">API:</span> localhost:6868</div>
            <div><span className="text-aic-text-dim">Provider:</span> http://192.168.2.11:20128/v1</div>
            <div><span className="text-aic-text-dim">Version:</span> {health?.version ?? 'unknown'}</div>
          </div>
        </div>

        <div className="panel p-4">
          <div className="font-pixel text-px-xs text-aic-text-dim mb-3 uppercase">Danger Zone</div>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="font-pixel text-px-xs px-4 py-2 border-2 border-aic-red text-aic-red hover:bg-aic-red hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {resetting ? 'RESETTING...' : 'RESET ALL STATE'}
          </button>
        </div>
      </div>
    </PageShell>
  );
}
