import { AnimatePresence } from 'framer-motion';
import { useDashboard } from '../../context/DashboardContext';
import { LogEntry } from './LogEntry';

export function ActivityLog() {
  const { state } = useDashboard();

  return (
    <div className="panel p-4 flex flex-col">
      <div className="font-pixel text-px-base text-aic-accent mb-3 uppercase tracking-wide" style={{ textShadow: '0 0 5px rgba(0, 212, 255, 0.5)' }}>
        ▸ ACTIVITY LOG
      </div>
      <div className="font-pixel text-px-sm max-h-[300px] overflow-y-auto overflow-x-hidden bg-[#050510] p-3 border-2 border-[#1a1a2a]">
        <AnimatePresence initial={false}>
          {state.logEntries.length === 0 ? (
            <div className="text-aic-text-muted">Waiting for activity...</div>
          ) : (
            state.logEntries.map((entry) => (
              <LogEntry key={entry.id} entry={entry} />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
