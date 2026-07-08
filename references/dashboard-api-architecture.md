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

## Task Context Persistence (new 2026-07-08)

`POST /api/task-start` now creates `.aic/tasks/TASK-XXX/` with `context.json`, `state.json`, `reports/` dir.
Phase transitions (`POST /api/task-status`) persist to task `state.json` and save `report` field to `reports/<phase>.md`.
Worker output auto-saved to `reports/<worker>-output.md` by `spawn-worker.sh`.

## Work Package Decomposition (new 2026-07-08)

`POST /api/work-packages` — saves WP array to `.aic/tasks/TASK-XXX/work-packages.json`.
`GET /api/work-packages/:taskId` — returns WPs for a task. WP status: `pending | active | complete | blocked`.
Blocked = `depends_on` has incomplete WPs.

## Dashboard Tabs (2026-07-08)

Tabs: OVERVIEW (1) → HISTORY (2) → COSTS (3) → CONFIG (4)
- **HistoryPage.tsx** — task list with expand/collapse for WP tree. INTERRUPTED = red `#ff0000` badge (NOT yellow). RESUME button triggers `/api/task-status`. Uses `bg-aic-bg-panel`, `font-pixel`, `text-px-base` per theme.
- **api/index.ts** — added `getTasks()`, `getTaskDetail(taskId)`, `getWorkPackages(taskId)`.

## Config Page

Both `.env` and `opencode.jsonc` panels are mirror-identical. Fields: PROVIDER_ID, BASEURL, API_KEY (masked), FETCH_MODELS, MODEL_THINKER/CRAFTER/SPRINTER.
Server reads real `~/.config/opencode/opencode.jsonc` (not template).
