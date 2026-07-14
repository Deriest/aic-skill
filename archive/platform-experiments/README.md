# Platform Experiments Archive (WP-102)

Legacy platform prototypes from Milestone E/J era — early multi-dispatcher, knowledge platform v1, worker autonomy ideas.

**Status:** Archived as of WP-102 — not referenced by production `scripts/engine/` or `scripts/server.js`.

| File | Origin | Superseded By |
|------|--------|---------------|
| `collaboration.sh` | Team collab prototype | `scripts/engine/` + phase-runner |
| `context-sharing.sh` | Worker context share | `context-gather.sh` + `.aic/tasks/<id>/context.json` |
| `decision-engine.sh` | Dispatcher decision | Engine FSM (`fsm.js`) |
| `dependency-graph.sh` | Worker deps | Engine barrier |
| `project-manager.sh` | Multi-project | server.js `getActiveProject()` |
| `resource-manager.sh` | Quotas | `enterprise-endpoints.js` |
| `security-governance.sh` | Security gov | `auth.js` + RBAC |
| `task-decomposer.sh` | Task decompose | Investigate phase PM |
| `worker-autonomy.sh` | Worker autonomy | `worker-execution-pipeline.py` |
| `worker-memory.sh` | Worker memory | `knowledge-*.sh` + `.aic/workers/` |
| `worker-registry.sh` | Capability registry | `engine/index.js` workerIds |
| `workspace.sh` | Workspace mgmt | server.js project management |
| `permissions.sh` | RBAC | `auth.js` |
| `audit-platform.sh` | Audit platform | server.js metrics + logger + `/api/audit` |

Restore via `git mv archive/platform-experiments/<file> scripts/` if needed (history preserved via `git mv`).
