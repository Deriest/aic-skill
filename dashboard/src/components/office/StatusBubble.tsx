import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface StatusBubbleProps {
  status: string;
}

const statusConfig: Record<string, { bg: string, text: string, border: string, shadow: string, label: string }> = {
  idle: { bg: 'bg-gray-800/50', text: 'text-white', border: 'border-gray-500', shadow: 'shadow-[0_0_5px_rgba(107,114,128,0.5)]', label: 'IDLE' },
  working: { bg: 'bg-yellow-900/30', text: 'text-aic-yellow', border: 'border-aic-yellow', shadow: 'shadow-[0_0_5px_rgba(255,204,0,0.6)]', label: 'WORKING' },
  blocked: { bg: 'bg-red-900/30', text: 'text-red-500', border: 'border-red-500', shadow: 'shadow-[0_0_5px_rgba(239,68,68,0.6)]', label: 'BLOCKED' },
  error: { bg: 'bg-red-900/30', text: 'text-red-500', border: 'border-red-500', shadow: 'shadow-[0_0_5px_rgba(239,68,68,0.6)]', label: 'ERROR' },
  complete: { bg: 'bg-green-900/30', text: 'text-aic-green', border: 'border-aic-green', shadow: 'shadow-[0_0_5px_rgba(0,255,136,0.6)]', label: 'COMPLETE' },
  waiting_pm: { bg: 'bg-cyan-900/30', text: 'text-aic-accent', border: 'border-aic-accent', shadow: 'shadow-[0_0_5px_rgba(0,212,255,0.6)]', label: 'WAITING PM' },
  rework: { bg: 'bg-red-900/30', text: 'text-red-400', border: 'border-red-400', shadow: 'shadow-[0_0_5px_rgba(248,113,113,0.6)]', label: 'REWORK' },
};

export const StatusBubble = memo(function StatusBubble({ status }: StatusBubbleProps) {
  const config = statusConfig[status] || statusConfig.idle;
  
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 whitespace-nowrap z-20">
      <AnimatePresence mode="wait">
        <motion.div
          key={status}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          className={`${config.bg} ${config.text} ${config.border} ${config.shadow} px-2 py-0.5 font-pixel text-[7px] rounded border`}
        >
          {config.label}
        </motion.div>
      </AnimatePresence>
    </div>
  );
});
