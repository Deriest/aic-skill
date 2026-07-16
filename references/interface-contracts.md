# Interface Contracts — AIC Skill

## HTTP API (server.js, port 6868)

### Public (no auth)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check: `{ ok, port, uptime }` |
| `/api/status` | GET | Dashboard state snapshot |
| `/api/version` | GET | `{ version, milestone }` |
| `/api/project` | GET | Active project info |
| `/api/config` | GET | Config files (`.env`, `opencode.jsonc`) |
| `/api/tasks` | GET | List all tasks |
| `/api/metrics` | GET | Metrics with filtering (`?from=&to=&tier=`) |
| `/api/models` | POST | Proxy upstream model list |
| `/api/pipeline/status` | GET | Phase state machine |

### Authenticated (X-API-Key header)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/keys` | GET/POST/DELETE | API key management |
| `/api/runtime/intent` | POST | Pipeline intents: `task.create`, `task.start`, `task.pause`, `task.resume`, `task.cancel`, `task.retry` |
| `/api/runtime/lease/issue` | POST | Issue worker lease |
| `/api/runtime/lease/:id/complete` | POST | Complete worker lease |
| `/api/runtime-gate` | POST | Set/clear runtime gate |
| `/api/task-start` | POST | Create + start task (shortcut) |
| `/api/agent-status` | POST | Update agent status |
| `/api/sub-agent-status` | POST | Update sub-agent status |
| `/api/pm-review` | POST | PM review verdicts |
| `/api/reset` | POST | Reset all workers to idle |
| `/api/config` | POST | Save config files |
| `/api/work-packages` | GET/POST | Work package management |
| `/api/observability/*` | GET | Observability endpoints |

### Blocked (engine owns pipeline)
- `POST /api/task-status` → 403
- `POST /api/phase-barrier` → 403
- `POST /api/task-complete` → 403

## Environment Variables
| Variable | Source | Purpose |
|----------|--------|---------|
| `PORT` | server.js arg or env | HTTP port (default: 6868) |
| `GITHUB_TOKEN` | .env | Git operations |
| `AIC_PROJECT_DIR` | .env | Workspace directory |
| `AIC_ACTIVE_PROJECT` | .env | Selected project |
| `AIC_CORS_ORIGINS` | env | CORS allowed origins |
| `AIC_RUNTIME_ENGINE` | spawn-worker | Flag for spawned processes |
| `AIC_TASK_ID` | spawn-worker | Current task ID |
| `AIC_PIPELINE_PHASE` | spawn-worker | Current phase |
| `AIC_PM_REPAIR` | pm-repair | Flag for repair spawns |

## File Formats

### State Files (`.aic/`)
| File | Format | Atomic Write |
|------|--------|-------------|
| `state.json` | Global state object | Yes |
| `tasks/TASK-xxx/engine.json` | Pipeline checkpoint | Yes |
| `tasks/TASK-xxx/state.json` | Legacy status (derived) | Yes |
| `tasks/TASK-xxx/context.json` | Task metadata | Yes |
| `metrics.json` | Metrics array | Yes |
| `latency_metrics.json` | Latency ring buffer | Yes |
| `queue.json` | Task queue | Yes (flock) |
| `health.json` | Health state | No |
| `credentials.json` | API keys | No |
| `audit.log` | Audit events | Append |

### Checkpoint Structure (`engine.json`)
```json
{
  "id": "TASK-xxx",
  "pipelineState": "INVESTIGATE|PLANNING|IMPLEMENTATION|VERIFICATION|CLOSEOUT|COMPLETE|CANCELLED|BLOCKED|CREATED",
  "phaseStatus": "idle|spawning|barrier_wait|failed|interrupted|pm_repair",
  "phaseBarrier": { "active": bool, "workers": [], "completed": {}, "failed": {} },
  "projectDir": "/path",
  "rework": { "phase": "", "attempt": 0, "repairedWorkers": [], "lastVerdict": "" },
  "pmReview": { "phase": "", "verdicts": {}, "feedback": {} },
  "runtimeGate": null | { "type": "", "owner": "", "target": "", "status": "" }
}
```

## Exit Codes
| Code | Meaning |
|------|---------|
| 0 | Success (PASS) |
| 1 | Error (script failure, infrastructure issue) |
| 2 | Blocked (quality bar not met, PM BLOCKED verdict) |

## State Machine
```
CREATED → INVESTIGATE → PLANNING → IMPLEMENTATION → VERIFICATION → CLOSEOUT → COMPLETE
                         ↓            ↓               ↓
                      BLOCKED       BLOCKED         BLOCKED
                                      ↓
                                   CANCELLED
```

Phase transitions: `PHASE_PLANS` in `engine/fsm.js`
Lifecycle enforcement: `PHASE_ALLOWED` in `scripts/config.js`
