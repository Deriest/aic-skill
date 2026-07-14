# Dashboard Operations Control Center — IMP-001 Patterns

> **Related:** `references/layout-foundation.md` (IMP-002), `references/polling-consolidation.md` (FIX-003)

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

## Runtime Timer (RUNTIME GATE header)

**NEVER use `state.startedAt`, `/health` uptime, or engine uptime** — those are server/process clocks.

Implementation: `TaskRuntimeTimer` in `PipelineTracker.tsx` + `dashboard/src/utils/taskTimer.ts`.

| State | Display |
|-------|---------|
| `currentTask === null` | `00:00:00` |
| Task running | `now - startedAt`, tick every 1s |
| Terminal (`COMPLETE`, `BLOCKED`, `failed`, `cancelled`) | **Frozen** at `finishedAt - startedAt` |

**Task timestamps (no Runtime API change):** poll existing public `GET /api/tasks/:id` — `context.createdAt` → `startedAtMs`; `state.lastActivity` (or `finishedAt`) → freeze end. Re-fetch when `task.id` or terminal fields change so dashboard refresh restores correct elapsed/frozen value.

Pitfall (pre-2026-07-14): fallback `state.startedAt` made the gate timer look like **server uptime** after restart.

Pitfall: `currentTask` on `/api/status` does **not** include `startedAt` — do not assume task fields on status payload alone.

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

## Layout Ratios (Updated: IMP-002)

| Section | Value |
|---------|-------|
| Virtual Office (left) | `flex-[1.5] min-h-0` (no `h-full`, no `h-[94%]`) |
| Right panel | `flex-1 min-h-0` |
| Office height | `flex-1 min-h-0` (natural flex, no magic %) |
| Current Task card | `h-[250px]` |
| PipelineTracker cards | `h-[180px]` each, `h-[215px]` container |
| STATUS cards | `h-[140px]` fixed |

**Layout foundation**: Viewport chain = `html/body/#root` all `height:100%; overflow:hidden`. App root = `h-screen`. OverviewPage = `flex-1 min-h-0` (NOT `h-screen`). See `references/layout-foundation.md` for full patterns.

**Right panel scroll**: Wrapped in `ScrollContainer` with CSS scroll shadows. All panels inside use `shrink-0`.

## Polling Architecture (FIX-003)

**Single source per endpoint.** All polling lives in `DashboardProvider`:

| Endpoint | Interval | Consumer |
|----------|----------|----------|
| `/api/status` | 5s | `dispatch(SET_STATE)` → React Context |
| `/api/metrics/summary` | 5s | `setMetrics()` → React Context `metrics` |

Components read from context — no independent `fetch` calls. `PerfPanel` reads `useDashboardContext().metrics`. 

**Deleted hooks:** `useStatusPolling.ts` (merged into provider), `useDashboardState.ts` (duplicate poller).

**Anti-pattern:** Multiple components polling the same endpoint independently causes HTTP 429. Always consolidate into a single provider/context.

**MetricsState shape:**
```typescript
interface MetricsState {
  memory?: { rss: number; heapUsed: number; heapTotal: number };
  cpu?: { loadAvg: number[]; cores: number };
  totalRequests?: number;
  totalInput?: number;
  totalOutput?: number;
}
```

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
- Pipeline/Runtime Gate container: shared, `grid grid-cols-2` for equal card heights
- Between PERFORMANCE and STATUS: `mt-2` (8px)
- STATUS title `mb-1` above cards
- Right panel: no parent `gap` — all spacing is explicit per-section
- All right-panel sections use `shrink-0` inside `ScrollContainer`
