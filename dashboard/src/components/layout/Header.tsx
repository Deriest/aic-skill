import { useDashboard } from '../../context/DashboardContext';
import { ConnectionIndicator } from './ConnectionIndicator';

export function Header() {
  const { state } = useDashboard();

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-b from-[#16213e] to-aic-bg-dark border-b-4 border-aic-accent px-4 py-3 md:px-6 md:py-4 flex justify-between items-center relative mb-2">
      <h1 className="font-pixel text-px-xl text-aic-accent text-glow-accent tracking-wider">
        ▸ AIC OFFICE
      </h1>
      <ConnectionIndicator connected={state.connected} />
      {/* Animated dashed border */}
      <div className="absolute bottom-0 left-0 w-full h-1 overflow-hidden translate-y-full">
        <div className="w-[200%] h-full animate-scroll-border" style={{
          background: 'repeating-linear-gradient(90deg, #00d4ff 0px, #00d4ff 8px, transparent 8px, transparent 16px)',
        }} />
      </div>
    </header>
  );
}
