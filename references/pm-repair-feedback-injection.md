# PM Repair Feedback Injection & Owner Slash Parsing

**Discovered:** 2026-07-16, TASK-20260716-015 (AIC Premium Landing Page v2)
**Commit:** `6e9d5c2`

## Problem

### Issue 1: repair-block never implemented

`phase-runner.sh` line 120-124 has plumbing to call `pm-repair-respawn.js repair-block`:

```bash
if [[ "${AIC_PM_REPAIR:-}" == "1" && -n "${AIC_PM_VERDICT_FILE:-}" && -f "${AIC_PM_VERDICT_FILE}" ]]; then
    if [[ ",${AIC_PM_REPAIR_WORKERS:-}," == *",${worker},"* ]]; then
      PM_REPAIR_BLOCK=$(node "$SCRIPT_DIR/pm-repair-respawn.js" repair-block "$worker" "$AIC_PM_VERDICT_FILE" "${CTX:-${AIC_CONTEXT_FILE:-}}" 2>/dev/null || true)
    fi
fi
```

But `pm-repair-respawn.js` only had `delete-artifacts` action — `repair-block` was never implemented. Result: `PM_REPAIR_BLOCK` always empty, workers get identical prompts on every respawn attempt.

**Symptom:** PM REWORK loop — 3 attempts, then BLOCKED. Server log shows:
```
=== Spawning 4 workers ===
=== Phase Planning: ALL WORKERS PASSED ===
=== PM Review: REWORK ===
(repeat x3)
```

### Issue 2: owner slash parsing

PM EDP returns:
```yaml
decision_package:
  owner: Architect/Research
```

`pm-review.js` line 140-145:
```javascript
if (allowed.includes(owner)) targets = [owner];  // "architect/research" ≠ "architect"
else targets = allowed;  // fallback: ALL workers
```

"Architect/Research" never matches "architect" or "research" individually → all 4 workers (including pm, designer that passed) get respawned.

## Fix

### pm-repair-respawn.js — repair-block action

New action reads `.pm-last-verdict.txt` + sibling `.pm-last-edp.json`, extracts structured feedback:

```
=== PM REPAIR FEEDBACK (attempt N) ===
YOUR PREVIOUS OUTPUT WAS REJECTED BY PM REVIEW.

Root Cause:
<edp.decision_package.root_cause>

Engineering Objective:
<edp.decision_package.engineering_objective>

You are a primary repair target for this rework.
Your Expected Deliverables:
- <matching deliverables for this worker>

Completion Criteria:
- <criteria>

Full PM Verdict:
<verbatim verdict>

FIX THE ISSUES ABOVE IN YOUR NEW OUTPUT. Do not repeat the same content.
=== END PM REPAIR FEEDBACK ===
```

### pm-review.js — owner slash parsing

```javascript
const ownerParts = owner.split('/').map(s => s.trim()).filter(Boolean);
for (const part of ownerParts) {
  if (allowed.includes(part)) targets.push(part);
}
if (!targets.length) targets = allowed;
```

## Verification

```bash
node pm-repair-respawn.js repair-block \
  architect \
  /path/.pm-last-verdict.txt \
  /path/context.json
```

Should output structured feedback with root cause, objective, deliverables, and criteria.

## Alur Feedback Lengkap (v3.5.0)

```
PM REWORK
  → pm-review.js parse EDP → split owner on "/" → targets[] (only affected workers)
  → delete-artifacts (hapus lama)
  → repairEnv = {AIC_PM_REPAIR=1, AIC_PM_VERDICT_FILE, AIC_PM_REPAIR_WORKERS=targets, AIC_REPAIR_ATTEMPT}
  → phase-runner.sh export → untuk SETIAP worker di targets:
      → pm-repair-respawn.js repair-block → inject feedback ke prompt
      → sibling artifacts injected (Collaborative Repair, PLANNING only)
      → execution-plan.md injected (if exists)
      → spawn-worker.sh (WECP atau legacy) → opencode dengan prompt+feedback+sibling
  → barrier wait → consistency-checker.py (PLANNING only)
  → PM Review (with consistency report) → PASS atau REWORK dengan feedback baru
  → max 3x attempt → ship with caveats (NOT BLOCKED)
```

