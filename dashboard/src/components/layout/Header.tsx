import { Link, useLocation } from 'react-router-dom';
import { useDashboard } from '../../context/DashboardContext';

const NAV_ITEMS = [
  { path: '/', label: 'OVERVIEW', icon: '▦', guide: 'Office view — see all workers' },
  { path: '/chat', label: 'CHAT', icon: '◉', guide: 'Talk to Orchestrator — create tasks here' },
  { path: '/config', label: 'CONFIG', icon: '⚙', guide: 'Tier settings, API keys, model config' },
  { path: '/tasks', label: 'TASKS', icon: '☐', guide: 'Task queue and current task status' },
  { path: '/workers', label: 'WORKERS', icon: '◈', guide: 'Worker monitor — status, tokens, cost' },
  { path: '/history', label: 'HISTORY', icon: '◷', guide: 'Completed tasks and analytics' },
  { path: '/audit', label: 'AUDIT', icon: '◉', guide: 'Full audit log of all actions' },
  { path: '/system', label: 'SYSTEM', icon: '▣', guide: 'Health, uptime, cost, environment' },
];

export function Header() {
  const location = useLocation();
  const { state } = useDashboard();
  const isOnline = state.connected;

  return (
    <header className="border-b-2 border-aic-accent bg-aic-surface px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-pixel text-px-lg text-aic-accent">▸ AIC OFFICE</span>
          <span className="font-pixel text-px-xs text-aic-text-muted hidden sm:inline">Control Plane</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-aic-green' : 'bg-aic-red'}`} />
          <span className={`font-pixel text-px-sm ${isOnline ? 'text-aic-green' : 'text-aic-red'}`}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      <nav className="flex gap-1 mt-3 overflow-x-auto pb-1">
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              title={item.guide}
              className={`
                font-pixel text-px-sm px-4 py-2 border-2 transition-all whitespace-nowrap
                flex items-center gap-2
                ${active
                  ? 'border-aic-accent text-aic-accent bg-aic-surface shadow-[0_0_8px_rgba(0,212,255,0.3)]'
                  : 'border-transparent text-aic-text-muted hover:border-aic-border hover:text-aic-text'}
              `}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
              {item.guide && <span className="text-aic-yellow text-px-xs ml-1 opacity-60">(!)</span>}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
