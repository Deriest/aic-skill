# FIX-019 — Deterministic PM repair respawn

**When:** IMP-018 — Planning PM REWORK repeats because respawn used the **same prompt**, **stale `reports/*-output.md`**, and no PM failure context (OAT 042).

**Not changed:** IMP-015 limits/checkpoint/barrier, FSM, WECP, PM parser, FIX-015–018 planning blocks.

## Shipped behavior

Before repair respawn (`engine/index.js`):

1. `node scripts/pm-repair-respawn.js delete-artifacts <skillDir> <taskId> <workersCsv>`
2. Env to `phase-runner.sh`: `AIC_PM_REPAIR`, `AIC_PM_VERDICT_FILE`, `AIC_PM_REPAIR_WORKERS`, `AIC_CONTEXT_FILE`

**Repair block** (`pm-repair-respawn.js repair-block`): previous REWORK, worker-specific lines from `.pm-last-verdict.txt` (`extractWorkerFailuresFromVerdict` in `engine/pm-repair.js`), current task id/title/description, correct-only instructions.

**Prompt path:** `/tmp/aic-phase-${AIC_TASK_ID}-${PHASE}-${worker}.txt` (task-scoped).

**Post-gen gate** (`spawn-worker.sh`): when `AIC_PM_REPAIR=1` and `AIC_PIPELINE_PHASE=PLANNING`, for `pm|architect|research` run `planning-post-gen-gate.py`; on FAIL → **one** regen with same prompt (no PM).

## Gate checks (vs `context.json`)

| Worker | Checks |
|--------|--------|
| research | `# Planning Research`, Task Authority, task id |
| architect | Task Authority, title |
| pm | task id, no stale `TASK-*` refs |

## Verify

```bash
# /tmp/hermes-verify-fix019-*.sh — delete-artifacts, repair-block, gate PASS/FAIL
```

## Related

- `references/imp018-planning-research-drift.md`
- `references/runtime-imp015-pm-repair-loop.md`