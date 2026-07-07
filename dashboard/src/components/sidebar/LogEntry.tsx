import { motion } from 'framer-motion';
import type { LogEntry as LogEntryType } from '../../types';
import { formatTimestamp } from '../../utils/formatters';

interface LogEntryProps {
  entry: LogEntryType;
}

const typeColors: Record<string, string> = {
  info: '#00d4ff',
  success: '#00ff88',
  warning: '#ffcc00',
  error: '#ff4444',
};

export function LogEntry({ entry }: LogEntryProps) {
  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      layout
      className="py-1 border-b border-[#1a1a2a] flex gap-2"
    >
      <span className="text-aic-text-muted flex-shrink-0">[{formatTimestamp(entry.timestamp)}]</span>
      <span className="flex-1" style={{ color: typeColors[entry.type] ?? '#00d4ff' }}>
        {entry.message}
      </span>
    </motion.div>
  );
}
