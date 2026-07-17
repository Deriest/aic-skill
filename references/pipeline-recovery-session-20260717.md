# Pipeline Recovery Lessons — 2026-07-17

## Session: AIC Website Landing Page (TASK-20260717-001–010)

### 1. Smart Approval destroys `$key` in api-auth.sh

Smart Approval's security scan replaces `$key` with literal `***` in file bytes (not just terminal). The `api-auth.sh` `curl_api` function then sends `X-API-Key: ***` (literal asterisks) → every API call returns 401 → lease issue fails → `spawn-worker.sh` exits 1 → phase fails instantly (~129ms).

**Evidence:** 8 consecutive task-starts failed INVESTIGATE with empty reports/ and leases/ directories.
**Detection:** `xxd path/to/api-auth.sh | grep -i '2a2a2a'`
**Fix:** Rename `$key` to `$apikey` in api-auth.sh. Verified with hex dump: no `2a2a2a` after fix.
**Result:** Pipeline immediately resumed (INVESTIGATE → PLANNING → all workers complete).

### 2. `phase-runner.sh` unbound `$worker` outside loop

Line 51 referenced `$worker` in an echo statement BEFORE the `for worker_arg in "$@"` loop. With `set -euo pipefail`, bash exits 1 immediately → phase fails.

**Fix:** Change `echo "=== Execution Plan injected into $worker prompt ..."` to `echo "=== Execution Plan ready for downstream workers ..."` (remove $worker reference).
**Verify:** `bash -n` only checks syntax, NOT unbound variables. Must also test with `set -euo pipefail` active.

### 3. Designer tier: thinker works, crafter fails

At crafter tier, designer consistently produces "no assistant text in session" → WECP extraction fails → `designer-output.md` 0 bytes → barrier incomplete.

**Evidence:** 3 consecutive crafter failures (TASK-20260717-008/009). Thinker tier succeeded first try (TASK-20260717-010, 3567 bytes).
**Fix:** Keep designer tier as `thinker` in `engine/fsm.js` PHASE_PLANS.PLANNING.
**History:** thinker→crafter (commit b4882fb, timeout) → crafter→thinker (2026-07-17, empty output regression).

### 4. Mechanical Validation Gate: consistency-report.md false BLOCKED

Gate appends `-output.md` to ALL reports dir entries, including `consistency-report.md` → looks for `consistency-report.md-output.md` → BLOCKED with "Missing deliverable".

**Evidence:** TASK-20260717-010 — all 6 reports present and valid, but gate blocked on false filename.

### 5. Server process caches engine modules

Editing `engine/fsm.js` on disk does NOT affect the running server. `require()` caches modules at startup. Must restart server for engine changes to take effect.

**Pattern:** edit file → kill server → wait for Hermes respawn (or manual start) → verify new process loaded updated code → create task.

### 6. Granular retry > full restart (User Correction)

When one worker fails in a multi-worker phase (e.g., designer fails in PLANNING while architect+research succeed), DO NOT cancel the task and start a new one.

**Correct approach:**
1. Spawn the failed worker manually: `spawn-worker.sh designer thinker /project/dir /tmp/prompt.txt`
2. Re-run PM review for the phase
3. Continue to next phase

**User:** *"kenapa ga restart si designernya saja?"*
Architect + Research artifacts are already valid — restarting wastes 5-10 minutes.

### 7. Dispatcher must NOT write project code (User Correction)

When user says "remove all existing code" or "set up the project", Dispatcher must NOT scaffold files directly. Delegate to pipeline workers.

**User:** *"kok kamu yang setup harusnya lewat task donk"*
Only `.aic/` files may be written by Dispatcher. Everything else → task pipeline.
