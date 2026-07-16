# Runtime checkpoint ↔ dashboard task isolation (FEAT-001)

## Class of failure

Runtime OAT reports **BLOCKED** for task **A** while **A** has no `reports/*.md`, no leases, and no `checkpoint.json` — yet global `currentTask.id` is **A** with `pipelineState=BLOCKED`.

## Root cause (proven 2026-07-13, TASK-20260713-009)

`syncDashboardFromCheckpoint(cp)` copies `cp.pipelineState`, `phaseStatus`, `phaseBarrier` onto **`state.currentTask` without verifying `cp` belongs to `state.currentTask.id`**.

When two pipelines overlap (e.g. **008** `task.retry` + **009** `task.start`), the **losing** task’s checkpoint update can paint **BLOCKED** onto the **current** task id.

Engine path: `runPhase` → `pm-review.sh` exit ≠ 0 → `cp.pipelineState = 'BLOCKED'` → `syncDashboardFromCheckpoint(cp)`.

`runPmReview` with **zero** artifacts returns `allPass: true, skipped: true` — so **BLOCKED cannot be attributed to PM on an empty `reports/`** for that task id.

## Forensic checklist (no code changes)

1. OAT log: how many polls? Sudden `INVESTIGATE spawning` → `BLOCKED` with no PM lines for that task id?
2. `.aic/tasks/<TASK>/reports/` — any `*.md`?
3. `.aic/tasks/<TASK>/checkpoint.json` — exists? `pipelineState`?
4. `.aic/state.json` — `leases` filtered by `taskId`; `phaseBarrier.startedAt` vs other tasks’ leases
5. `/tmp/oat*.log` or phase-runner stdout — **VERDICT: REWORK** for a *different* task id
6. `pmReview` null + BLOCKED → suspect cross-task sync, not PM verdict on current task

## OAT hygiene (mandatory)

- **One active pipeline** per server: cancel/finish or wait for **BLOCKED/COMPLETE** on task **N** before `task.start` on **N+1**.
- Do not run full OAT **009** while **008** retry/resume is in flight.

## Smallest corrective actions

1. **Runtime:** gate `syncDashboardFromCheckpoint` on `checkpoint.id === state.currentTask.id` (or taskId field on cp).
2. **OAT:** serialize tasks; reset stale `currentTask` if needed (`/api/reset` only when user approves).
3. **Prompt:** `task.create` must carry **description** + Investigate deliverable (see `runtime-oat-investigate-scope.md`).

## Related

- `pm-review-exit-code-pitfall.md` — REWORK exit 1 is expected; parse `VERDICT:` not xargs
- `opencode-json-artifact-and-metrics.md` — artifact `.md` vs raw JSON; metrics from raw file
- `runtime-authority-verification.md` — canonical categories A–J