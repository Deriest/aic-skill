import { useState, useEffect } from 'react';
import { PageShell } from '../components/shared/PageShell';
import { EmptyState } from '../components/shared/EmptyState';
import { usePagination } from '../hooks/usePagination';
import { getAudit } from '../api/audit';

interface RawAuditEntry {
  timestamp: string;
  action: string;
  actor: string;
  details: unknown;
}

export function AuditPage() {
  const [entries, setEntries] = useState<RawAuditEntry[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    getAudit().then(setEntries).catch(() => {});
  }, []);

  const filtered = entries.filter((e) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    const det = typeof e.details === 'string' ? e.details : JSON.stringify(e.details ?? {});
    return e.action.toLowerCase().includes(q) || e.actor.toLowerCase().includes(q) || det.toLowerCase().includes(q);
  });

  const { page, totalPages, paged, next, prev } = usePagination(filtered, 20);

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
                </tr>
              </thead>
              <tbody>
                {paged.map((e, i) => (
                  <tr key={i} className="border-b border-aic-border hover:bg-aic-bg-panel-dark">
                    <td className="px-3 py-2 text-aic-text-dim whitespace-nowrap">{new Date(e.timestamp).toLocaleString()}</td>
                    <td className="px-3 py-2 text-aic-text">{e.actor}</td>
                    <td className="px-3 py-2 text-aic-accent">{e.action}</td>
                    <td className="px-3 py-2 text-aic-text max-w-xs truncate font-mono text-xs">
                      {typeof e.details === 'string' ? e.details : JSON.stringify(e.details ?? {})}
                    </td>
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
