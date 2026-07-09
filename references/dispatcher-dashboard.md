# AIC Dashboard — Complete Reference

## Architecture

**Enforced Constraint:** The dashboard is strictly a read-only visual control plane ("Pure Virtual Office") combined with a minimal system config editor.

### Core Principles

- **No Chat or Action Logs:** All human-in-the-loop interaction, task creation, and logging occur strictly in the Hermes TUI via the Dispatcher. The dashboard must NOT implement chat UI, task input forms, or activity log feeds.
- **Visual State Sync:** The UI visually reflects `state.json` (worker statuses, current engines) via continuous polling to `/api/status`.
- **Pipeline Tracker:** The UI tracks the strict, non-negotiable 5-phase lifecycle: `Investigate → Planning → Implementation → Verification → Closeout`.
- **Config Management:** Exposes a simple editor for `.env` and `opencode.jsonc` via `/api/config` to allow hot-swapping providers or variables without restarting the control plane.
- **Minimal Backend (`server.js`):** Serves the static Vite build and acts as a strict state gatekeeper. It enforces the 5-phase lifecycle transitions and rejects out-of-bound worker activations.

---

## API Endpoints

### POST /api/task-start
Sets `currentTask` on state, resets all workers to idle. **Must be called before any worker spawns.**
```json
{"id": "TASK-YYYYMMDD-NNN", "title": "...", "type": "bugfix|feature|..."}
```

### POST /api/task-status
Sets `currentPhase` (and optionally `currentTask`). Use for phase transitions.
```json
{"currentPhase": "Investigate|Planning|Implementation|Verification|Closeout"}
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

---

## Pipeline Phase Lifecycle

Order: `Investigate → Planning → Implementation → Verification → Closeout`

PipelineTracker component renders phases as: `Investigate, Planning, Implementation, Verification, Closeout`
When `currentPhase === 'Closeout'`, ALL phases show green (task fully complete).

---

## Worker Status Visual

| Status | Color | CSS Pattern |
|--------|-------|-------------|
| working | Yellow | `border-aic-yellow shadow-[0_0_15px_rgba(255,255,0,0.15)] animate-pulse` |
| complete | Green | `border-aic-green shadow-[0_0_15px_rgba(0,255,136,0.15)] animate-pulse` |
| idle | Grey | `border-gray-500/30 shadow-[0_0_10px_rgba(128,128,128,0.1)] animate-pulse` |

---

## State Persistence

State stored in `.aic/state.json`. Persists across server restarts.
After `task-complete`, worker statuses are preserved in state.json until next `task-start`.

---

## Task Context Persistence

`POST /api/task-start` now creates `.aic/tasks/TASK-XXX/` with `context.json`, `state.json`, `reports/` dir.
Phase transitions (`POST /api/task-status`) persist to task `state.json` and save `report` field to `reports/<phase>.md`.
Worker output auto-saved to `reports/<worker>-output.md` by `spawn-worker.sh`.

---

## Work Package Decomposition

`POST /api/work-packages` — saves WP array to `.aic/tasks/TASK-XXX/work-packages.json`.
`GET /api/work-packages/:taskId` — returns WPs for a task. WP status: `pending | active | complete | blocked`.
Blocked = `depends_on` has incomplete WPs.

---

## Dashboard Tabs

Tabs: OVERVIEW (1) → HISTORY (2) → COSTS (3) → CONFIG (4)
- **HistoryPage.tsx** — task list with expand/collapse for WP tree. INTERRUPTED = red `#ff0000` badge (NOT yellow). RESUME button triggers `/api/task-status`. Uses `bg-aic-bg-panel`, `font-pixel`, `text-px-base` per theme.
- **api/index.ts** — added `getTasks()`, `getTaskDetail(taskId)`, `getWorkPackages(taskId)`.

---

## Config Page

Both `.env` and `opencode.jsonc` panels are mirror-identical. Fields: PROVIDER_ID, BASEURL, API_KEY (masked), FETCH_MODELS, MODEL_THINKER/CRAFTER/SPRINTER.
Server reads real `~/.config/opencode/opencode.jsonc` (not template).

---

## UI/UX Rules (Cyberpunk Pixel-Art)

The AIC Dashboard is a pure React frontend built with Vite and Tailwind CSS. It specifically adheres to an 8-bit retro pixel-art aesthetic heavily leaning into a cyberpunk theme (navy/black bg, cyan accents, neon yellow alerts).

### Core Layout Constraints

- **Fixed Full-Height:** The dashboard must fit on a single screen without vertical scrolling (`h-full`, `min-h-0`, `overflow-hidden` on parent containers). Do NOT use `overflow-y-auto` on the main page wrapper.
- **Header / Navigation:** Uses `App.tsx` state (`activeTab`) to switch between pages without `react-router`. Uses `font-pixel`, text shadows (`text-shadow-cyan`), and tracking-widest for retro feel.
- **Overview Page:** Serves the 3D-ish isometric/flat hybrid `OfficeFloor`.
  - **Pipeline Tracker:** Resides dynamically on the right sidebar, tracing the strict 5-phase lifecycle. Scales to fill available height (`flex-1`).
- **Config Page:** Resides in a separate tab (`CONFIG (2)`). Contains form-based key-value pairs mapping `.env` and `opencode.jsonc`, omitting raw `<textarea>` inputs for usability.

### Positioning & Pixel Aesthetics

- **Avatars (`WorkerDesk`):** Powered by `framer-motion` and HTML5 Canvas (`usePixelCanvas.ts`). Rendered strictly with `imageRendering: 'pixelated'`.
- **Negative Space (Breathability):** Use generous vertical spacing (`space-y-12`, `py-6`) between department sections. Use generous horizontal gaps (`gap-6 md:gap-8`) between desks. Desk width should be modest (e.g., `w-[150px]`) to avoid overpowering the screen.
- **Alignment:** Worker grids MUST be center-aligned (`flex justify-center`, `flex flex-col items-center`), never left-aligned.
- **Z-Indexing:** Desks overlap gracefully. Hover effects create neon box-shadows (`shadow-[0_0_15px_rgba(0,255,255,0.2)]`). Idle workers should have reduced opacity (`opacity-80`) and no glowing borders to emphasize active ones.
- **Worker Sorting Hierarchy:** The grid strictly sorts workers top-to-bottom: `Leadership` (Dispatcher + Governor) -> `Product` -> `Engineering`. Ensure `groupWorkersBySection` returns a sorted array tuple. Use subtle borders beneath section headers.
- **Desk Accents:**
  - *Monitor*: Anchored relative to desk using `-top-12 right-2`. Do NOT let it float offside.
  - *Status Plat/Bubble*: Anchored `top-2 left-1/2 -translate-x-1/2` directly on the wooden surface div.

### Component Constraints

- **No Activity Log:** Do not add or restore Activity Logs. The UI relies strictly on the Virtual Office avatars and the Pipeline Tracker.
- **No Scrolling:** Do not apply overflow containers that prompt scrollbars on the main dashboard view. The components must compress or flex to share viewport bounds perfectly.

### Typescript Strictness

- Avoid using `sed` or bash scripts to update `.tsx` types. Rely on LSP or explicit `write_file`. The dashboard expects nested `{ status, engine }` primitive extractions from the `DashboardContext`, so visual components like `StatusBubble` must be passed `status={state?.status ?? 'idle'}`.
