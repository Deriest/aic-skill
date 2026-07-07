import { useState, useEffect } from 'react';
import { PageShell } from '../components/shared/PageShell';
import { EmptyState } from '../components/shared/EmptyState';
import { usePagination } from '../hooks/usePagination';
import { getHistory, getAnalytics } from '../api/history';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface RawHistoryEntry {
  task: { title: string; type: string; id?: string };
  completedAt: string;
  status?: string;
  duration?: string | number;
  phases?: Array<{ name: string; status: string }>;
  agents?: Record<string, { status: string; engine?: string }>;
  tokens?: { input: number; output: number };
  cost?: number;
}

interface AnalyticsByType {
  [type: string]: { count: number; avgTime: string; avgSeconds: number; successRate: number };
}

export function HistoryPage() {
  const [entries, setEntries] = useState<RawHistoryEntry[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsByType | null>(null);

  useEffect(() => {
    getHistory().then(setEntries).catch(() => {});
    getAnalytics().then(setAnalytics).catch(() => {});
  }, []);

  const { page, totalPages, paged, next, prev } = usePagination(entries, 20);

  const chartData = analytics
    ? Object.entries(analytics).map(([type, d]) => ({ type, count: d.count, rate: Math.round(d.successRate * 100) }))
    : [];

  const chartColors = { accent: '#00d4ff', green: '#00ff88', grid: '#2a2a4a', dim: '#6b7280' };

  return (
    <PageShell title="HISTORY">
      <div className="flex flex-col gap-4 h-full">
        {chartData.length > 0 && (
          <div className="panel p-3">
            <div className="font-pixel text-px-xs text-aic-text-dim mb-2">TASKS BY TYPE</div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="type" tick={{ fontSize: 8, fill: chartColors.dim }} />
                <YAxis tick={{ fontSize: 8, fill: chartColors.dim }} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a4a', fontSize: 10 }} />
                <Bar dataKey="count" fill={chartColors.accent} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="panel flex-1 min-h-0 overflow-y-auto">
          {entries.length === 0 ? (
            <EmptyState message="No task history" icon="⌚" />
          ) : (
            <>
              <table className="w-full font-pixel text-px-sm">
                <thead>
                  <tr className="border-b-2 border-aic-border">
                    <th className="text-left px-3 py-2 text-aic-text-dim">TITLE</th>
                    <th className="text-left px-3 py-2 text-aic-text-dim">TYPE</th>
                    <th className="text-left px-3 py-2 text-aic-text-dim">COMPLETED</th>
                    <th className="text-left px-3 py-2 text-aic-text-dim">DURATION</th>
                    <th className="text-left px-3 py-2 text-aic-text-dim">COST</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((e, i) => (
                    <tr key={i} className="border-b border-aic-border hover:bg-aic-bg-panel-dark">
                      <td className="px-3 py-2 text-aic-text">{e.task?.title ?? 'Unknown'}</td>
                      <td className="px-3 py-2 text-aic-text-dim">{e.task?.type ?? '-'}</td>
                      <td className="px-3 py-2 text-aic-text-dim">{e.completedAt ? new Date(e.completedAt).toLocaleString() : '-'}</td>
                      <td className="px-3 py-2 text-aic-text-dim">{e.duration ?? '-'}</td>
                      <td className="px-3 py-2 text-aic-yellow">{e.cost != null ? `$${Number(e.cost).toFixed(4)}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-3 py-2 border-t border-aic-border">
                  <button onClick={prev} disabled={page === 0} className="font-pixel text-px-xs text-aic-accent disabled:opacity-30">◄ PREV</button>
                  <span className="font-pixel text-px-xs text-aic-text-dim">{page + 1} / {totalPages}</span>
                  <button onClick={next} disabled={page >= totalPages - 1} className="font-pixel text-px-xs text-aic-accent disabled:opacity-30">NEXT ►</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}
