# Dashboard Bug Fixes — 2026-07-17 Session

## 1. Workers show WAITING PM after pipeline COMPLETE
**File:** `dashboard/src/components/office/WorkerGrid.tsx` line 28
**Bug:** `pmReview.phase='Planning'` persists after COMPLETE. Workers match → `waiting_pm`.
**Fix:** Skip when `pipelineState=COMPLETE` or `runtimeGate.status=complete`.

## 2. Gate label: WAITING APPROVAL when COMPLETE
**File:** `PipelineTracker.tsx` line 77. Fix: `complete/passed` → `COMPLETE` label.

## 3. Progress bar stuck at 50%
**File:** `OverviewPage.tsx`. Fix: `pipelineComplete ? required.length : normal count`.

## 4. Current task disappears after COMPLETE
**File:** `pipeline.js completeTask()`. Fix: Keep currentTask with COMPLETE state.

## 5. Pixel character static (no animation)
**Files:** `pixelRenderer.ts` + `usePixelCanvas.ts`. Fix: setInterval frame loop per status.

## 6. R3F: Hooks outside Canvas
**Bug:** `ParticleField` uses `useFrame` outside `<Canvas>`. Fix: Use plain `requestAnimationFrame`.

## 7. R3F v9 + React 19 compatibility
**Bug:** R3F v8 crashes with React 19. Fix: Upgrade to `@react-three/fiber@^9.0.0`, `@react-three/drei@^10.0.0`, `three@^0.170.0`.

## 8. Lucide icon names
v0.344: no Github/Twitter/Linkedin/Test. Use GitBranch/Globe/ExternalLink/FlaskConical.
