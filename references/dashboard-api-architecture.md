# AIC Dashboard API Architecture

## Critical Endpoints

### POST /api/task-start
Sets `currentTask` on state, resets all workers to idle. **Must be called before any worker spawns.**
Without this, `currentTask` stays null and the dashboard shows no active task.
```json
{"id": "TASK-YYYYMMDD-NNN", "title": "...", "type": "bugfix|feature|..."}
```

### POST /api/task-status
Sets `currentPhase` (and optionally `currentTask`). Use for phase transitions.
```json
{"currentPhase": "Investigation|Planning|Execution|Verification|Documentation|Closeout"}
```

### POST /api/agent-status
Sets individual worker status. Worker must be in allowed set for current phase (enforced server-side).
```json
{"agent": "pm", "status": "working|complete|idle"}
```

### POST /api/task-complete
Marks task done. **Does NOT reset workers** — they stay `complete` so dashboard shows who did what.
Workers reset to idle only on next `task-start`.

### POST /api/reset
Nuclear option — clears everything including currentTask/currentPhase.

## Pipeline Phase Lifecycle

Order: `Investigate → Planning → Execution → Verification → Documentation → Closeout`

PipelineTracker component renders phases as: `Investigate, Planning, Execution, Verification, Documentation`
When `currentPhase === 'Closeout'`, ALL phases show green (task fully complete).

## Worker Status Visual

| Status | Color | CSS Pattern |
|--------|-------|-------------|
| working | Yellow | `border-aic-yellow shadow-[0_0_15px_rgba(255,255,0,0.15)] animate-pulse` |
| complete | Green | `border-aic-green shadow-[0_0_15px_rgba(0,255,136,0.15)] animate-pulse` |
| idle | Grey | `border-gray-500/30 shadow-[0_0_10px_rgba(128,128,128,0.1)] animate-pulse` |

## State Persistence

State stored in `.aic/state.json`. Persists across server restarts.
After `task-complete`, worker statuses are preserved in state.json until next `task-start`.

## Config Page

Both `.env` and `opencode.jsonc` panels are mirror-identical. Fields: PROVIDER_ID, BASEURL, API_KEY (masked), FETCH_MODELS, MODEL_THINKER/CRAFTER/SPRINTER.
Server reads real `~/.config/opencode/opencode.jsonc` (not template).
