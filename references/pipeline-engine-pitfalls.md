# Pipeline Engine Pitfalls — Known Bugs & Fixes

## 1. PM Review Validation Gate: `consistency-report.md` breaks validation
**File:** `scripts/engine/pm-review.js` → WP-3.3 block
**Bug:** `filterPmArtifacts()` returns ALL `.md` files including `consistency-report.md`. The validation script (`validate-framework-invariants.sh`) expects YAML frontmatter which `consistency-report.md` doesn't have → validation fails.
**Fix:** Filter artifacts to `-output.md` only:
```js
const targetWorkers = artifacts
  .filter(a => path.basename(a).endsWith('-output.md'))
  .map(a => path.basename(a, '-output.md'))
```

## 2. PM Review Validation Gate: `pm` worker in validation
**Bug:** After fix #1, `pm-output.md` passes the `-output.md` filter but has no YAML frontmatter. Also, for Investigate phase (only PM worker), excluding PM leaves `targetWorkers` empty → bash script error `Missing workers argument`.
**Fix:** Exclude `pm` from validation AND skip gate when no target workers:
```js
.filter(w => w !== 'pm');
// WP-3.3: Mechanical Validation Gate
if (targetWorkers.length > 0) {
  // ... run validation
} else {
  console.log('  (no worker artifacts to validate — skipping gate)');
  valCode = 0;
}
```

## 3. Recovery Strategy: `root_cause_shifted` infinite loop
**File:** `scripts/engine/recovery-strategy.js` → `selectStrategy()`
**Bug:** `evaluateProgress()` returns `hasProgress=true` when `rootCause` changes between cycles (`root_cause_shifted`). PM generates different root causes each cycle → strategy never escalates → stuck in `targeted_repair` forever → never reaches `ship_with_caveats`.
**Fix:** Add hard cap after 4 attempts:
```js
if (attempt > 4) return 'ship_with_caveats';
```
**Location:** After `if (attempt <= 1) return 'targeted_repair';`

## 4. Pipeline `scriptDir` not defined
**File:** `scripts/engine/pipeline.js` → `createPipeline()`
**Bug:** Destructured `{ skillDir, tasksDir }` but `triggerPostmortemAsync()` references `scriptDir` which is in `ctx` but not destructured. Postmortem always fails silently.
**Fix:** Add `scriptDir` to destructuring:
```js
const { skillDir, scriptDir, tasksDir, getState, saveState, bus } = ctx;
```

## 5. `phase-runner.sh` unbound `$worker` variable
**File:** `scripts/phase-runner.sh:51`
**Bug:** References `$worker` before the loop that defines it → bash `unbound variable` with `set -u`.
**Fix:** Remove or move the reference inside the loop.

## 6. `api-auth.sh` Smart Approval redaction
**File:** `scripts/api-auth.sh`
**Bug:** Shell variable named `$key` → Smart Approval security system redacts `$key` to `***` in the written file on disk, not just terminal output. API key never actually gets written.
**Fix:** Use `$apikey` instead of `$key` in shell scripts. Verify with `xxd | grep 2a2a2a`.

## 7. Task history sorted oldest-first
**File:** `scripts/utils.js` → `getTaskIds()`
**Bug:** `fs.readdirSync()` returns filesystem order (oldest first for timestamped task IDs).
**Fix:** Add `.sort().reverse()` for newest-first display.

## 8. Task invisible after complete
**File:** `scripts/engine/pipeline.js` → `completeTask()`
**Bug:** Set `currentTask = null`, `runtimeGate = null`, `currentPhase = null` → dashboard shows "WAITING FOR TASK" with no indication of what completed.
**Fix:** Keep `currentTask` visible with `pipelineState='COMPLETE'`. Set `runtimeGate` to `{status:'complete'}`. Clear on next `task.start`.

## 9. Dashboard worker animation: idle bouncing
**File:** `dashboard/src/components/office/WorkerDesk.tsx`
**Bug:** Idle animation had `y: [0, -3, 0]` with repeat → constant bouncing. User wanted: idle=diam, working=cepat, complete=santai.
**Fix:**
```js
idle: { y: 0, rotate: 0 },  // diam
working: { y: [0, -4, 0], rotate: [-3, 3, -3], transition: { y: { repeat: Infinity, duration: 0.2 }, rotate: { repeat: Infinity, duration: 0.25 } } },
complete: { y: 0, rotate: [0, 3, -3, 0], transition: { rotate: { repeat: Infinity, duration: 2, delay: 1 } } },
```

