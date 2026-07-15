# API Reference

## Authentication

All `/api/*` endpoints require `X-API-Key` header except public endpoints.

Public (no auth): `/health`, `/api/config`, `/api/tasks`, `/api/metrics`

Invalid/missing key → 401.

---

## Endpoints

### Health & Status

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | Public | Server health check |
| GET | `/` | Public | Dashboard UI |
| GET | `/api/status` | Public | Dispatcher + worker status |
| GET | `/api/version` | Public | Runtime version |
| GET | `/api/health/components` | Required | Per-component health |

### Task Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/task-start` | Required | Start new task |
| GET | `/api/task-status` | Required | Get task status |
| POST | `/api/task-complete` | Required | Mark task complete |
| GET | `/api/tasks` | Public | Task history |

### Pipeline

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/pipeline/status` | Required | Pipeline phase status |
| POST | `/api/phase-barrier` | Required | Phase barrier control |
| POST | `/api/pm-review` | Required | PM review submission |
| POST | `/api/runtime-gate` | Required | Runtime gate control |

### Metrics & Monitoring

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/metrics` | Public | Full metrics (tokens, cost, memory, CPU) |
| GET | `/api/metrics/summary` | Public | Metrics summary (flat) |
| GET | `/api/monitor` | Required | Runtime monitor data |

### Projects & Configuration

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/project` | Required | Active project |
| GET | `/api/projects` | Required | All projects |
| GET | `/api/config` | Public | Runtime configuration |

### Queue

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/queue/status` | Required | Queue status |

### Administration

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/permissions` | Required | RBAC permission matrix |
| GET | `/api/audit` | Required | Audit log entries |
| POST | `/api/auth/keys` | Required | API key management |
| POST | `/api/reset` | Required | Runtime reset |

### Agent Status

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/sub-agent-status` | Required | Sub-agent status |
| GET | `/api/agent-status` | Required | Agent status |

---

## Response Formats

### Success
```json
{"ok": true, "data": {...}}
```

### Error
```json
{"error": "message", "code": 401}
```

### Metrics (`/api/metrics`)
```json
{
  "metrics": {...},
  "summary": {
    "total": 1234,
    "totalInput": 5678,
    "totalOutput": 9012,
    "workers": {...},
    "tiers": {...},
    "memory": {"rss": 57667584, "heapUsed": 7115976},
    "cpu": {"loadAvg": [1.61, 1.06, 1.28], "cores": 16},
    "cost": {"input": 0.38, "output": 0.16, "total": 0.54, "currency": "USD"}
  }
}
```

---

## Runtime Observability (WP-80)

Read-only observability endpoints. Auth required.

### GET /api/observability/runtime

Canonical runtime snapshot. Returns engine, active task, workers, leases, pipeline, knowledge, health, metrics, and recent events.

### GET /api/observability/workers/:id

Single worker detail with lease history.

### GET /api/observability/events

Paginated event timeline. Query params: `?limit=50&type=X&taskId=Y&phase=Z`

### GET /api/observability/pipeline/:taskId

Detailed pipeline state for a specific task with phase history.

### GET /api/observability/knowledge/:taskId

Knowledge entry for a specific task.

### GET /api/observability/tasks/:taskId/artifacts

List artifacts (reports) produced by a task.
