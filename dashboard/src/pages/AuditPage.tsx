import { useState, useEffect } from 'react';
import { PageShell } from '../components/shared/PageShell';
import { EmptyState } from '../components/shared/EmptyState';
import { usePagination } from '../hooks/usePagination';
import { getAudit } from '../api/audit';
import type { AuditEntry } from '../types';

export function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');

  useEffect(() => {
    getAudit().then(setEntries).catch(() => {});
  }, []);

  const filtered = entries.filter((e) => {
    if (levelFilter !== 'all' && e.level !== levelFilter) return false;
    if (filter && !e.action.toLowerCase().includes(filter.toLowerCase()) && !e.actor.toLowerCase().includes(filter.toLowerCase()) && !e.details.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  const { page, totalPages, paged, next, prev } = usePagination(filtered, 20);

  const levelColor: Record<string, string> = { info: 'text-aic-accent', warning: 'text-aic-yellow', error: 'text-aic-red' };

  return (
    <PageShell title="AUDIT LOG">
      <div className="flex flex-col gap-3 h-full">
        <div className="flex gap-2 items-center flex-wrap">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search..."
            className="bg-aic-bg-dark border-2 border-aic-border text-aic-text font-pixel text-px-xs p-2 focus:outline-none focus:border-aic-accent min-w-[200px]"
          />
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="bg-aic-bg-dark border-2 border-aic-border text-aic-text font-pixel text-px-xs p-2 focus:outline-none focus:border-aic-accent"
          >
            <option value="all">ALL LEVELS</option>
            <option value="info">INFO</option>
            <option value="warning">WARNING</option>
            <option value="error">ERROR</option>
          </select>
          <span className="font-pixel text-px-xs text-aic-text-dim ml-auto">{filtered.length} entries</span>
        </div>
        <div className="panel flex-1 min-h-0 overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState message="No audit entries" icon="◉" />
          ) : (
            <table className="w-full font-pixel text-px-sm">
              <thead>
                <tr className="border-b-2 border-aic-border">
                  <th className="text-left px-3 py-2 text-aic-text-dim">TIMESTAMP</th>
                  <th className="text-left px-3 py-2 text-aic-text-dim">ACTOR</th>
                  <th className="text-left px-3 py-2 text-aic-text-dim">ACTION</th>
                  <th className="text-left px-3 py-2 text-aic-text-dim">DETAILS</th>
                  <th className="text-left px-3 py-2 text-aic-text-dim">LEVEL</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((e) => (
                  <tr key={e.id} className="border-b border-aic-border hover:bg-aic-bg-panel-dark">
                    <td className="px-3 py-2 text-aic-text-dim whitespace-nowrap">{new Date(e.timestamp).toLocaleString()}</td>
                    <td className="px-3 py-2 text-aic-text">{e.actor}</td>
                    <td className="px-3 py-2 text-aic-accent">{e.action}</td>
                    <td className="px-3 py-2 text-aic-text max-w-xs truncate">{e.details}</td>
                    <td className={`px-3 py-2 font-pixel text-px-xs ${levelColor[e.level] ?? 'text-aic-text-dim'}`}>{e.level.toUpperCase()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-aic-border">
              <button onClick={prev} disabled={page === 0} className="font-pixel text-px-xs text-aic-accent disabled:opacity-30">◄ PREV</button>
              <span className="font-pixel text-px-xs text-aic-text-dim">{page + 1} / {totalPages}</span>
              <button onClick={next} disabled={page >= totalPages - 1} className="font-pixel text-px-xs text-aic-accent disabled:opacity-30">NEXT ►</button>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
