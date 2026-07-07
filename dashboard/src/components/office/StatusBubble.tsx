import { AnimatePresence, motion } from 'framer-motion';
import type { WorkerState } from '../../types';

interface StatusBubbleProps {
  status: WorkerState;
}

const bubbleVariants = {
  idle: {
    backgroundColor: '#1f2937',
    color: '#6b7280',
    borderColor: '#374151',
  },
  working: {
    backgroundColor: '#1a1a00',
    color: '#ffcc00',
    borderColor: '#ffcc00',
  },
  complete: {
    backgroundColor: '#001a00',
    color: '#00ff88',
    borderColor: '#00ff88',
  },
  error: {
    backgroundColor: '#1a0000',
    color: '#ff4444',
    borderColor: '#ff4444',
  },
};

export function StatusBubble({ status }: StatusBubbleProps) {
  if (status === 'idle') return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        variants={bubbleVariants}
        initial="idle"
        animate={status}
        exit={{ opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-pixel text-px-sm px-2 py-1 whitespace-nowrap border-2 z-20"
        style={{
          boxShadow: status === 'working' ? '0 0 10px rgba(255, 204, 0, 0.5)' : 'none',
        }}
      >
        {status.toUpperCase()}
      </motion.div>
    </AnimatePresence>
  );
}
