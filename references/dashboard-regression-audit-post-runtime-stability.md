# Dashboard regression audit — after Runtime Stability commit (45b04e8)

Runtime bundle **excluded** `dashboard/**`. UI drift vs IMP-001 baseline is **uncommitted local work** + **persisted runtime state**, not FIX-008–021.

## Uncommitted dashboard files (separate UI commit)

| File | Change | Milestone |
|------|--------|-----------|
| `DashboardContext.tsx` | `MetricsState.latency.sli`, `total` | Dashboard Observability |
| `OverviewPage.tsx` | API p99, Err budget left, `metrics.total` fallback | Dashboard Observability |
| `types/index.ts` | `pipelineState`/`phaseStatus` on task, `engine`, `failed`, `leaseId` | UI parity with engine |

**Not required for Runtime Stability.** Runtime does not break if excluded.

## “Current task feels cumulative”

- **CURRENT TASK** panel = single `state.currentTask` from `/api/status` (not task history).
- Commit **`3bc022d`**: persist last task when pipeline stops.
- Engine clears `currentTask` only on **COMPLETE**; **failed/BLOCKED** tasks remain visible while idle.
- Workers in `.aic/state.json` may still show old `currentTask` ids — office looks “stacked.”
- **Total Requests** in PERFORMANCE = lifetime `metrics.json` count — cumulative by design, not per-task.

## Performance panel scope creep

- Baseline IMP-001/FIX-003 (`692aefd`): RSS, heap, load, cores, totalRequests/Input/Output only.
- **p99 / error budget** rows: **uncommitted** UI; data from **`summary.latency`** already returned by `server.js` (45b04e8) — backend adjacent, not user-requested dashboard scope.

## Font regression (investigation)

- Intended: **Press Start 2P** via Google Fonts + `font-pixel`.
- Not changed in 45b04e8. Perceived drift: `body { antialiased }`, undefined Tailwind `font-body` on `App.tsx`/`HistoryPage`, CDN/cache miss → monospace fallback.

## Minimal corrective actions (dashboard milestone)

1. ~~Revert or isolate observability rows until approved.~~ **Done** (2026-07-14): p99 + error budget rows removed from `OverviewPage.tsx`; PERFORMANCE restored to 7-row baseline. Data still in API/polling for future observability pages.
2. Label **LAST TASK** or clear UI when `pipelineRunning === false` + terminal `phaseStatus` (UI-only ok).
3. Rebuild `dashboard/dist` after source decisions.
4. ~~Font: drop `antialiased` on pixel body; define `fontFamily.body` or use `font-pixel` consistently.~~ **Done** (2026-07-14): FIX-022 self-hosted Press Start 2P, removed `antialiased`, removed Google Fonts CDN. See `references/dashboard-fix022-selfhost-pixel-font.md`.

## Related

- `references/dashboard-operations-control-center.md` — PERFORMANCE baseline + timer
- `references/polling-consolidation.md` — metrics provider