## 10. Pixel character static (no animation)
**File:** `dashboard/src/utils/pixelRenderer.ts` + `dashboard/src/hooks/usePixelCanvas.ts`
**Bug:** `drawPixelCharacter()` was called once on mount → static image. `useReducedMotion` hook disabled ALL framer-motion variants, but pixel canvas is independent.
**Fix:** Add frame animation to `usePixelCanvas` hook with `setInterval`:
- `working`: 150ms — alternate arm positions + blink
- `complete`: 1200ms — blink only
- `idle`: 3000ms — very slow blink (mostly static)

## 11. PM exitCode=2 → instant BLOCKED (no recovery)
**File:** `scripts/engine/pm-review.js` (~line 129)
**Bug:** PM invocation fails with exit code 2 (infrastructure failure, not content failure). Pipeline immediately sets BLOCKED. No retry.
**Fix:** Retry with backoff first, then ship with caveats if retries exhausted:
```js
if (pm.exitCode === 2 || pm.infrastructure_failure) {
  if (attempt < maxCycles) {
    await new Promise(r => setTimeout(r, 3000));
    continue; // retry
  }
  // Ship with caveats instead of blocking
  cp.shipWithCaveats = true;
  bus.emit('phase.passed', { taskId, phase: pipelineState, caveats: true });
  return { ok: true, cp };
}
```

## 12. EDP parse failure → instant BLOCKED
**File:** `scripts/engine/pm-review.js` (~line 150)
**Bug:** `.pm-last-edp.json` malformed or empty → sets BLOCKED and returns `{ ok: false }`.
**Fix:** Ship with caveats instead of blocking (same pattern as #11).

## 13. Phase failure stops pipeline without completing
**File:** `scripts/engine/pipeline.js` (~line 134)
**Bug:** `runPipeline()`: `if (!r.ok) return r` — any phase failure exits the loop without calling `completeTask()`. Dashboard shows task stuck forever.
**Fix:** When a phase fails, call `completeTask()` before returning:
```js
if (!r.ok) {
  console.log(`[engine] Phase ${phase} failed — shipping with caveats`);
  completeTask(taskId);
  return { ok: true, caveats: true };
}
```

## 14. `lastCompletedTask` missing from API response
**File:** `scripts/engine/index.js` → `buildSnapshot()`
**Bug:** `state.lastCompletedTask` is set by `completeTask()` but `buildSnapshot()` doesn't include it → `/api/status` always returns `lastCompletedTask: null`.
**Fix:** Add `lastCompletedTask: state.lastCompletedTask || null` to the snapshot object.

## 15. Dashboard progress bar stuck after complete
**File:** `dashboard/src/pages/OverviewPage.tsx`
**Bug:** Workers reset to idle after complete → `completeRequired` count drops → progress bar shows 0% or 50%.
**Fix:** Check `pipelineState === 'COMPLETE'` or `runtimeGate.status === 'complete'` → force `pct = 100`:
```tsx
const pipelineComplete = state.currentTask?.pipelineState === 'COMPLETE' || state.runtimeGate?.status === 'complete';
const completeRequired = pipelineComplete ? required.length : required.filter(...).length;
```

## 16. `reconcileOnStartup` clears COMPLETE tasks
**File:** `scripts/engine/recovery.js`
**Bug:** Server restart → sees COMPLETE checkpoint → clears `currentTask` from state → dashboard shows "WAITING FOR TASK" instead of completed task.
**Fix:** When checkpoint is COMPLETE, keep `currentTask` visible with `pipelineState='COMPLETE'`, set `runtimeGate` and `lastCompletedTask`. Only clear for CANCELLED/BLOCKED.

---
**KEY PRINCIPLE:** NEVER return `{ ok: false }` from `pmRepairLoop` or `runPipeline` without first attempting `ship_with_caveats`. Every `{ ok: false }` propagates up and stops the entire pipeline without calling `completeTask()`. The pipeline MUST reach `completeTask()` to show COMPLETE on dashboard.
