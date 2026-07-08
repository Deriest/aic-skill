# Control Plane API Endpoints

Additional endpoints added to `server.js` (port 6868) for the Control Plane Dashboard.

## Chat — Orchestrator

### POST /api/chat
SSE stream to LLM with **orchestrator system prompt**. The server prepends a system message containing:
- Full AIC team roster (9 workers + roles)
- Current active task and phase
- Task queue contents
- Active worker states
- Orchestrator behavioral rules (Indonesian preferred, action-oriented, never "I can't do that")

Chat history (last 20 messages) is also injected for context continuity.

```bash
curl -s -X POST http://localhost:6868/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"hello"}],"model":"Opus"}'
```

Response: `text/event-stream` — OpenAI SSE: `data: {"choices":[{"delta":{"content":"token"}}]}`
**IMPORTANT:** Use raw `fetch()` with `ReadableStream`, NOT the `post()` helper (which does `res.json()` and breaks SSE).

### Chat History — Persist + Pin/Delete

Messages stored in `chat-history.json` at skill root. Each: `{id, role, content, timestamp, pinned}`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat/history` | Load all persisted messages |
| POST | `/api/chat/history` | `{role, content}` — append message |
| DELETE | `/api/chat/history` | Clear all (pinned messages survive) |
| DELETE | `/api/chat/history/:id` | Delete single message |
| POST | `/api/chat/history/:id/pin` | Toggle pin status |

## Config (Read/Write .env + opencode.jsonc)

### GET /api/config
Returns `{env, envRaw, opencode}` — secrets auto-redacted (first 8 chars + `***`).

**Verified response shape:**
```json
{
  "env": {"PROVIDER": "tvd", "API_KEY": "sk-827c0***", "BASE_URL": "http://...", "MODEL_OPUS": "TVD/Opus"},
  "envRaw": "PROVIDER=tvd\nAPI_KEY=sk-827...\n",
  "opencode": "{ \"$schema\": \"...\", \"provider\": { ... } }"
}
```

### POST /api/config
Write config: `{env: {KEY: "value"}, opencode: "jsonc string"}`. Validates JSON before writing. Won't overwrite redacted values (`***`).

### POST /api/config/detect-context
Run `detect-context.sh`: `{provider:"openai", thinker:"gpt-4o", crafter:"gpt-4o-mini", sprinter:"gpt-4o-mini"}`. Returns JSON with context limits.

## Workers

### GET /api/workers
Returns array of 9 worker objects.

**Verified response shape:**
```json
[{"id":"pm","name":"PM","tier":"thinker","type":"thinking","status":"idle","engine":null,"parent":null,
  "circuitBreaker":{"failCount":0,"state":"closed","lastFail":null},"stats":{"successRate":0,"tasksCompleted":0}}]
```

## Self-Test

### POST /api/self-test
Runs `self-test.sh`. Returns `{success, output}`.

## Audit

### GET /api/audit
Returns array of audit entries.

**Verified response shape (NO id, NO level, details is object):**
```json
[{"timestamp":"2026-07-07T05:39:28.030Z","action":"reset","actor":"dispatcher","details":{}}]
```

## History

### GET /api/history
Returns array of completed task history.

**Verified response shape (nested task object, duration is string, cost may be absent):**
```json
[{"task":{"title":"Test Task","type":"feature","id":"T-1"},"completedAt":"2026-07-07T03:59:26.301Z",
  "phases":[{"name":"Build","status":"complete"}],"agents":{"dev":{"status":"working","engine":"opencode"}},
  "tokens":{"input":0,"output":0},"cost":0,"duration":"0s"}]
```

## Analytics

### GET /api/analytics
Returns analytics by task type.

**Verified response shape (NOT per-day charts, per-type summary):**
```json
{"feature":{"count":10,"avgTime":"0s","avgSeconds":0,"successRate":1},"chore":{"count":12,...}}
```

## Task Context Persistence (2026-07-08)

### POST /api/task-start (updated)
Now creates `.aic/tasks/TASK-XXX/` directory with:
```
.aic/tasks/TASK-XXX/
  context.json   — {taskId, title, description, classification, userRequirement, createdAt}
  state.json     — {phase, status, lastActivity, workers}
  reports/       — folder for phase reports
```
Accepts additional optional fields: `description`, `classification`, `userRequirement`.

### POST /api/task-status (updated)
Now persists phase transitions to task `state.json`. If `report` field provided, saves to `reports/<phase>.md`.
```json
{"currentPhase": "planning", "report": "# Planning Phase Report\n..."}
```

### GET /api/tasks
List all tasks. Returns merged context + state for each task directory.
```json
[{"taskId": "TASK-20260708-299", "title": "...", "phase": "planning", "status": "active", "lastActivity": "...", ...}]
```

### GET /api/tasks/:id
Full task detail: `{context, state, reports}` where reports is a list of `.md` filenames.

### GET /api/tasks/:id/context
Just the `context.json` contents.

## Work Package Decomposition (2026-07-08)

### POST /api/work-packages
Save WP decomposition from PM to task directory.
```json
{"taskId": "TASK-XXX", "packages": [
  {"wp_id": "WP-01", "title": "...", "description": "...", "priority": "high", "depends_on": [], "status": "complete"},
  {"wp_id": "WP-02", "title": "...", "description": "...", "priority": "high", "depends_on": ["WP-01"], "status": "pending"}
]}
```
Saved to `.aic/tasks/TASK-XXX/work-packages.json`.

### GET /api/work-packages/:taskId
Returns work packages array for a task (or `[]` if none).

## Notes
- Config reads `.env` at `~/.hermes/skills/workflows/aic/.env`
- Config reads `opencode.jsonc` at `~/.config/opencode/opencode.jsonc`
- Chat proxy reads `BASE_URL` and `API_KEY` from `.env` at runtime
- `detect-context.sh` path: `scripts/detect-context.sh`
- `self-test.sh` path: `scripts/self-test.sh`
- **Vite proxy must cover `/health`** (not just `/api`) — System page needs it
