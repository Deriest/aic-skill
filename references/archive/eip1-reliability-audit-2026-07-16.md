# EIP-1 Reliability Audit — scripts/ Directory (2026-07-16)

Full audit of 50 scripts (JS, SH, PY) for engineering reliability issues.
22 findings across 10 dimensions.

## Summary by Severity

| Severity | Count | Finding IDs |
|----------|-------|-------------|
| Critical | 2 | F1, F2 |
| High | 8 | F3, F5, F6, F10, F11, F16, F17, F18 |
| Medium | 8 | F4, F7, F8, F9, F12, F13, F15, F22 |
| Low | 4 | F14, F19, F20, F21 |

---

## F1 — api-auth.sh Broken String Literal (Critical)

**File:** `scripts/api-auth.sh:29`

Line 29: `auth_flag="X-API-Key: ***` — the closing `"` is missing. Bash consumes the rest of the function body as the string value. Every call to `curl_api` with an API key sends a malformed header containing script source code.

**Impact:** All authenticated API calls from shell scripts fail silently or send corrupted auth headers. The `|| true` pattern at call sites masks this.

**Fix:** Close the string: `auth_flag="X-API-Key: $key"`

---

## F2 — Non-Atomic State File Writes (Critical)

**Files:** `server.js:291` (saveState), `engine/persistence.js:25` (writeCheckpoint), `engine/index.js:638` (triggerKnowledgeAsync), all queue.sh/metrics.sh/health-check.sh Python heredocs.

All state files written via direct `fs.writeFileSync` / `json.dump` without write-to-temp + rename. Server process and shell scripts write concurrently.

**Impact:** Process crash mid-write corrupts state files. `state.json` corruption loses all runtime state (active task, workers, leases).

**Fix:** Write to temp file, then `fs.renameSync` (atomic on same filesystem).

---

## F3 — FSM canAdvance Logic Bug (High)

**File:** `scripts/engine/fsm.js:44`

`return n != null && n !== 'COMPLETE' || (from === 'CLOSEOUT' && pmPass);`

JS precedence: `(n != null && n !== 'COMPLETE') || (from === 'CLOSEOUT' && pmPass)`. The CLOSEOUT branch leaks into all states. `canAdvance('INVESTIGATE', true, true)` returns true.

**Impact:** Latent — no current caller, but landmine for future use.

**Fix:** Add parens: `return (n != null && n !== 'COMPLETE') || (from === 'CLOSEOUT' && pmPass && n === 'COMPLETE');` — or better, delete if unused.

---

## F4 — BLOCKED Not in PHASE_ORDER (Medium)

**File:** `scripts/engine/fsm.js:3-11`

`BLOCKED` is terminal but not in `PHASE_ORDER`. Engine sets it directly (`cp.pipelineState = 'BLOCKED'`) rather than through an FSM transition function. No guard prevents invalid direct state mutations.

**Impact:** No FSM constraint on error-state transitions. Cannot audit or constrain transitions.

---

## F5 — Lease Completion Call Suppressed (High)

**File:** `scripts/spawn-worker.sh:249-251`

`curl_api ... > /dev/null 2>&1 || true` — lease completion silently lost if server is down. Engine's `finishLease` (which validates artifacts and marks barriers complete) is never called.

**Impact:** Workers succeed but pipeline stalls — barrier never records completion, causing indefinite `barrier_wait` hang.

---

## F6 — pm-repair-respawn.js Exits on First Delete Failure (High)

**File:** `scripts/pm-repair-respawn.js:13-14`

`process.exit(1)` on first file deletion failure. Caller continues with `spawnWorkersForPhase`, but old artifacts may still exist, causing barrier reconciliation to find stale "complete" artifacts.

**Impact:** PM repair loop respawns workers but old artifacts cause false barrier satisfaction — phase passes without actual repair.

---

## F7 — recovery.sh Recursive Self-Invocation (Medium)

**File:** `scripts/recovery.sh:54`

`bash "$0" restore "$LATEST"` — no recursion guard. If backup is corrupted, restore copies bad state, health check reports unhealthy again, potentially looping.

**Impact:** Infinite recovery loop if backup is corrupted.

---

## F8 — recovery.sh Doesn't Restart Server (Medium)

**File:** `scripts/recovery.sh:44-66`

Restores files but never restarts `server.js`. If server process holds corrupted in-memory state, file restore has no effect.

**Impact:** Recovery appears to succeed but system remains broken.

---

## F9 — engine/recovery.js Incomplete Phase Status Coverage (Medium)

**File:** `scripts/engine/recovery.js:24`

Only handles `running`/`spawning`. Missing: `barrier_wait`, `pm_repair`, `failed`. Tasks in these states after crash are not recovered.

**Impact:** Tasks stuck in `barrier_wait` or `pm_repair` after crash are permanently stalled.

---

## F10 — task.resume Doesn't Reset Phase Status (High)

**File:** `scripts/engine/index.js:859-877`

`task.resume` unsets paused but doesn't reset `cp.phaseStatus`. `runPipeline` iterates from `INVESTIGATE` regardless of `cp.pipelineState`.

**Impact:** Resume doesn't actually resume — it restarts from the beginning, wasting work.

---

## F11 — task.cancel Doesn't Stop Running Pipeline (High)

**File:** `scripts/engine/index.js:878-893`

`task.cancel` sets `CANCELLED` in checkpoint and clears `state.currentTask` but doesn't set `pipelineRunning = false`. The running pipeline never checks for cancellation.

**Impact:** Cancelled tasks continue executing, wasting resources and overwriting artifacts.

