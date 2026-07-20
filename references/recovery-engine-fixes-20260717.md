# Recovery Engine Fixes — 2026-07-17 Session

## Critical Patterns

### 1. PM exitCode=2 → instant BLOCKED (FIXED)
**File:** `scripts/engine/pm-review.js`  
**Bug:** PM infra failure immediately sets BLOCKED, no retry.  
**Fix:** Retry with 3s backoff up to `maxCycles` (7). All retries exhausted → ship_with_caveats.

### 2. EDP parse failure → instant BLOCKED (FIXED)
**File:** `scripts/engine/pm-review.js`  
**Fix:** Ship with caveats instead of blocking. Return `{ ok: true }`.

### 3. Phase failure stops pipeline (FIXED)
**File:** `scripts/engine/pipeline.js`  
**Bug:** `runPipeline` `if (!r.ok) return r` — any phase failure stops entire pipeline without calling `completeTask()`.  
**Fix:** On phase failure, call `completeTask(taskId)` + return `{ ok: true, caveats: true }`.

### 4. Barrier complete but stuck on restart (FIXED)
**File:** `scripts/engine/recovery.js`  
**Bug:** Server killed mid-phase → `interrupted` → resume restarts from scratch.  
**Fix:** Detect completed barrier OR reports exist on disk → `barrier_wait`. Resume goes to PM review.

### 5. `buildSnapshot()` missing `lastCompletedTask` (FIXED)
**File:** `scripts/engine/index.js`  
**Fix:** Add `lastCompletedTask: state.lastCompletedTask || null` to snapshot.

## Rules
- NEVER return `{ ok: false }` from `runPipeline` without `completeTask()` first
- PM infra failures are transient — retry before giving up
- Server restarts lose in-memory state — reconciler must detect progress from disk
- Barrier state on disk may be stale — check reports exist as backup signal
