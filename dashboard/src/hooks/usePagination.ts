import { useState, useCallback } from 'react';

export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const paged = items.slice(page * pageSize, (page + 1) * pageSize);

  const next = useCallback(() => setPage((p) => Math.min(p + 1, totalPages - 1)), [totalPages]);
  const prev = useCallback(() => setPage((p) => Math.max(p - 1, 0)), []);
  const goTo = useCallback((p: number) => setPage(Math.max(0, Math.min(p, totalPages - 1))), [totalPages]);

  return { page, totalPages, paged, next, prev, goTo };
}
