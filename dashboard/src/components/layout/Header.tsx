import { NavLink } from 'react-router-dom';
import { useDashboard } from '../../context/DashboardContext';
import { ConnectionIndicator } from './ConnectionIndicator';

const navItems = [
  { path: '/', label: 'OVERVIEW', icon: '▦' },
  { path: '/chat', label: 'CHAT', icon: '◉' },
  { path: '/config', label: 'CONFIG', icon: '⚙' },
  { path: '/tasks', label: 'TASKS', icon: '☐' },
  { path: '/workers', label: 'WORKERS', icon: '◈' },
  { path: '/history', label: 'HISTORY', icon: '◷' },
  { path: '/audit', label: 'AUDIT', icon: '◉' },
  { path: '/system', label: 'SYSTEM', icon: '▣' },
];

export function Header() {
  const { state } = useDashboard();

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-b from-[#16213e] to-aic-bg-dark border-b-4 border-aic-accent relative">
      <div className="px-4 py-3 md:px-6 md:py-3 flex justify-between items-center">
        <h1 className="font-pixel text-px-lg text-aic-accent text-glow-accent tracking-wider shrink-0">
          ▸ AIC OFFICE
        </h1>
        <nav className="flex gap-1 ml-4 overflow-x-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `font-pixel text-px-xs px-2 py-1.5 whitespace-nowrap border-2 transition-colors ${
                  isActive
                    ? 'border-aic-accent text-aic-accent bg-aic-bg-panel'
                    : 'border-transparent text-aic-text-dim hover:text-aic-text hover:border-aic-border'
                }`
              }
            >
              <span className="mr-1">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <ConnectionIndicator connected={state.connected} />
      </div>
      {/* Animated dashed border */}
      <div className="absolute bottom-0 left-0 w-full h-1 overflow-hidden translate-y-full">
        <div className="w-[200%] h-full animate-scroll-border" style={{
          background: 'repeating-linear-gradient(90deg, #00d4ff 0px, #00d4ff 8px, transparent 8px, transparent 16px)',
        }} />
      </div>
    </header>
  );
}
