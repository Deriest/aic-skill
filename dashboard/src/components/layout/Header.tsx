import { Link, useLocation } from 'react-router-dom';
import { useDashboard } from '../../context/DashboardContext';

const NAV_ITEMS = [
  { path: '/', label: 'OVERVIEW', icon: '▦', guide: 'Office view — see all workers' },
  { path: '/tasks', label: 'TASKS', icon: '☐', guide: 'Task queue and current task status' },
  { path: '/history', label: 'HISTORY & AUDIT', icon: '◷', guide: 'Completed tasks and full audit log' },
  { path: '/config', label: 'CONFIG', icon: '⚙', guide: 'Tier settings, API keys, model config' },
  { path: '/system', label: 'SYSTEM', icon: '▣', guide: 'Health, uptime, environment' },
];

export function Header() {
  const location = useLocation();
  const { state } = useDashboard();
  const isOnline = state.connected;

  return (
    <header className="border-b-2 border-aic-accent bg-aic-surface px-4 py-3">
      <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-4">
        
        {/* Left: Branding */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-pixel text-px-lg text-aic-accent tracking-wider">▸ AI ENGINEERING COMPANY</span>
        </div>
        
        {/* Center: Navigation Bar */}
        <nav className="flex gap-1 overflow-x-auto pb-1 2xl:pb-0 flex-1 justify-start 2xl:justify-center">
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

        {/* Right: Status */}
        <div className="flex items-center gap-2 shrink-0 2xl:justify-end">
          <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-aic-green' : 'bg-aic-red'} shadow-[0_0_8px_currentColor]`} />
          <span className={`font-pixel text-px-sm ${isOnline ? 'text-aic-green' : 'text-aic-red'}`}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
        
      </div>
    </header>
  );
}
