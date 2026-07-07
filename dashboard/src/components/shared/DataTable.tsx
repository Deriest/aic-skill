import { useState } from 'react';

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, unknown>>({ columns, data, emptyMessage = 'No data' }: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : data;

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  if (data.length === 0) {
    return <div className="font-pixel text-px-sm text-aic-text-dim p-4 text-center">{emptyMessage}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full font-pixel text-px-sm">
        <thead>
          <tr className="border-b-2 border-aic-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`text-left px-3 py-2 text-aic-text-dim uppercase tracking-wider ${col.sortable ? 'cursor-pointer hover:text-aic-accent' : ''}`}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                {col.label}
                {sortKey === col.key && (
                  <span className="ml-1 text-aic-accent">{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((item, i) => (
            <tr key={i} className="border-b border-aic-border hover:bg-aic-bg-panel-dark transition-colors">
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-2 text-aic-text">
                  {col.render ? col.render(item) : String(item[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
