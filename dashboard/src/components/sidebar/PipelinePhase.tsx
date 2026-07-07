import { motion } from 'framer-motion';
import type { Phase } from '../../types';

interface PipelinePhaseProps {
  phase: Phase;
  index: number;
}

const statusConfig = {
  complete: { icon: '✓', className: 'done', borderColor: '#00ff88', color: '#00ff88' },
  working: { icon: '►', className: 'active', borderColor: '#ffcc00', color: '#ffcc00' },
  pending: { icon: '○', className: 'pending', borderColor: '#374151', color: '#4b5563' },
};

export function PipelinePhase({ phase, index }: PipelinePhaseProps) {
  const config = statusConfig[phase.status as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: index * 0.05 }}
      className="flex items-center gap-2.5 font-pixel text-px-sm px-2 py-2 bg-aic-bg-panel-dark border-2 border-aic-border"
    >
      <div
        className={`w-5 h-5 flex items-center justify-center text-px-md border-2 ${
          phase.status === 'working' ? 'animate-icon-pulse' : ''
        }`}
        style={{
          borderColor: config.borderColor,
          color: config.color,
        }}
      >
        {config.icon}
      </div>
      <span className="flex-1">{phase.name}</span>
    </motion.div>
  );
}
