# Engine & Dashboard Fixes — v3.6.0 → v3.7.0 (July 17, 2026)

## Root Cause Patterns (recurring — check these first when pipeline breaks)

### 1. Pipeline BLOCKED on PM failures
**Symptom:** Task stuck at BLOCKED after PM exitCode=2 or EDP parse failure
**Root cause:** `pm-review.js` returns `{ok:false}` immediately on infra failure → `runPipeline` stops → never reaches `completeTask()`
**Fix:** PM exitCode=2 → retry with backoff (3s) up to `maxCycles`. If exhausted → ship_with_caveats (same for EDP parse failure). Phase failure in `runPipeline` line 134 → call `completeTask()` + ship_with_caveats instead of returning error.
**File:** `scripts/engine/pm-review.js` lines 129-160, `scripts/engine/pipeline.js` line 134

### 2. Recovery strategy never escalates to ship_with_caveats
**Symptom:** `evaluateProgress` returns `root_cause_shifted` as progress → stays on `targeted_repair` forever
**Fix:** Hard-cap in `selectStrategy`: `if (attempt > 4) return 'ship_with_caveats'`
**File:** `scripts/engine/recovery-strategy.js` line 119

### 3. Workers report but never create files
**Symptom:** Pipeline COMPLETE but `/home/tvd/AIC-WEB/` empty — workers write markdown reports, not code
**Root cause:** Workers are LLM calls producing text reports. No file-creation capability.
**Fix:** Post-barrier extraction: `extract-code-blocks.py` parses ` ```tsx src/App.tsx ``` ` fenced blocks from worker reports → writes actual files to project dir. Integrated into `phase-runner.sh` after barrier.
**Convention:** Workers annotate code blocks with file path: ` ```lang relative/path.ext ``` `
**Files:** `scripts/extract-code-blocks.py`, `scripts/phase-runner.sh` (IMPLEMENTATION post-barrier section)