---

## F12 — pipelineRunning Flag Race (Medium)

**File:** `scripts/engine/index.js:802, 839`

Between check (`if (pipelineRunning)`) and set (`pipelineRunning = true`), there are synchronous but non-trivial operations. Two concurrent `task.start` requests in the same event loop tick could both pass.

**Impact:** Two concurrent pipelines on the same state files.

---

## F13 — validate-framework-invariants.sh No Argument Validation (Medium)

**File:** `scripts/validate-framework-invariants.sh:7-8`

Uses `$1` and `$2` without `${1:?}` validation. Empty arguments → empty array → for loop doesn't iterate → exits 0 (pass).

**Impact:** Missing arguments cause validation to pass vacuously, allowing invalid artifacts through the mechanical validation gate.

---

## F14 — pm-review.sh Exit Code 4 Undocumented (Low)

**File:** `scripts/pm-review.sh:17`

Exit 4 (no artifacts) is undocumented and treated identically to exit 1 (REWORK) by the engine. No logging distinguishes "no artifacts" from "artifacts need rework".

---

## F15 — health-check.sh HEALTH_FILE Not Exported (Medium)

**File:** `scripts/health-check.sh:7, 57, 60`

`HEALTH_FILE` is a bash variable but not in the `export` list at line 57. Python heredoc falls back to relative path `.aic/health.json`.

**Impact:** Health data written to wrong path when run from non-skill directory.

---

## F16 — queue.sh Non-Atomic Read-Modify-Write (High)

**File:** `scripts/queue.sh:15-27, 30-44, 69-93` and `server.js` `/api/queue/enqueue`

Both shell and API read-modify-write `queue.json` without file locking. Concurrent operations overwrite each other's changes.

**Impact:** Concurrent queue operations silently lose entries.

---

## F17 — knowledge-memory.sh Shell Variable Injection (High)

**File:** `scripts/knowledge-memory.sh:23, 37, 59`

`$KEY` and `$VALUE` interpolated directly into Python heredoc. Crafted input containing Python syntax becomes arbitrary code execution. Same pattern in `knowledge-search.sh` and `knowledge-reuse.sh`.

**Impact:** Arbitrary code execution via crafted input to knowledge management scripts.

---

## F18 — server.js RBAC Fail-Open (High)

**File:** `scripts/server.js:937`

`} catch(rbacErr) { /* RBAC check failed, allow request to proceed */ }`

If RBAC check throws, the catch block silently allows the request with no authorization.

**Impact:** Any error in RBAC checking makes all protected endpoints accessible without authorization.

---

## F19 — auth.js Reads Credentials From File on Every Request (Low)

**File:** `scripts/auth.js:16-22, 64`

`loadCredentials()` does `fs.readFileSync` on every API request. No caching. Potential JSON parse failure if `auth.json` is being written concurrently.

---

## F20 — auth.json Has No Token Expiry (Low)

**File:** `scripts/auth.js:29-40, 51-67`

API keys have `createdAt` but no `expiresAt`. No refresh, no rotation, no revocation list.

---

## F21 — server.js Graceful Shutdown Double Save (Low)

**File:** `scripts/server.js:1001-1018`

First save preserves worker state. Second save (lines 1006-1011) resets workers to idle, overwriting the first. On restart, recovery.js finds no `working` workers to reconcile.

---

## F22 — phase-runner.sh Barrier Timeout Never Enforced (Medium)

**File:** `scripts/phase-runner.sh:211`, `scripts/engine/barrier.js:11`

Barrier has `timeout: 600000` (10 min) but `barrierSatisfied()` never checks it. Failed lease acquisition causes a 10-minute hang before the phase fails.

---

## Exit Code Semantics Summary

| Script | 0 | 1 | 2 | 3 | 4 |
|--------|---|---|---|---|---|
| pm-review.sh | PASS | REWORK | BLOCKED | — | No artifacts (undocumented) |
| phase-runner.sh | All passed | Worker(s) failed | Invalid format | — | — |
| spawn-worker.sh | Success | Failure | — | — | — |
| validate-framework-invariants.sh | Valid | Invalid | — | — | — |
| worker-validation.sh | PASS | FAIL | — | — | — |
| worker-execution-pipeline.py | Validated | Failed | Usage error | — | — |
| validate-phase-artifact.py | Valid | Invalid | Usage error | — | — |
| recovery.sh | Success | Failure | — | — | — |
| pm-repair-respawn.js | — | Delete failed | Usage error | — | — |
| preflight.sh | Ready | Blocker count | — | — | — |

**Inconsistencies:**
- Exit 2 = "usage error" in Python scripts, "BLOCKED" in pm-review.sh, "invalid format" in phase-runner.sh
- Exit 4 unique to pm-review.sh, undocumented
- Exit 3 (formerly UNKNOWN, eliminated by FIX-004) was replaced by exit 4 without documentation
- preflight.sh uses exit code as failure count (1-5 possible), not boolean

## Key Patterns

1. **Silent failure swallowing** (`|| true`) at 15+ call sites masks API, lease, and validation failures
2. **Non-atomic file writes** affect all 8+ JSON state files — no write-then-rename anywhere
3. **No file locking** on shared state files — concurrent access from server.js and shell scripts unprotected
4. **FSM bypass** — engine directly mutates `cp.pipelineState` instead of going through FSM transition functions
5. **Shell variable injection** into Python heredocs pervasive in knowledge scripts
6. **Exit codes inconsistent** — same code means different things across scripts; engine treats unknown codes as REWORK
