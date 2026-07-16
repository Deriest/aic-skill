# FIX-010 — Runtime barrier reconciliation (Planning failed after ALL WORKERS PASSED)

## Symptom (TASK-20260713-032)

```
Planning workers (pm, architect, research)
  → phase-runner: ALL WORKERS PASSED, exit 0
  → runPhase: phaseStatus = failed, pipelineState = PLANNING
  → PM Review: Planning — NOT in server log
```

Investigate PM can PASS (FIX-008). Ownership can be correct (FIX-009). Failure is **engine barrier checkpoint**, not WECP.

## Root cause

- `finishLease` → `markWorkerComplete` on checkpoint should record each worker in `phaseBarrier.completed`.
- Under parallel Planning, checkpoint can be **incomplete** (e.g. `pm` missing from `completed` while `research` + `architect` present) even when `reports/pm-output.md` exists and shell barrier passed.
- `runPhase` called `barrierSatisfied()` **without** reconciling disk/lease evidence → silent `failed` at `index.js` ~L272–277 (pre-FIX-010).

## Shipped fix (FIX-010)

After `phase-runner` exit **0**, before `barrierSatisfied()`:

1. `readCheckpoint` (fresh barrier from disk).
2. `reconcilePhaseBarrier(taskId, cp)` — for each worker in `phaseBarrier.workers` not in `failed`:
   - skip if already `complete`;
   - else mark complete if lease `status === 'complete'` **or** `validateArtifactFile` on `reports/<worker>-output.md`.
3. If still not satisfied → `logBarrierIncomplete` (JSON: missing workers, artifact paths, lease states) → `phaseStatus = failed`.

Log on success: `[engine] barrier reconciled` with `{ worker, via: lease|artifact }`.

## OAT expectation post-FIX-010

- Planning → log `barrier reconciled` (often `pm` via `artifact`) → `PM Review: Planning` → PASS/REWORK.
- **Restart** `node scripts/server.js` after engine patch.

## Related

- IMP-008 investigation: classification **Barrier** (not Planning worker defect alone).
- No `planning.json` → `validate-phase-artifact.py` prints `no contract (skip)` for Planning roles; reconcile uses **default** `runtime-contracts.json` min bytes/lines, not phase contract.
- Distinct from FIX-008 (`let artifacts` in `runPmReview`) and FIX-009 (`task_active`).

## Forensic checklist (no code)

1. Read `.aic/tasks/<TASK>/engine.json` → `phaseBarrier.completed` vs `workers`.
2. List `reports/*-output.md` sizes.
3. Grep server log: `ALL WORKERS PASSED` then `barrier reconciled` or `barrier incomplete after reconciliation`.
4. If PM Planning absent and no reconcile log → pre-FIX-010 engine or server not restarted.