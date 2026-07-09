# AIC Dashboard Pitfalls — Complete Reference

## 1. UI and API State Synchronization

- **Polling Endpoints:** The frontend MUST poll `GET /api/status` to retrieve the full dashboard state (`currentTask`, `phases`, `agents`, `logs`). Polling `/api/workers` is a legacy route that only returns agent lists, causing the Pipeline, Current Task, and Activity Log to remain empty.
- **Worker ID Mapping:** The `WORKERS` array in the backend (`scripts/server.js`) MUST be a 1:1 match with the IDs defined in the frontend (`src/data/workers.ts`) (e.g., `['pm', 'frontend', 'backend', ...]`). If the backend uses legacy IDs (like `frontend_engineer`), status updates via `POST /api/agent-status` will be silently ignored and the UI will not reflect the working state.
- **Status Fallbacks in UI:** When rendering styles based on backend status strings, always provide a fallback to prevent Babel/React crashes. Example: `const config = statusConfig[phase.status as keyof typeof statusConfig] || statusConfig.pending;`. Without this, an unknown status from the backend will result in `config is undefined` and crash the entire UI.

## 2. Server Stability

- **Audit Log Deduplication:** The backend's `audit()` function must deduplicate identical consecutive logs. Without this, infinite render loops or aggressive polling scripts will spam the `audit.json` file, flooding the Activity Log and crashing the frontend state.
- **Watchdogs:** Avoid aggressive infinite `while true; curl` bash watchdogs for status updates, as they can easily DDOS the lightweight Node.js server. Handle status resets gracefully within the task lifecycle or via manual `/aic stop`.

## 3. OpenCode CLI Integration

- **Model Provider Names:** Custom AI proxies often reject requests if the model string includes a prefix they don't recognize. If `opencode run` fails with `UnknownError: Unexpected server error` or `No active credentials for provider`, verify that the model names in `.env` (e.g., `Sonnet`) perfectly match the proxy's expected IDs, and that `opencode.jsonc` has the correct provider mapping.

## 4. Typescript Prop Drilling and Primitive Refactoring

When modernizing legacy `DashboardContext` (Context API) into direct props mapping (Polling API):
*   Do not blindly convert TS Object Interfaces (`{status: string, engine: string}`) into primitive types (`string`) if child leaf nodes (like `StatusBubble`, `DeskComputer`, and `usePixelCanvas`) explicitly expect string types. This mismatch causes `Object is not a string` or `overlap` errors.
*   **Resolution:** Prefer maintaining the Object Interface definition in the root `types.ts`, and explicitly mapping object primitive fields to child components: `status={workerState?.status ?? 'idle'}` at the point of injection (e.g. inside `WorkerGrid.tsx` map iterators).

## 5. Refactoring Overuse of Regex (Sed)

When resolving Typescript Type overlaps inside React functional components, **DO NOT** use `sed` replacements (e.g. `sed -i 's/status ===/status.status ===/g'`).
*   **Reason:** `sed` operates line-by-line and will inadvertently destroy ES6 component imports, interface brackets (`{}`), and object spread syntax resulting in broken TSX files (e.g. `TS1005: ';' expected`).
*   **Fix:** Use explicit `write_file` replacements or `patch` mode for complex React components to maintain structural integrity.

## 6. Recharts Chart Pitfalls

### Vite Circular Chunk → Blank Screen
`manualChunks` splitting `recharts` into a separate `ui` chunk from `vendor: ['react']` causes circular dependency. Browser refuses the circular JS = blank page. Dev mode (port 6869) works fine because Vite doesn't bundle — only production build (port 6868) breaks. FIX: merge into same chunk: `vendor: ['react', 'react-dom', 'framer-motion', 'recharts']`.

### AreaChart Single Data Point
Recharts AreaChart with only 1 data point renders as a dot, not a filled area. Use BarChart for categorical/discrete data (worker names). AreaChart is for timeseries with 2+ data points.

### BarChart White Hover Background
Recharts BarChart default cursor highlights bars on hover with light color clashing dark themes. FIX: `<Tooltip cursor={{ fill: 'transparent' }} />`.

### XAxis Label Auto-Skip
Recharts auto-skips XAxis labels when too many categories. FIX: `interval={0}` + reduce `tick={{ fontSize: 9 }}`.

### Chart Type Consistency
User prefers same chart type for all visualizations on a page. Don't mix AreaChart and BarChart without asking.

