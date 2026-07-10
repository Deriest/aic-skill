# Enterprise Pipeline Pattern (Milestone J+)

## Pipeline Orchestrator

`pipeline-orchestrator.sh` chains the full AIC workflow end-to-end:

```bash
pipeline-orchestrator.sh "task description" /project/dir
```

### Phase Execution Order

| Phase | Workers | Tier | Model |
|-------|---------|------|-------|
| investigate | pm | thinker | Opus |
| planning | pm, architect, research | thinker | Opus |
| implementation | backend, frontend | crafter | Sonnet |
| verification | qa | crafter | Sonnet |
| closeout | pm | thinker | Opus |

After closeout, knowledge auto-update triggers automatically.

### API Contract

- `POST /api/task-start` — requires `{title, type}` (NOT `{task, project_dir}`)
- `POST /api/task-complete` — triggers knowledge auto-update
- `GET /api/pipeline/status` — returns `{phases: [...], current: {...}}`

### Knowledge Auto-Update (RP-003.3)

After `POST /api/task-complete`, server.js writes to `knowledge/task-entries.json`:
```json
[{"task_id": "task-xxx", "status": "done", "timestamp": 1234567890}]
```

This is best-effort — errors don't block task completion.

### Phase State Machine (RP-003.2)

Each task creates `.aic/tasks/<task_id>/state.json`:
```json
{"id": "task-xxx", "description": "...", "project_dir": "...", "phase": "investigate", "status": "running", "started_at": 1234567890}
```

Phases update the state file as they progress. Final state: `phase=complete, status=done`.

### Enterprise Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| /api/projects | GET/POST | Multi-project registry |
| /api/projects/select/:id | POST | Set active project |
| /api/workspaces | GET | Workspace list |
| /api/permissions | GET | RBAC matrix |
| /api/permissions/assign | POST | Assign role (admin/lead/member/viewer) |
| /api/audit | GET | Query audit log |
| /api/resources/quota | GET/POST | Workspace quotas |
| /api/dispatchers | GET/POST | Dispatcher registry |
| /api/pipeline/status | GET | Phase state machine |

### Pitfalls

1. **Thinker tier timeouts** — Opus workers occasionally hit 180s timeout. Pipeline correctly reports failure. Sprinter/Crafter tiers more reliable for testing.
2. **`return send()` crash** — In enterprise-endpoints.js, always `send(...); return true;` (not `return send(...)` which returns undefined and causes ERR_HTTP_HEADERS_SENT).
3. **Project select empty response** — `/api/projects/select/:id` updates `active-project.json` but returns empty HTTP body. Minor endpoint issue.
