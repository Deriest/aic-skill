interface MetricCardProps {
  label: string;
  value: string | number;
  color?: string;
  sub?: string;
}

export function MetricCard({ label, value, color = '#00d4ff', sub }: MetricCardProps) {
  return (
    <div className="panel p-3 flex flex-col">
      <div className="font-pixel text-px-xs text-aic-text-dim uppercase tracking-wider mb-1">{label}</div>
      <div className="font-pixel text-px-lg" style={{ color, textShadow: `0 0 10px ${color}40` }}>
        {value}
      </div>
      {sub && <div className="font-pixel text-px-xs text-aic-text-muted mt-1">{sub}</div>}
    </div>
  );
}
