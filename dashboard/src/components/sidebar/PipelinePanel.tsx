import { AnimatePresence } from 'framer-motion';
import { useDashboard } from '../../context/DashboardContext';
import { PipelinePhase } from './PipelinePhase';

export function PipelinePanel() {
  const { state } = useDashboard();

  return (
    <div className="panel p-3 flex-1">
      <div className="font-pixel text-px-base text-aic-accent mb-2.5 uppercase tracking-wide" style={{ textShadow: '0 0 5px rgba(0, 212, 255, 0.5)' }}>
        ▸ PIPELINE
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
