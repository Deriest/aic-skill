interface EmptyStateProps {
  message: string;
  icon?: string;
}

export function EmptyState({ message, icon = '◇' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="font-pixel text-px-xl text-aic-text-muted mb-3">{icon}</div>
      <div className="font-pixel text-px-sm text-aic-text-dim">{message}</div>
    </div>
  );
}
