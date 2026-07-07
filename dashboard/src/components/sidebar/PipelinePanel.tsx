import { AnimatePresence } from 'framer-motion';
import { useDashboard } from '../../context/DashboardContext';
import { PipelinePhase } from './PipelinePhase';

export function PipelinePanel() {
  const { state } = useDashboard();

  return (
    <div className="panel p-4 flex-1 h-full border border-aic-border/50 bg-black/40 backdrop-blur-sm overflow-y-auto relative z-10 custom-scrollbar">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-aic-accent/50 to-transparent opacity-50" />
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-aic-accent/20 to-transparent opacity-30" />
      <div className="font-pixel text-px-base text-aic-accent mb-4 uppercase tracking-wider flex items-center gap-2" style={{ textShadow: '0 0 8px rgba(0, 212, 255, 0.6)' }}>
        <span className="animate-pulse">▶</span> PIPELINE
      </div>
      {state.phases.length === 0 ? (
        <div className="font-pixel text-px-sm text-aic-text-muted">NO PIPELINE</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <AnimatePresence>
            {state.phases.map((phase, i) => (
              <PipelinePhase key={`${phase.name}-${i}`} phase={phase} index={i} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
