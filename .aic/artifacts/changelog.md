# Changelog - Dashboard Bugfix Sprint (TASK-20260707-013 to 016)

## Workflow Executed
Investigate -> Planning -> Implementation -> Documentation -> Closeout

## Phase 1: Investigate (Backend Engineer)
Output: `.aic/artifacts/investigation.md`
Diagnosed 3 root causes:
- BUG-1: DispatcherAvatar auto-fix setInterval conflicting with manual control
- BUG-2: New object refs on every poll trigger React re-mount/flicker
- BUG-3: crypto.randomUUID() regenerated per poll re-mounts all LogEntry components

## Phase 2: Planning (Architect)
Output: `.aic/artifacts/plan.md`
Specified exact code changes for all 3 bugs.

## Phase 3: Implementation (Frontend Engineer)
Files modified:
- `dashboard/src/data/workers.ts` — Extracted DISPATCHER_WORKER, removed dispatcher from WORKERS list
- `dashboard/src/components/office/DispatcherAvatar.tsx` — Replaced auto-fix with visual WorkerDesk render
- `dashboard/src/context/dashboardReducer.ts` — Added isTaskEqual/isPhasesEqual/isAgentsEqual/isWorkflowEqual for shallow comparison; MERGE_STATUS now returns same state ref when nothing changed
- `dashboard/src/hooks/useStatusPolling.ts` — stateRef for non-stale closures; log dedup with id/timestamp preservation; reverse logs for chronological order

Build: PASS (45.06 kB index bundle)
Bundle: index-BbB7jHq5.js

## Phase 4: Documentation
This changelog.

## Phase 5: Closeout (pending)
