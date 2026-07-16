# IMP-001: Operations Control Center — Final Patterns

## Layout Structure

### Right Panel Sections (top to bottom)
1. **CURRENT TASK** — `h-[250px]` container, task info or `[ WAITING FOR TASK ]`
2. **PIPELINE / RUNTIME GATE** — side-by-side, `h-[180px]` each, titles `h-[28px]`
3. **PERFORMANCE** — single column, 8 metrics (RSS, Heap, Load 1m, Load 5m, Cores, Total Requests, Total Input, Total Output)
4. **STATUS** — 4 cards `h-[140px]` (Working/Complete/Idle/Total), `mt-2` spacing from Performance

### Left Panel
- Virtual Office: `flex-[1.5]` ratio, `h-[94%]` card height
- Worker desks: `mt-2` spacing from avatar

## Status Theme Colors (CSS variables)

| Status | Border | Text | Pulse/Glow | Badge bg |
|--------|--------|------|------------|----------|
| working | `border-aic-yellow` | `text-aic-yellow` | `shadow-[0_0_15px_rgba(255,204,0,0.15)]` | `bg-aic-yellow/10` |
| idle | `border-gray-500/50` | `text-gray-400` | `shadow-[0_0_10px_rgba(107,114,128,0.1)]` | `bg-gray-800/50` |
| complete | `border-aic-green` | `text-aic-green` | `shadow-[0_0_15px_rgba(0,200,83,0.15)]` | `bg-aic-green/10` |

### Dispatcher Special Rule
Dispatcher NEVER shows "idle" — when server is connected, always maps to "working" status.
- In `WorkerGrid.tsx`: `if (worker.id === 'dispatcher' && uiStatus === 'idle') uiStatus = 'working';`
- In `OverviewPage.tsx` stats: same logic for working count

## Pitfalls

### Build/serve cycle (CRITICAL)
AIC server serves from `dashboard/dist/`. After editing `.tsx` files:
1. `cd dashboard && npm run build`
2. Verify: `stat -c '%Y' dist/index.html` must be NEWER than source
3. Restart server: `kill -9 $(lsof -t -i:6868) && node scripts/server.js 6868`
4. Browser: `Ctrl+Shift+R` (hard refresh) — regular refresh may show cached version

### Python replace with unicode
Python `str.replace()` FAILS SILENTLY when the search string contains unicode arrows (▶, →). Use the `patch` tool instead for files with unicode characters.

### Server state resets on restart
`/api/reset` or server restart clears all worker statuses. After restart, workers show as "idle" — must manually set working status via API:
```bash
curl -sf -X POST -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  http://localhost:6868/api/agent-status \
  -d '{"agent":"frontend","status":"complete","engine":"opencode","currentTask":"test"}'
```

### flex-[1.5] revert trap
When reverting Grid→Flex layout, `flex-[1.5]` class is easily lost. Always verify `<div className="flex-[1.5] flex flex-col min-w-0 h-full">` exists after revert — without it, Virtual Office collapses to equal ratio with right panel.

## Performance Metrics Source
`/api/metrics/summary` returns: `memory.{rss,heapUsed,heapTotal}`, `cpu.{loadAvg[],cores}`, `totalRequests`, `totalInput`, `totalOutput`, `cost.{total}`.
