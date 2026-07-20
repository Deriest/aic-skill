## 34. R3F v8 incompatible with React 19 (blank page)

**Symptom:** Page loads HTML/CSS/JS (200 OK) but shows blank white screen. React app doesn't render. No visible error in terminal.

**Root cause:** Workers install `@react-three/fiber@^8.0.0` and `@react-three/drei@^9.0.0` which only support React 18. The project uses React 19 → R3F silently fails to mount Canvas → entire React tree crashes.

**Fix:** Override dependency versions after npm install:
```bash
npm install @react-three/fiber@^9.0.0 @react-three/drei@^10.0.0 three@^0.170.0 @types/three@^0.170.0 --legacy-peer-deps
```

. Always verify React + R3F compatibility. React 19 requires R3F v9+.

## Compliance Audit (v4.0.0)

See `references/compliance-hardening-v4.md` for the full compliance hardening report — barrier timeout fix, enforcement matrix, adversarial test suite, and remaining prompt-only gaps.

## Core Rules

- **Phase failure in runPipeline MUST return `{ok:false}` and set BLOCKED** — do NOT call `completeTask()` on failure. See references/compliance-hardening-patterns.md Pattern 5.
- **Never use literal backticks in bash heredoc prompts** — use placeholder strings.
- **Never assume `pmReview.phase` will clear after COMPLETE** — always check `pipelineState === 'COMPLETE'` in UI logic.
- **Server SIGTERM during active task is expected** — barrier recovery (reports-on-disk detection) handles it.
- **Progress bar at 50% after COMPLETE** — force `pct=100%` when `pipelineState === 'COMPLETE'`.

## 35. R3F hooks used outside Canvas component

**Symptom:** Browser console shows: `R3F: Hooks can only be used within the Canvas component!`

**Root cause:** Components using `useFrame`, `useThree`, or other R3F hooks are rendered OUTSIDE a `<Canvas>` element. Common pattern: ParticleField or background effects using `useFrame` but placed as sibling to Canvas.

**Fix:** Convert such components to plain HTML5 Canvas animation (requestAnimationFrame) instead of R3F. They don't need WebGL.

## 36. WorkerGrid shows waiting_pm after pipeline complete

**Symptom:** All workers show COMPLETE status, pipeline is COMPLETE, but architect/research/designer desks still show "WAITING PM" badge.

**Root cause:** `WorkerGrid.tsx` line 28: `else if (uiStatus === 'complete' && state.pmReview?.phase === worker.phase) uiStatus = 'waiting_pm'`. The `pmReview.phase` persists as 'Planning' after pipeline completes. Workers with `phase='Planning'` (architect, research, designer) match → UI overridden to waiting_pm.

**Fix:** Add pipeline completion check:
```tsx
else if (uiStatus === 'complete' && state.pmReview?.phase === worker.phase 
         && state.currentTask?.pipelineState !== 'COMPLETE' 
         && state.runtimeGate?.status !== 'complete') uiStatus = 'waiting_pm'
```

**File:** `dashboard/src/components/office/WorkerGrid.tsx`

## 37. Runtime Gate shows WAITING APPROVAL after pipeline complete

**Symptom:** Dashboard gate label shows "WAITING APPROVAL" (yellow) even though task is COMPLETE.

**Root cause:** Gate logic in `PipelineTracker.tsx` line 77: `state.runtimeGate` has `status='complete'` but label defaults to 'WAITING APPROVAL' because the ternary doesn't handle 'complete'.

**Fix:** Add 'complete' check to label:
```tsx
label: s==='blocked'||s==='rework' ? 'RECOVERING' : s==='complete'||s==='passed' ? 'COMPLETE' : 'WAITING APPROVAL'
```

## 38. buildSnapshot() missing lastCompletedTask field

**Symptom:** API response has `lastCompletedTask: None` even though state object has it set.

**Root cause:** `engine/index.js` line 52-71 `buildSnapshot()` explicitly lists fields to include in API response. `lastCompletedTask` was not included.

**Fix:** Add `lastCompletedTask: state.lastCompletedTask || null` to the buildSnapshot return object.

## 39. reconcileOnStartup erases currentTask on restart

**Symptom:** After server restart, dashboard shows no current task even though task was in COMPLETE state.

**Root cause:** `recovery.js` line 29-33: when checkpoint shows terminal state (COMPLETE/CANCELLED/BLOCKED), it sets `state.currentTask = null` and `state.currentPhase = null` unconditionally.

**Fix:** For COMPLETE state, preserve currentTask:
```javascript
if (cp.pipelineState === 'COMPLETE') {
  state.currentTask.pipelineState = 'COMPLETE';
  state.currentTask.phaseStatus = 'idle';
  state.currentPhase = 'Closeout';
  state.runtimeGate = { type: 'complete', status: 'complete', ... };
  state.lastCompletedTask = { ... };
}
```

## 40. Barrier complete on restart — detect by reports-on-disk

**Symptom:** Server killed during PLANNING/IMPLEMENTATION. Workers completed and wrote reports. On restart, barrier shows `active: true` with `completed: {}` because barrier state was in-memory.

**Fix:** `reconcileOnStartup` should check if worker reports exist on disk:
```javascript
const reportsExist = barrier.workers.every(w => {
  const reportPath = path.join(reportDir, `${w}-output.md`);
  return fs.existsSync(reportPath) && fs.statSync(reportPath).size > 50;
});
if (barrierDone || reportsExist) {
  cp.phaseStatus = 'barrier_wait';
  barrier.active = false;
}
```

## 41. PM exitCode=2 causes instant BLOCKED (no recovery)

**Symptom:** PM review fails with exit code 2 (infrastructure failure). Pipeline immediately BLOCKS without retrying.

**Root cause:** `pm-review.js` line 129: `if (pm.exitCode === 2 || pm.infrastructure_failure)` returns `{ok: false}` immediately.

**Fix:** Retry with backoff, then ship with caveats:
```javascript
if (attempt < maxCycles) {
  await new Promise(r => setTimeout(r, 3000));
  continue; // retry
}
// All retries exhausted — ship with caveats
cp.shipWithCaveats = true;
return { ok: true, cp }; // NOT {ok: false}
```
