import { useState, useEffect } from 'react';
import { PageShell } from '../components/shared/PageShell';
import { MetricCard } from '../components/shared/MetricCard';
import { getHealth, resetState } from '../api/system';
import type { SystemHealth } from '../types';

export function SystemPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => {});
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
      <div className="flex flex-col h-full gap-4">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            label="System Status"
            value={health?.ok ? 'OK' : 'DOWN'}
            color={health?.ok ? '#4caf50' : '#f44336'}
            sub={health ? `Uptime: ${(health.uptime / 60).toFixed(1)} min` : ''}
          />
        </div>

        <div className="panel p-4 flex-1">
          <div className="font-pixel text-px-xs text-aic-text-dim mb-3 uppercase">Environment</div>
          <div className="font-pixel text-px-xs text-aic-text space-y-1">
            <div><span className="text-aic-text-dim">API:</span> localhost:6868</div>
            <div><span className="text-aic-text-dim">Provider:</span> http://192.168.2.11:20128/v1</div>
            <div><span className="text-aic-text-dim">Version:</span> {health?.version ?? 'unknown'}</div>
          </div>
        </div>

        <div className="panel p-4">
          <div className="font-pixel text-px-xs text-aic-text-dim mb-3 uppercase">Danger Zone</div>
          <div className="flex items-center justify-between">
            <span className="font-pixel text-px-xs text-aic-text">Clear all tasks, history, and status</span>
            <button 
              onClick={handleReset}
              disabled={resetting}
              className="font-pixel text-px-xs px-4 py-2 border-2 border-aic-red text-aic-red hover:bg-aic-red hover:text-white transition-colors disabled:opacity-50"
            >
              {resetting ? 'RESETTING...' : 'FACTORY RESET'}
            </button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}