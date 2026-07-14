# Runtime IMP-015 — Bounded PM Repair Loop (Engine)

## Problem

Planning (and other PM-gated phases) failed **nondeterministically** across OAT 037–039: drifting worker rotated (research → pm). Prompt-only fixes (FIX-015/016) helped but did not stabilize. **Immediate BLOCKED on first PM REWORK** forced cancel + new OAT + developer prompt edits.

`rework-handler.sh` implements respawn + PM re-run but is **not called** by `scripts/engine/index.js` (FEAT-001 engine).

## Shipped behavior (IMP-015)

After workers + barrier + `pm-review.sh`:

| PM exit | Engine action |
|---------|----------------|
| 0 PASS | Clear `rework`, advance phase |
| 1 REWORK | Enter repair loop (if attempts remain) |
| 2 BLOCKED / 3 UNKNOWN | BLOCKED (no repair) |

**Repair loop:**

1. Read `reports/.pm-last-verdict.txt` (written by `pm-review.sh` when `AIC_TASK_ID` set).
2. `parseWorkersFromPmVerdict()` → subset of `pm|architect|research|backend|frontend|qa` in current phase plan.
3. If parse empty → **full-phase fallback** (all workers in phase).
4. `resetWorkersForRepair(barrier, targets)` — only targets cleared; peers stay `complete`.
5. **FIX-019:** `pm-repair-respawn.js delete-artifacts` removes `reports/<worker>-output.md` for targets only; spawn with `AIC_PM_REPAIR=1`, verdict path, repair worker list.
6. `phase-runner.sh` injects **PM REPAIR CONTEXT** (FIX-019) before `TASK_SCOPE` for repaired workers only.
7. **Planning + repair:** `planning-post-gen-gate.py` after spawn; one opencode regen if gate fails (no extra PM).
8. `phase-runner.sh` with **subset** only.
9. Barrier reconcile → PM again.
10. Max attempts: **`maxPmRepairAttempts`** in `.aic/runtime-contracts.json` (default **3**). Exceeded → BLOCKED as before.

**Checkpoint `engine.json` → `rework`:**

```json
{ "phase": "PLANNING", "attempt": 1, "repairedWorkers": ["pm"], "lastVerdict": "REWORK" }
```

Synced to dashboard `state.rework` via `syncDashboardFromCheckpoint`.

## Files

- `scripts/engine/index.js` — `pmRepairLoop`, `spawnWorkersForPhase`
- `scripts/engine/pm-repair.js` — parse + config
- `scripts/engine/barrier.js` — `resetWorkersForRepair`
- `scripts/pm-review.sh` — persist verdict; engine passes `AIC_TASK_ID`
- **FIX-019:** `scripts/pm-repair-respawn.js`, `scripts/planning-post-gen-gate.py`

## OAT expectations

- Log: `[engine] pm repair` / event `pm.repair.started` / `pm repair full-phase fallback`
- **Restart `server.js`** after engine patch before OAT.
- Planning REWORK on one worker may **self-heal** within same task (up to 3 PM cycles) without new TASK.

## Ad-hoc verify

```bash
# /tmp/hermes-verify-imp015-*.sh — node --check index+pm-repair, parseWorkersFromPmVerdict, barrier reset
```

## Not changed

WECP, PM prompts/parser, FSM phase order, leases.

## OAT evidence (040)

- Planning PM **PASS** first try → loop **not exercised** (valid when FIX-015/016 hold).
- Task stopped at **WECP** Implementation (`MISSING_SECTION`) — not an IMP-015 defect.
- To **prove** loop: OAT with PM REWORK (e.g. 039-style pm drift) + logs `pm.repair.started` / selective respawn before BLOCKED.

## Related

- `references/runtime-oat-planning-artifact-alignment.md`
- `references/imp016-wecp-implementation-missing-section.md`
- `references/runtime-fix017-implementation-skeleton-lock.md`
- `references/runtime-fix019-pm-repair-respawn.md`