# Dashboard Operations Control Center — IMP-001 Patterns

## Dispatcher State Machine

**NEVER show "Idle" or "Complete" for dispatcher state.**

Frontend mapping (PipelineTracker.tsx gate logic):
- No currentTask → **ONLINE** (green)
- Rework active → **RECOVERING** (red)
- PM Review + rework verdicts → **RECOVERING** (red)
- PM Review pending → **WAITING APPROVAL** (yellow)
- Runtime Gate blocked → **RECOVERING** (red)
- Phase Barrier active + incomplete → **MONITORING** (yellow)
- Active workers → **DISPATCHING** (cyan)
- Phase executing → **MONITORING** (yellow)
- Default fallback → **ONLINE** (green)

Source: `state.workers?.dispatcher?.status` from backend + frontend context.

## Runtime Timer

**NEVER show server uptime as task timer.**

- No active task → `00:00:00` (static span)
- Active task → `(state.currentTask as any).startedAt` → ElapsedTimer
- Task completed → reset to `00:00:00`

Backend: `startedAt` on task-start request sets the epoch. Frontend `Date.now() - startedAt` computes elapsed.

Pitfall: `state.startedAt` is the SERVER start time (DashboardContext initialState: `Date.now()`), NOT the task start time. Use `state.currentTask.startedAt` instead.

## Performance Panel

Replaces the static AIC.png image. **Single-column vertical layout** (`flex flex-col`). Live data from `/api/metrics/summary` (polls every 5s):

| Metric | API Path | Display | Color |
|--------|----------|---------|-------|
| RSS | `memory.rss` | `{Math.round(rss/1048576)} MB` | yellow |
| Heap | `memory.heapUsed` | `{Math.round(heap/1048576)} MB` | yellow |
| Load 1m | `cpu.loadAvg[0]` | `toFixed(2)` | cyan |
| Load 5m | `cpu.loadAvg[1]` | `toFixed(2)` | cyan |
| Cores | `cpu.cores` | direct | white |
| Total Requests | `totalRequests` | direct | green |
| Total Input | `totalInput` | `{Math.round(total/1000)}k` | green |
| Total Output | `totalOutput` | `{Math.round(total/1000)}k` | green |

**Title "PERFORMANCE"** renders ABOVE the card (not inside it). Pattern: `▶ PERFORMANCE` heading in a wrapper div, then the `bg-aic-bg-panel` card below.

No backend changes required — all data already exposed via existing endpoints.

## Right Panel Order (top to bottom)

1. **Pipeline & Runtime Gate** — `flex-none`, shared container
2. **PERFORMANCE** — single-column metric list
3. **STATUS** — 4-column grid with `mt-1` spacing above

## Layout Ratios

| Section | Value |
|---------|-------|
| Virtual Office (left) | `flex-[1.5]` |
| Right panel | `flex-1` |
| Office height | `h-[94%]` |
| PipelineTracker cards | `h-[180px]` each, `h-[215px]` container |
| STATUS cards | `h-[100px]` fixed |

User preference: Virtual Office should NOT be `h-full` — too tall. `h-[94%]` provides visible gap at bottom. Preserve this.

## Dispatcher Status (WorkerGrid Override)

**When server is connected, dispatcher ALWAYS shows `working` status.** Override in WorkerGrid.tsx:

```typescript
if (worker.id === 'dispatcher' && state.connected) uiStatus = 'working';
```

This applies to both the card rendering and the OverviewPage stats counter. Backend may return `idle` for dispatcher — the frontend override ensures the card always shows yellow WORKING theme when the server is live.

DELEGATE badge renders when `worker.id === 'dispatcher' && status === 'working'`.

## Worker Summary Cards (STATUS section)

4-column grid, fixed `h-[100px]` per card:
- WORKING (yellow) — with progress bar
- COMPLETE (green) — with progress bar
- IDLE (gray)
- TOTAL (white)

Title "▶ STATUS" above the grid. Data: `WORKERS.filter()` based on `state.workers[w.id].status` (with dispatcher override to always count as working when connected).

## Spacing Rules

- Parent flex container has NO `gap` — spacing is per-section via `mt-*` / `mb-*`
- Pipeline/Runtime Gate container: `h-[215px]` shared, `grid grid-cols-2` for equal card heights
- Between PERFORMANCE and STATUS: `mt-1` (4px)
- STATUS title `mb-1` above cards
