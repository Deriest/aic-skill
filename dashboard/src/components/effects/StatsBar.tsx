import { useDashboard } from '../../context/DashboardContext';
import { StatBox } from './StatBox';
import { WORKERS } from '../../data/workers';

export function StatsBar() {
  const { state } = useDashboard();

  const agents = Object.values(state.agents);
  const total = WORKERS.length; // Always use full worker count
  const active = agents.filter((a) => a.status === 'working').length;
  const complete = agents.filter((a) => a.status === 'complete').length;
  const idle = total - active - complete;

  return (
    <div className="grid grid-cols-3 divide-x divide-aic-accent/20 bg-aic-bg-dark border-t-2 border-aic-accent shadow-[0_-5px_15px_rgba(0,0,0,0.5)]">
      <div className="p-3">
        <StatBox value={active} label="ACTIVE" color="#00d4ff" glowColor="rgba(0, 212, 255, 0.5)" />
      </div>
      <div className="p-3">
        <StatBox value={complete} label="COMPLETE" color="#00ff88" glowColor="rgba(0, 255, 136, 0.5)" />
      </div>
      <div className="p-3">
        <StatBox value={idle} label="IDLE" color="#6b7280" glowColor="rgba(107, 114, 128, 0.3)" />
      </div>
    </div>
  );
}
