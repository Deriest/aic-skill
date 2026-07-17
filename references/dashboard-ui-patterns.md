# Dashboard UI Patterns & State Management

## Task Completion State Flow

When a task completes (`completeTask()` in pipeline.js):
1. Keep `state.currentTask` visible with `pipelineState='COMPLETE'`
2. Set `state.runtimeGate = { type: 'complete', status: 'complete', ... }`
3. Set `state.lastCompletedTask = { id, title, completedAt }`
4. Clear `state.lastCompletedTask` when `task.start` fires (new task)
5. PipelineTracker reads `currentTask.pipelineState === 'COMPLETE'` → all phases ✓, gate = COMPLETE

**Why:** Users need to see WHAT completed, not just "WAITING FOR TASK". The dashboard stays informative until a new task starts.

## Pipeline Tracker Gate States

```typescript
// Gate label resolution (PipelineTracker.tsx)
if (!state.currentTask && !state.lastCompletedTask) → 'ONLINE'
if (state.currentTask?.pipelineState === 'COMPLETE') → 'COMPLETE'
if (reworkActive) → 'RECOVERING'
if (pmRework > 0) → 'RECOVERING'
if (pmTotal > 0) → 'WAITING APPROVAL'
// ... runtime gate, barrier, workers
```

## Worker Animation System

### Framer-motion (desk body movement)
```typescript
idle: { y: 0, rotate: 0 }           // Diam — no bounce
working: { y: [0,-4,0], rotate: [-3,3,-3], duration: 0.2s }  // Fast
complete: { y: 0, rotate: [0,3,-3,0], duration: 2s }         // Slow
```

### Pixel Canvas Character (2D sprite on canvas)
Independent from framer-motion. Uses `setInterval` in `usePixelCanvas` hook.

**Animation speeds:**
| Status    | Tick   | Visual                              |
|-----------|--------|-------------------------------------|
| working   | 150ms  | Arm alternation + fast blink        |
| complete  | 1200ms | Blink only (arms down)              |
| idle      | 3000ms | Very slow blink (mostly static)     |
| blocked   | 800ms  | Pulse blink                         |
| error     | 400ms  | Fast blink                          |
| rework    | 200ms  | Very fast blink                     |
| waiting_pm| 1500ms | Slow blink                          |

**Frame cycling:**
- `frame` (0/1): alternates arm positions for working status
- `eyeFrame` (0/1): blink cycle — open/closed eyes

**Key:** `useReducedMotion` hook controls framer-motion variants but NOT the pixel canvas. Canvas animation always runs regardless of system preference. This is by design — pixel characters are low-impact.

## Task History Sorting

`getTaskIds()` in `scripts/utils.js` must sort `.reverse()` for newest-first display in dashboard history page.

## Dashboard Build

```bash
cd ~/.hermes/skills/workflows/aic/dashboard
npx vite build
# Output: dist/index.html + dist/assets/*.js + dist/assets/*.css
# Server serves from dist/ automatically
```

**Note:** Hermes intercepts `vite build` as "long-lived process" — run via `background=true` + `notify_on_complete=true`, or use `process(action='wait')`.
