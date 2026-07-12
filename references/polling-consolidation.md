# Dashboard Polling Consolidation (FIX-003)

## Architecture Rule

**One endpoint = one polling source.** All polling lives in `DashboardProvider` (DashboardContext.tsx). Components read from React Context, never fetch independently.

## Polling Schedule

| Endpoint | Interval | Method |
|----------|----------|--------|
| `/api/status` | 5000ms | `dispatch(SET_STATE)` |
| `/api/metrics/summary` | 5000ms | `setMetrics()` |
| `/api/tasks` | 10000ms | (not yet implemented) |
| `/api/history` | Only when History tab active | (not yet implemented) |
| `/api/config` | Once on load | Manual refresh |

## Context Shape

```typescript
// DashboardContext exports:
{ state: DashboardState, dispatch: Dispatch, metrics: MetricsState }

interface MetricsState {
  memory?: { rss: number; heapUsed: number; heapTotal: number };
  cpu?: { loadAvg: number[]; cores: number };
  totalRequests?: number;
  totalInput?: number;
  totalOutput?: number;
}
```

## Component Consumption Pattern

```tsx
// PerfPanel reads from context (no useState, no useEffect, no fetch)
function PerfPanel() {
  const { metrics } = useDashboardContext();
  const memMB = metrics?.memory ? Math.round(metrics.memory.rss / 1048576) : '—';
  // ...
}
```

## Anti-Patterns Caught

1. **1.5s polling interval** — caused HTTP 429. Fixed to 5s.
2. **Duplicate hook** (`useDashboardState.ts`) — polled same endpoint as `useStatusPolling.ts`. Deleted.
3. **Independent PerfPanel fetch** — component had own `setInterval(fetch, 5000)`. Moved to context.
4. **Orphaned hook** (`useStatusPolling.ts`) — was imported in App.tsx but polling moved to provider. Deleted.

## Timer Cleanup Checklist

Every `setInterval` must have matching `clearInterval` in useEffect cleanup:
```tsx
useEffect(() => {
  let mounted = true;
  const poll = async () => { /* ... */ };
  poll();
  const i = setInterval(poll, 5000);
  return () => { mounted = false; clearInterval(i); };
}, []);
```

The `mounted` flag prevents setState after unmount. The cleanup function prevents duplicate timers after hot reload.

## Verification

```bash
# Count setIntervals in build — should be exactly 1
grep -c "setInterval" dist/assets/index-*.js

# Check for 429
curl -sf -o /dev/null -w "%{http_code}" http://localhost:6868/api/status
# Repeat 3x rapidly — all should be 200
```
