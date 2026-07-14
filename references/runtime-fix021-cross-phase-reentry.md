# FIX-021 — Cross-phase PM repair phase re-entry (shipped)

**When:** Smoke **046** **BLOCKED** after OAT **045** **COMPLETE**; Verification PM **REWORK** → `artifactPhase: IMPLEMENTATION` → inline spawn left `pipelineState: VERIFICATION`, barrier `[qa]` → **BLOCKED/spawning**.

**Supersedes:** inline `spawnWorkersForPhase(artifactPhase)` inside outer `pmRepairLoop` only (pre-FIX-021).

## Required behavior (shipped)

When `spawnPipelineState !== pipelineState` and `repairSpawnPlan.length`:

1. Persist repair checkpoint (`rework`, `pm_repair`, delete-artifacts via **node** `pm-repair-respawn.js`).
2. Log `[engine] pm repair cross-phase re-entry` with `interruptedPhase`, `artifactPhase`, `targets`, `attempt`.
3. **`await runPhase(taskId, artifactPhase, projectDir, { repairSubset, repairEnv })`** — full barrier + **Implementation** (or Planning) **PM** loop for that phase.
4. On success: restore interrupted phase — `cp.pipelineState = pipelineState`, `startBarrier(plan workers)`, `continue` outer `pmRepairLoop` (Verification PM again).
5. On failure: **BLOCKED**.

**In-phase repair unchanged:** same-phase spawn inside `pmRepairLoop` loop.

## `runPhase` options

- `repairSubset` — spawn only repaired workers; barrier = those workers only.
- `repairEnv` — `AIC_PM_REPAIR`, `AIC_PM_VERDICT_FILE`, `AIC_PM_REPAIR_WORKERS`, `AIC_CONTEXT_FILE`.

## Not changed

IMP-015 / `maxPmRepairAttempts`, FSM phase order, WECP, PM Review, FIX-018/019/020 targeting + node delete.

## Verify (ad-hoc)

```bash
/tmp/hermes-verify-fix021-*.sh
# → OK_FIX021_FRESH / OK_FIX021_HERMES_VERIFY
```

**Restart `server.js`** after `engine/index.js` deploy before smoke/OAT.

## Operator expectations

| Run | Cross-phase IMPLEMENTATION from Verification | Expected post-FIX-021 |
|-----|-----------------------------------------------|------------------------|
| 045 OAT | Often `artifactPhase: VERIFICATION` → spawn **qa** only | COMPLETE (no IMP re-entry) |
| 046 smoke | `artifactPhase: IMPLEMENTATION` | Should **re-enter Implementation** then resume Verification — **re-smoke required** |

OAT **045 COMPLETE** does **not** prove FIX-021; smoke **046** pre-021 does **not** prove regression on FIX-008–020 fixes.

## Related

- `references/imp019-verification-cross-phase-repair.md` (investigation)
- `references/runtime-fix020-pm-repair-invocation.md`
- `references/runtime-oat-adhoc-verify.md` (stale uptime banner ≠ verify)