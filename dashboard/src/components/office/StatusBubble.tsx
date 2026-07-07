import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface StatusBubbleProps {
  status: string;
}

const statusConfig: Record<string, { bg: string, text: string, label: string }> = {
  idle: { bg: 'bg-aic-bg-floor', text: 'text-aic-text-muted', label: 'WAITING FOR TASK' },
  working: { bg: 'bg-aic-accent/20', text: 'text-aic-yellow', label: 'WORKING' },
  blocked: { bg: 'bg-aic-bg-floor', text: 'text-aic-red', label: 'BLOCKED' },
  error: { bg: 'bg-red-900/30', text: 'text-aic-red', label: 'ERROR' },
  complete: { bg: 'bg-aic-green/20', text: 'text-aic-green', label: 'COMPLETE' }
};

export const StatusBubble = memo(function StatusBubble({ status }: StatusBubbleProps) {
  const config = statusConfig[status] || statusConfig.idle;
  
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 whitespace-nowrap z-20">
      <AnimatePresence mode="wait">
        <motion.div
          key={status}
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className={`
            px-2 py-0.5 rounded text-[10px] font-pixel border border-aic-border/30
            ${config.bg} ${config.text}
            ${status === 'working' ? 'shadow-[0_0_8px_rgba(255,255,0,0.3)] animate-pulse' : ''}
          `}
        >
          {config.label}
        </motion.div>
      </AnimatePresence>
    </div>
  );
});