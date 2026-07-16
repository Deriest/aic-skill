# IMP-019 — Verification cross-phase repair desync (investigation → fix)

**When:** Normal smoke **046** **BLOCKED** after OAT **045** **COMPLETE**; Verification PM **REWORK** → cross-phase **IMPLEMENTATION** respawn → `BLOCKED` / `spawning`.

**Not a prompt issue** — runtime orchestration only.

## Symptom chain (046)

1. **VERIFICATION** `pmRepairLoop` — PM **REWORK** (verdict cites `backend-output.md` / `frontend-output.md` alignment).
2. `resolvePmRepairTargets` → `artifactPhase: IMPLEMENTATION`, targets `[backend, frontend]` (**intentional** per FIX-020 artifact hints).
3. Engine calls `spawnWorkersForPhase(IMPLEMENTATION, subset)` **inside** Verification repair loop.
4. **`cp.pipelineState` stays VERIFICATION**; **`phaseBarrier` stays `[qa]`** — `resetWorkersForRepair` only clears workers already on barrier (`barrier.js`).
5. Implementation workers run; barrier reconcile may mark **qa** complete from prior pass; **PM re-run is still Verification** — no clean `runPhase(IMPLEMENTATION)` re-entry.
6. Terminal: **BLOCKED**, `phaseStatus: spawning`, `rework.phase: VERIFICATION`, `pmReview.phase: Implementation` (stale).

## 045 vs 046 (runtime decision divergence)

| After Verification PM REWORK | 045 | 046 |
|------------------------------|-----|-----|
| `artifactPhase` from verdict | **VERIFICATION** (many `*-output.md` → spawnPlan filters to **qa**) | **IMPLEMENTATION** |
| Cross-phase Implementation respawn | Effectively **no** | **Yes** |
| Outcome | Closeout → **COMPLETE** | **BLOCKED** |

**First divergence:** `resolvePmRepairTargets` → `artifactPhase` + `spawnPlan` (not task brief).

## Root cause (primary)

**Phase transition:** Cross-phase repair spawns workers for **artifactPhase** without **`runPhase(artifactPhase)`** or resetting **`pipelineState` + `startBarrier(artifact workers)`**.

Secondary: **Repair engine** + **barrier** assume repair workers ⊆ current phase barrier.

## Classification

**Phase Transition** (primary). Secondary: Repair Engine, Barrier.

## Fix (shipped FIX-021)

**Option A implemented:** `pmRepairLoop` cross-phase branch calls `await runPhase(taskId, artifactPhase, projectDir, { repairSubset, repairEnv })` — full barrier + PM loop for the artifact phase — then restores interrupted phase checkpoint and `continue`s outer `pmRepairLoop`.

In-phase repair (same `pipelineState`) unchanged — still uses inline `spawnWorkersForPhase`.

**Restart `server.js`** after deploy. **Re-smoke** normal task — 046 pre-021 is not valid post-FIX-021 evidence.

See `references/runtime-fix021-cross-phase-reentry.md`.

## Evidence pointers

- Log: `[engine] pm repair cross-phase targets` … `repairPipelinePhase: VERIFICATION`, `artifactPhase: IMPLEMENTATION`
- `engine.json` 046: BLOCKED, barrier `[qa]`, `rework.artifactPhase: IMPLEMENTATION`
- Code: `pmRepairLoop` lines ~520–547 spawn with `spawnPipelineState` but outer `pipelineState` unchanged; `runPhase` only in `runPipeline` sequence

## Related

- `references/runtime-fix021-cross-phase-reentry.md` (FIX-021 implementation)
- `references/runtime-fix020-pm-repair-invocation.md` (node invoke + targeting — does not fix desync)
- `references/runtime-imp015-pm-repair-loop.md`
- Smoke ≠ OAT; 045 COMPLETE does not prove normal-task cross-phase repair