## Per-Phase Coverage

| Phase | Workers | Feedback mengalir? |
|-------|---------|-------------------|
| INVESTIGATE | pm | ✅ |
| PLANNING | pm, architect, research, designer | ✅ (owner slash parsing fix) |
| IMPLEMENTATION | backend, frontend | ✅ |
| VERIFICATION | qa | ✅ |
| CLOSEOUT | pm | ✅ |

Semua phase pakai `runPhase()` → `pmRepairLoop()` yang sama.

## Additional Fixes (commit `280fe22`)

### Fix 3: Canonical spec condition

`phase-runner.sh` line 33: `AIC_PM_REPAIR != '1'` excluded canonical spec from repair workers. `spec-output.md` is dead code (no generator exists — M3 WP-3.1 never implemented), but the condition was wrong: when spec eventually exists, repair workers need the same frozen reference.

Fix: remove `AIC_PM_REPAIR != '1'` from condition.

### Fix 4: `2>/dev/null` hidden errors

`phase-runner.sh` line 122 redirected repair-block stderr to `/dev/null`. If `pm-repair-respawn.js repair-block` failed (malformed EDP, missing verdict file), no error visible — silent failure, empty PM_REPAIR_BLOCK, workers get no feedback.

Fix: remove redirect. Stderr flows to server logs.

### Fix 5: EDP attempt field

`pm-review.sh` never writes `attempt` to EDP JSON. Engine tracks it in `cp.rework.attempt`. `pm-repair-respawn.js` reads `edp.attempt` for display → always "?".

Fix: pass `AIC_REPAIR_ATTEMPT` env var from `pm-review.js` through `phase-runner.sh` export to `pm-repair-respawn.js` (`process.env.AIC_REPAIR_ATTEMPT`, fallback to `edp.attempt`).

## Canonical Spec Status

`spec-output.md` is **dead code** — no worker, pipeline step, or orchestrator generates it. M3 WP-3.1 was planned but never implemented. The condition check in `phase-runner.sh` always falls through to "not yet generated (skipped)". Verified 2026-07-16: grep across all scripts, templates, engine files → zero references to spec generation.

## Lessons

1. **Never trust "shipped" in skill docs** — verify the code actually exists before relying on it. FIX-019 was documented as shipped but `repair-block` was never implemented.
2. **Plumbing without implementation is a trap** — shell calls that `2>/dev/null || true` silently succeed even when the callee doesn't have the requested action.
3. **Owner fields can be compound** — PM EDP owner is free-form text; split on `/`, `,`, `&` and match each part.
4. **Dead-code conditions are still wrong** — even when `spec-output.md` never exists, the `AIC_PM_REPAIR != '1'` condition would break the day the file is created. Fix conditions to be correct for all future states, not just current reality.
5. **`2>/dev/null` on tool calls hides bugs** — if a tool generates content for a prompt, never redirect stderr. Errors must be visible in logs.
6. **Workers communicate via sibling artifacts** — during PLANNING repair, inject peer outputs into worker prompts so they can see contradictions and resolve explicitly (Collaborative Repair).
7. **Consistency checker is a script, not a worker** — Hermes executes it after barrier, before PM Review. It compares artifacts for contradictions and injects the report into PM context. Hermes SHALL NOT rewrite artifacts.
8. **PM never gives up** — after maxAttempts, ship with `shipWithCaveats=true` instead of BLOCKED. Content quality disagreements → deliver with documented gaps. Only hard infrastructure failures (exit code 2, EDP parse failure) → BLOCKED.
