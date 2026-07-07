import { useState, useEffect } from 'react';
import { PageShell } from '../components/shared/PageShell';
import { EmptyState } from '../components/shared/EmptyState';
import { usePagination } from '../hooks/usePagination';
import { getHistory, getAnalytics } from '../api/history';
import type { HistoryEntry, AnalyticsData } from '../types';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const { page, totalPages, paged, next, prev } = usePagination(entries, 20);

  useEffect(() => {
    getHistory().then(setEntries).catch(() => {});
    getAnalytics().then(setAnalytics).catch(() => {});
  }, []);

  const chartColors = {
    accent: '#00d4ff',
    green: '#00ff88',
    yellow: '#ffcc00',
    red: '#ff4444',
    grid: '#2a2a4a',
    dim: '#6b7280',
  };

  return (
    <PageShell title="HISTORY">
      <div className="flex flex-col gap-4 h-full">
        {/* Analytics Charts */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="panel p-3">
              <div className="font-pixel text-px-xs text-aic-text-dim mb-2">TASKS / DAY</div>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={analytics.tasksByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis dataKey="date" tick={{ fontSize: 8, fill: chartColors.dim }} />
                  <YAxis tick={{ fontSize: 8, fill: chartColors.dim }} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a4a', fontSize: 10 }} />
                  <Bar dataKey="count" fill={chartColors.accent} />
                  <Bar dataKey="errors" fill={chartColors.red} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="panel p-3">
              <div className="font-pixel text-px-xs text-aic-text-dim mb-2">TOKENS / DAY</div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={analytics.tokensByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis dataKey="date" tick={{ fontSize: 8, fill: chartColors.dim }} />
                  <YAxis tick={{ fontSize: 8, fill: chartColors.dim }} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a4a', fontSize: 10 }} />
                  <Line type="monotone" dataKey="input" stroke={chartColors.accent} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="output" stroke={chartColors.green} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="panel p-3">
              <div className="font-pixel text-px-xs text-aic-text-dim mb-2">COST / DAY</div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={analytics.costByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis dataKey="date" tick={{ fontSize: 8, fill: chartColors.dim }} />
                  <YAxis tick={{ fontSize: 8, fill: chartColors.dim }} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a4a', fontSize: 10 }} />
                  <Line type="monotone" dataKey="cost" stroke={chartColors.yellow} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* History Table */}
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
                    <th className="text-left px-3 py-2 text-aic-text-dim">STATUS</th>
                    <th className="text-left px-3 py-2 text-aic-text-dim">DURATION</th>
                    <th className="text-left px-3 py-2 text-aic-text-dim">COST</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((e) => (
                    <tr key={e.id} className="border-b border-aic-border hover:bg-aic-bg-panel-dark">
                      <td className="px-3 py-2 text-aic-text">{e.title}</td>
                      <td className="px-3 py-2 text-aic-text-dim">{e.type}</td>
                      <td className="px-3 py-2">
                        <span className={`font-pixel text-px-xs ${e.status === 'complete' ? 'text-aic-green' : e.status === 'error' ? 'text-aic-red' : 'text-aic-yellow'}`}>
                          {e.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-aic-text-dim">{Math.round(e.duration / 1000)}s</td>
                      <td className="px-3 py-2 text-aic-yellow">${e.cost.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-3 py-2 border-t border-aic-border">
                <button onClick={prev} disabled={page === 0} className="font-pixel text-px-xs text-aic-accent disabled:opacity-30">◄ PREV</button>
                <span className="font-pixel text-px-xs text-aic-text-dim">{page + 1} / {totalPages}</span>
                <button onClick={next} disabled={page >= totalPages - 1} className="font-pixel text-px-xs text-aic-accent disabled:opacity-30">NEXT ►</button>
              </div>
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}