### Pre-populate All Workers
Always include all 9 workers (excluding dispatcher) with 0 values to reserve X-axis space. Use SHORT_NAMES (Aria, Atlas, etc.) for chart labels, WORKER_NAMES (Aria (PM), Atlas (Architect), etc.) for table display.

### Worker Display Name Hierarchy
Chart X-axis = SHORT_NAMES (short, fits 9 bars). Tooltip + Table = WORKER_NAMES (full name + jobdesc). Dispatcher excluded from all tracking (not spawned via opencode run).

## 7. Cache Hit Rate Formula

**Wrong**: `cache / (input + output)` → nonsensical % (e.g. 4904%). **Correct**: `cache / (cache + input)` → valid 0-100% ratio.

## 8. Prompt File Location

NEVER save prompt files to `/tmp/` (cleaned up). Always save to `.aic/prompts/` inside the project directory.

## 9. spawn-worker.sh JSON Escaping

When editing curl POST calls in spawn-worker.sh, ALWAYS escape JSON quotes with `\\\"` inside double-quoted strings. `{"agent":"$WORKER"}` is WRONG — it silently fails because bash breaks the string at the first unescaped quote. Correct: `{\\\"agent\\\":\\\"$WORKER\\\",\\\"status\\\":\\\"complete\\\"}`. The `|| true` at the end swallows the error, making this extremely hard to debug.

**Proven bug (2026-07-08):** worker status stuck at "working" because complete call had unescaped quotes. User: "pipeline tidak terupdate saat pengetestan, worker juga cuma dispatch yang update".

## 10. Git Auto-Commit Guard

The Governor worker and Dispatcher (you) must NEVER automatically `git commit` or `git merge`. Always stop and ask the user to explicitly choose the action (commit to main, new branch, or merge).

---

## Bug Patterns (Verified Fixes)

### 1. Activity Log Infinite Spam — Root Causes (3-layer bug)

**Layer 1 — Server returns full audit array every poll (no drain):**
`/api/status` mapped `state.audit.map(...)` without clearing it. Every 5s poll returned the same entries.
**Fix:** Drain-on-read: map to `logs`, then `state.audit = []` before returning response.

**Layer 2 — Frontend APPEND_LOG grows forever:**
`useStatusPolling.ts` dispatched `APPEND_LOG` in a for-loop for each entry. Dedup check only compared last entry, so entries 2–N always passed.
**Fix:** Replace with `SET_LOGS` action that overwrites entire `logEntries` array each poll. Requires adding the action type to `types/index.ts` and case to `dashboardReducer.ts`.

**Layer 3 — Worker status never resets on task_complete:**
`/api/task-complete` only reset workers with `status === 'working'`. Workers set via other paths stayed stale forever.
**Fix:** Unconditionally reset ALL workers to `{status:'idle'}` in task_complete handler.

### 2. Pipeline / CurrentTask Blinking

**Cause:** `TaskInfoPanel.tsx` uses `<AnimatePresence key={state.currentTask.id}>`. Polling creates new object references every 5s even with identical data → Framer Motion exit/enter animation fires every cycle.
**Fix options:**
- Use `currentTask?.title` as key (stable string) instead of full object
- Or use `useRef` to memoize and compare before dispatching `MERGE_STATUS`
- Or disable `AnimatePresence` mode="wait" and use simple conditional rendering

### 3. Dispatcher Status Spam

**Symptom:** Setting `{"agent":"dispatcher","status":"working"}` caused `[reset] {}` and `[agent_status]` spam every 2s.
**Root cause (verified 2026-07-07):** Not a React reset call — was actually `watchdogd` background process + stale frontend cache. After killing watchdogd and clearing `state.json` + `audit.json`, spam stopped.
**Fix:** Kill all background watchdog processes. Clear `.aic/state.json` and `.aic/audit.json`. Hard-refresh browser. The `SET_LOGS` fix (pattern #1) also prevents reoccurrence.

### 4. PM Ghost-Status (worker shows working without being dispatched)

**Cause:** `MERGE_STATUS` reducer merges `incoming` agents with existing `state.agents`. If PM was ever set to working (by old dispatcher logic) and never explicitly reset, it persists across polls.
**Fix:** Server-side: `task_complete` now resets ALL workers (pattern #1 layer 3). Client-side: `MERGE_STATUS` should fully replace agent map, not deep-merge.
