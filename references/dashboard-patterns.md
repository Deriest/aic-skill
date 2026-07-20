# AIC Dashboard Patterns — 2026-07-17

## Key Dashboard Source Files
- `dashboard/src/components/office/WorkerGrid.tsx` — worker status derivation (line 28: waiting_pm logic)
- `dashboard/src/components/new_layout/PipelineTracker.tsx` — gate label, next label, progress bar, CURRENT TASK display
- `dashboard/src/pages/OverviewPage.tsx` — progress calculation (pct), worker stats
- `dashboard/src/context/DashboardContext.tsx` — state polling from /api/status
- `dashboard/src/types/index.ts` — DashboardState interface (add new fields here)

## Build & Deploy
```bash
cd /home/tvd/.hermes/skills/workflows/aic/dashboard
npx vite build  # background=true in Hermes to avoid long-lived process detection
```
dist/ is gitignored. Server serves from `dashboard/dist/`.

## Adding New State Fields
1. Add to `DashboardState` interface in `types/index.ts`
2. Add to `buildSnapshot()` in `engine/index.js`
3. Set in `completeTask()` in `engine/pipeline.js`
4. Set in `reconcileOnStartup()` in `engine/recovery.js` for restart persistence
5. Clear in `task.start` handler in `engine/intent.js`

## Pixel Animation Architecture
- `usePixelCanvas.ts` — setInterval loop per status (working=150ms, complete=1.2s, idle=3s)
- `pixelRenderer.ts` — draws frame-based character (arms, eyes) on canvas
- `WorkerDesk.tsx` — framer-motion for body movement (idle=diam, working=fast, complete=slow)
- Idle = static body + slow blink only. Working = fast arm alternation + blink.