### 4. Backtick command substitution in shell prompts
**Symptom:** `tsx: command not found`, `html: command not found` in server log during IMPLEMENTATION
**Root cause:** Worker prompt template in `phase-runner.sh` contains literal backticks (```tsx) which bash interprets as command substitution
**Fix:** Replace backticks with `BACKTICK-BACKTICK-BACKTICK` placeholder + instruction to replace
**File:** `scripts/phase-runner.sh` lines 235-258

### 5. Dashboard shows "waiting_pm" after pipeline COMPLETE
**Symptom:** Architect/research/designer show WAITING PM status even after pipeline COMPLETE
**Root cause:** `pmReview.phase='Planning'` persists. Workers with `phase='Planning'` match check in `WorkerGrid.tsx` line 28.
**Fix:** Skip `waiting_pm` override when `pipelineState==='COMPLETE'` or `runtimeGate.status==='complete'`
**File:** `dashboard/src/components/office/WorkerGrid.tsx` line 28

### 6. Dashboard gate shows WAITING APPROVAL when COMPLETE
**Symptom:** Runtime gate label shows "WAITING APPROVAL" after task completes
**Root cause:** Gate logic: `runtimeGate.status='complete'` falls through to `pmReview` check → WAITING APPROVAL
**Fix:** Add COMPLETE check before pmReview in gate IIFE. Also fix `next` label.
**File:** `dashboard/src/components/new_layout/PipelineTracker.tsx` lines 71-86

### 7. Progress bar stuck at 50% after COMPLETE
**Root cause:** `completeRequired` counts workers by `status==='complete'` but workers get reset to idle after task
**Fix:** When `pipelineState==='COMPLETE'` → force `completeRequired = required.length` → 100%
**File:** `dashboard/src/pages/OverviewPage.tsx` line 52

### 8. Task history oldest-first
**Root cause:** `getTaskIds()` returns filesystem order (oldest first)
**Fix:** `.sort().reverse()` for newest-first
**File:** `scripts/utils.js` line 20

### 9. Barrier complete stuck after server restart
**Symptom:** Server killed mid-task → restart → `reconcileOnStartup` sets `interrupted` → `task.resume` re-spawns workers
**Root cause:** Reconciler doesn't check if barrier was complete or reports exist on disk
**Fix:** Check `barrier.active===false && all workers complete` OR `all worker reports exist on disk (>50 bytes)` → set `barrier_wait` instead of `interrupted`
**File:** `scripts/engine/recovery.js` lines 42-60

### 10. `buildSnapshot()` missing `lastCompletedTask`
**Symptom:** `/api/status` returns `lastCompletedTask: null` even after task completes
**Root cause:** `buildSnapshot()` in `engine/index.js` didn't include `lastCompletedTask` field
**Fix:** Add `lastCompletedTask: state.lastCompletedTask || null` to snapshot
**File:** `scripts/engine/index.js` line 58

### 11. `completeTask()` nullifies currentTask
**Symptom:** Dashboard shows "WAITING FOR TASK" immediately after complete — no completion indicator
**Fix:** Keep `currentTask` visible with `pipelineState='COMPLETE'`. Set `runtimeGate.status='complete'`. Set `lastCompletedTask`. Clear on next `task.start`.
**Files:** `scripts/engine/pipeline.js` lines 37-57, `scripts/engine/intent.js` line 87

### 12. postmortem `scriptDir not defined`
**Root cause:** `createPipeline()` destructured `{skillDir, tasksDir}` but missed `scriptDir`
**Fix:** Add `scriptDir` to destructuring
**File:** `scripts/engine/pipeline.js` line 15

## Worker Tier Issues

### Designer uses crafter tier → timeout
**Symptom:** designer-output.md 0 bytes
**Root cause:** `fsm.js` sets designer tier as `crafter` (600s timeout insufficient for complex designs)
**Fix:** Change to `thinker` tier
**File:** `scripts/engine/fsm.js`

## Dependency Compatibility

### React 19 + R3F v8 = blank page
**Symptom:** Page loads HTML but React renders nothing. Console: `R3F: Hooks can only be used within the Canvas component!`
**Root cause:** R3F v8 doesn't support React 19
**Fix:** Upgrade to R3F v9 + Drei v10 + Three.js 0.170
```
npm install @react-three/fiber@^9.0.0 @react-three/drei@^10.0.0 three@^0.170.0 @types/three@^0.170.0
```

### R3F hooks outside Canvas
**Symptom:** `R3F: Hooks can only be used within the Canvas component!`
**Root cause:** Component using `useFrame` rendered outside `<Canvas>` (e.g. ParticleField in Hero)
**Fix:** Convert to regular `requestAnimationFrame` + HTML canvas for non-Canvas components

### @tailwindcss/postcss missing
**Symptom:** `Cannot find module '@tailwindcss/postcss'`
**Fix:** `npm install -D @tailwindcss/postcss --legacy-peer-deps`

## Dashboard Architecture

### Pixel character animation
**Files:** `dashboard/src/hooks/usePixelCanvas.ts`, `dashboard/src/utils/pixelRenderer.ts`, `dashboard/src/components/office/WorkerDesk.tsx`
- `usePixelCanvas` runs `setInterval` per status (working=150ms, complete=1.2s, idle=3s)
- `pixelRenderer` draws frame-based arms (working) and eye blink states
- `WorkerDesk` framer-motion variants: idle=y:0 (static), working=fast bounce, complete=slow sway
- `useReducedMotion` → reduced variants (all static)

### Current task visibility after complete
**Pattern:** `completeTask()` keeps `currentTask` visible. `reconcileOnStartup` preserves COMPLETE state on restart. `lastCompletedTask` as fallback.
- `buildSnapshot()` includes both fields
- PipelineTracker checks `pipelineState==='COMPLETE'` before all other gate states
