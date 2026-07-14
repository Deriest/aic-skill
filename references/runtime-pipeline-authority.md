# Runtime Pipeline Authority (FEAT-001)

## Principle

**Runtime Engine** (`scripts/engine/`) is the **only** mutator of pipeline state. Everything else is a client.

Canonical task id: **`TASK-YYYYMMDD-NNN`** only. No `task-<unix>` orchestrator side dirs.

## Dispatcher (intent-only)

Use **`POST /api/runtime/intent`** with:

| intent | purpose |
|--------|---------|
| `task.create` | allocate TASK-*, context + checkpoint |
| `task.start` | begin pipeline (async in engine) |
| `task.pause` / `task.resume` / `task.cancel` / `task.retry` | lifecycle control |

**`POST /api/task-start`** still works: delegates to `task.create` + `task.start`.

Forbidden for Dispatcher during engine-owned runs:

- `POST /api/task-status` (403)
- `POST /api/agent-status` for workers when `currentTask.id` is TASK-* (403)
- `POST /api/task-complete` (403)
- `POST /api/phase-barrier` (403)
- Direct phase advance via curl

## Workers (lease + completion contract)

Flow:

1. `phase-runner.sh` spawns `spawn-worker.sh` with `AIC_TASK_ID` set by engine.
2. `spawn-worker.sh` calls **`POST /api/runtime/lease/issue`** (unless `AIC_LEASE_ID` preset).
3. After `opencode run`, worker writes artifact to `.aic/tasks/<TASK>/reports/<worker>-output.md`.
4. Worker reports **`POST /api/runtime/lease/<leaseId>/complete`** with `exitCode` + `artifactPath`.

Engine marks worker **complete** only if: exit 0 + artifact exists + size/content checks + optional `worker-validation.sh`.

**Exit code alone never completes a worker.**

## Dashboard

**`GET /api/status`** returns canonical snapshot (includes `phaseBarrier`, `runtimeGate`, `pmReview`, `rework`, `engine.events` tail). Poll-only; no inference from filesystem.

## Shell scripts (post-FEAT-001)

| Script | Role |
|--------|------|
| `pipeline-orchestrator.sh` | Thin client: one `POST /api/task-start`, engine runs pipeline |
| `phase-runner.sh` | Parallel spawn; no `task-status` posts |
| `spawn-worker.sh` | Lease issue + opencode + lease complete; no agent-status/task-status |
| `aic continue` | `task.resume` intent, not task-status |

## Legacy callers still to migrate

`preflight.sh`, `rework-handler.sh`, `spawn-sub.sh`, `pm-review.sh` (curl pm-review during pipeline) may need engine alignment.

## Artifacts

`.aic/runtime-contracts.json` — per-worker report paths and min size/content.

Per-task checkpoint: `.aic/tasks/<TASK>/engine.json`.

## Events (internal)

`task.created`, `task.started`, `phase.started`, `worker.started`, `worker.completed`, `worker.failed`, `barrier.completed`, `pm.review.completed`, `task.completed`, `knowledge.started`, `knowledge.completed` (async post-complete; does not block COMPLETE).