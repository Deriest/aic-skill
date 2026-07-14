# FIX-020 — PM repair invocation & cross-phase worker targeting

**When:** OAT **044** — Planning/Implementation **PASS**; **Verification** PM REWORK asks to fix **Planning `pm-output.md`** (042 bleed, gate FAIL); IMP-015 respawned **`qa`** only; `pm-repair-respawn.js` never ran (`use strict: command not found`).

**Not changed:** IMP-015 limits, FSM, WECP, PM Review parser, FIX-019 prompt/gate/delete logic.

## Defect 1 — Node script via bash

**Wrong:** `spawnBash(scriptDir + '/pm-repair-respawn.js', ['delete-artifacts', ...])`

**Right:** `spawnNode(scriptDir + '/pm-repair-respawn.js', ...)` using `process.execPath` (same pattern as other engine helpers).

Symptom: delete-artifacts + repair block **never execute**; repair loop cannot converge.

## Defect 2 — Targets scoped to current phase plan only

Verification PM verdict cites **Planning** artifacts (`pm-output.md`, `architect-output.md`) but `parseWorkersFromPmVerdict(verdict, plan)` only considers workers in **VERIFICATION** plan (`qa`).

**Wrong:** `repairedWorkers: ["qa"]` when PM says regenerate Planning **pm**.

**Right:** `resolvePmRepairTargets(verdict, pipelineState, currentPlan, PHASE_PLANS)`:

- Artifact filename hints (`pm-output.md` → worker `pm`, phase **PLANNING**)
- Text hints (`Planning pm-output`, `refresh Planning **pm**`)
- **Cross-phase spawn:** `spawnWorkersForPhase(taskId, 'PLANNING', ..., subset)` while pipeline checkpoint may still be **VERIFICATION** repair loop
- Checkpoint `rework.artifactPhase` optional audit field

Log line: `[engine] pm repair cross-phase targets` with `artifactPhase: PLANNING`, `targets: ["pm", ...]`.

## OAT operator checks (044 lesson)

After `task.create` + `task.start`:

```text
create.taskId === start.taskId === GET /api/status currentTask.id
context.json title/description match brief (e.g. OAT-FIX018-FIX019)
```

Wrong id → **INVALID OAT** for FIX-018/019 claims even if pipeline runs.

Cancel: `POST /api/runtime/intent` `{"intent":"task.cancel","taskId":"..."}` — not `/api/tasks/.../cancel` (404).

## Verify

```bash
/tmp/hermes-verify-fix020-*.sh
# resolvePmRepairTargets → pm + PLANNING; node delete-artifacts selective
```

## Residual (IMP-019)

Cross-phase spawn **without** `runPhase(artifactPhase)` can leave **VERIFICATION** barrier `[qa]` while respawning **IMPLEMENTATION** workers → smoke **BLOCKED**. See `references/imp019-verification-cross-phase-repair.md` (FIX-021).

## Related

- `references/runtime-fix019-pm-repair-respawn.md` (delete + repair block; **must** use node after FIX-020)
- `references/runtime-oat-wrong-task-start.md`
- `references/runtime-imp015-pm-repair-loop.md`
- `scripts/hermes-verify-fix020-oat-preflight.sh`