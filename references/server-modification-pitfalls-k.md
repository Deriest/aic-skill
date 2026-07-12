# Server Modification Pitfalls (Milestone K+)

Consolidated from: server-modification-pitfalls-k.md, server-modification-pitfalls-ops-shadow.md

## currentTask Never Cleared on task-complete (DF-002)

**Symptom:** After task completion, `GET /api/status` returns `currentTask` with stale task data even though `dispatcher.status` is `idle`.

**Root cause:** `POST /api/task-complete` marks the task as `done` in the state file but never sets `state.currentTask = null`. The dispatcher status syncs correctly (`state.workers.dispatcher.status = state.currentTask ? 'working' : 'idle'`) but `currentTask` itself persists.

**Fix:** Add `state.currentTask = null;` before the `saveState()` call in the task-complete handler:
```javascript
// POST /api/task-complete
state.currentTask = null; // DF-002: clear task on completion
saveState();
```

**Pitfall:** The stale state persists across server restarts because `saveState()` writes to disk. After fixing the code, you must either call `POST /api/reset` or manually clear the persisted state before verifying.

## ops-endpoints.js Runs Before server.js

**Key lesson:** ops-endpoints.js is imported and its handler is called INSIDE the main createServer callback, before the 404 fallback. If ops-endpoints.js handles a route, server.js code for that route is unreachable.

**Rule:** When adding endpoints, check BOTH server.js AND ops-endpoints.js for conflicts.

## Dual Auth Gates

`POST /api/auth/keys` had two auth checks: one in the RBAC middleware and one inline. The inline check used `loadCredentials()` (correct) but the RBAC middleware used `state.auth.apiKeys` (stale). Fix: remove duplicate auth check, use single consistent path.

## SIGTERM Cascade

Sending SIGTERM to the server process while workers are running causes cascade failures. The graceful shutdown handler must:
1. Stop accepting connections
2. Wait for active workers (with timeout)
3. Kill orphan workers
4. Clean up PID file
5. Exit

## Variable Shadowing in RBAC

Using `const` inside a try-catch block shadows outer variables. If the outer variable is used after the try-catch, it may be undefined. Fix: declare variables outside try-catch.

## Metrics Response Shape

`/api/metrics` returns `{metrics, summary}` where summary includes cost. `/api/metrics/summary` (ops-endpoints.js) returns a flat object WITHOUT cost. These are TWO DIFFERENT ENDPOINTS with different response structures. The audit falsely flagged this as a defect — cost is correctly on `/api/metrics`.
