import type { WorkerState } from '../../types';

const statusColors: Record<WorkerState, { bg: string; text: string; border: string }> = {
  idle: { bg: 'bg-status-idle-bg', text: 'text-status-idle-text', border: 'border-status-idle-border' },
  working: { bg: 'bg-status-work-bg', text: 'text-aic-yellow', border: 'border-status-work-border' },
  complete: { bg: 'bg-status-done-bg', text: 'text-aic-green', border: 'border-status-done-border' },
  error: { bg: 'bg-status-err-bg', text: 'text-aic-red', border: 'border-status-err-border' },
};

interface StatusBadgeProps {
  status: WorkerState | string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const colors = statusColors[status as WorkerState] ?? statusColors.idle;
  return (
    <span className={`inline-block px-2 py-0.5 font-pixel text-px-xs border ${colors.bg} ${colors.text} ${colors.border}`}>
      {status.toUpperCase()}
    </span>
  );
}
