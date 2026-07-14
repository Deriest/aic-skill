# Guarded Runtime OAT — preflight (FIX-008 + FIX-009)

## When to use

Any **single-task** Runtime OAT after engine or WECP changes. Do not create a new task until Runtime is isolated.

## Preflight sequence

```text
GET /api/status
  → pipelineRunning == true?  STOP (pipeline_busy)
  → currentTask non-terminal?  task.cancel(activeTaskId); re-query
  → still busy? STOP (release failed)
  → restart server.js if engine code changed
  → currentTask null AND pipelineRunning false?  proceed
```

**Non-terminal** checkpoint: anything except `COMPLETE`, `CANCELLED` (includes `CREATED`, `INVESTIGATE`, `PLANNING`, `BLOCKED`, failed phaseStatus).

## Execute

1. `task.create` (description ≥ 40 chars for PM)
2. `task.start` — **must** parse JSON:
   - `ok: true` → poll this `taskId` only
   - `error: task_active` | `pipeline_busy` → **STOP**; do not poll CREATED orphan

## Success criteria (ownership + PM barrier)

- New task id == `currentTask.id` after start
- No `TypeError` in server log after `ALL WORKERS PASSED`
- PM Review lines for **same** task id in log tail
- IMP-007: observe naturally — `generate continue (Strategy B)` only if pass 1 extract fails

## Known post-barrier failure (not FIX-008/009)

**Planning** `ALL WORKERS PASSED` then `phaseStatus: failed` without `PM Review: Planning` in log — legacy `no contract (skip)` workers; investigate `phase-runner` exit code separately. Observed TASK-032.

## Live chat reporting

User preference: report OAT start, phase changes, PM exits, COMPLETE/BLOCKED in chat — not only final summary. See `runtime-oat-guarded-forensics.md`.