# AIC Dashboard: Architecture & Pitfalls

When maintaining, extending, or debugging the AIC dashboard (React/Vite frontend + Node.js backend), adhere to these proven constraints to avoid breaking the UI or state sync:

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