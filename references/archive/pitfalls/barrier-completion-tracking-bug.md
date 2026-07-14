# Barrier Completion Tracking Bug (2026-07-14)

## Symptom

When spawning Planning workers sequentially (one at a time via `spawn-worker.sh`), the `phaseBarrier.completed` object does NOT record all workers despite `spawn-worker.sh` exiting 0 ("completed").

Typical pattern:
- `architect` → always recorded ✅
- `pm` → NOT recorded ❌ (even when spawn returns success)
- `research` → NOT recorded ❌ (even when spawn returns success)

Result: `phaseBarrier.completed` has only `{"architect": "complete"}` while `spawn-worker.sh` reports all 3 as complete. Phase stays BLOCKED forever because `barrierSatisfied()` is false.

## Root Cause

Under the FEAT-001 runtime engine, workers report completion via `POST /api/runtime/lease/{id}/complete`. Sequential spawning means each worker runs against the SAME phase barrier object. The engine's barrier tracking expects all workers to be spawned before any completes — the barrier `workers` array is set at barrier creation time.

When spawning sequentially:
1. Barrier created with workers `[pm, architect, research]`
2. Spawn architect → lease created → architect completes → completion recorded ✅
3. Spawn pm → lease created → pm completes → completion NOT recorded ❌
4. The engine's lease→barrier mapping may be desynced when workers are spawned at different times

This is related to but distinct from FIX-010 (`reconcilePhaseBarrier`). FIX-010 handles the case where `phase-runner.sh` exits 0 but barrier is incomplete. This bug is about the runtime engine not recording lease completions for sequentially spawned workers.

## Detection

```bash
# Spawn returns success
bash scripts/spawn-worker.sh pm thinker /project /prompt
# === pm completed (lease reported) ===

# But barrier doesn't record it
curl -s -H "X-API-Key: $KEY" http://localhost:6868/api/status | python3 -c "
import sys, json
d = json.load(sys.stdin)
b = d.get('phaseBarrier') or {}
print('completed:', json.dumps(b.get('completed')))
# Shows: {"architect": "complete"} — pm missing!
"
```

If `spawn-worker.sh` exits 0 but `phaseBarrier.completed` does NOT include that worker after 10 seconds → this is the barrier tracking bug.

## What Does NOT Fix It

1. **Retrying the same worker** — spawns a new lease but same desync
2. **Restarting server** — state persisted in `.aic/state.json`, reloads with same incomplete barrier
3. **Creating a new task** — engine state is global (not per-task for barrier), same issue carries over
4. **`/api/task-status` phase advance** — returns 400, engine FSM controls phases

## What DOES Fix It

**Option A: Full state reset**
```bash
# Cancel task
curl -X POST -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  http://localhost:6868/api/runtime/intent -d '{"intent":"task.cancel","taskId":"TASK-xxx"}'

# Reset engine state
curl -X POST -H "X-API-Key: $KEY" http://localhost:6868/api/reset

# Restart server
# kill old server, start fresh

# Create new task + use pipeline-orchestrator.sh (not manual sequential spawn)
```

**Option B: Use `phase-runner.sh` with `&` + `wait`** (parallel, not sequential)
```bash
bash scripts/phase-runner.sh Planning /project pm,thinker architect,thinker research,thinker
```
This spawns all 3 in parallel and handles barrier correctly. The bug only manifests with sequential spawning.

**Option C: Use `pipeline-orchestrator.sh`** for full end-to-end pipeline
```bash
bash scripts/pipeline-orchestrator.sh "task description" /project/dir
```

## Prevention

1. **Prefer parallel spawning** — `phase-runner.sh` or `terminal(background=true)` per worker, NOT sequential `spawn-worker.sh` calls in a loop
2. **If parallel is impossible** — use `pipeline-orchestrator.sh` which handles barriers internally
3. **Detect early** — if first spawn completes but barrier doesn't record it, STOP immediately. Don't create new tasks.
4. **2× rule** — if the same symptom repeats across 2 task attempts, it's an engine bug. Report to user.

## Related

- FIX-010: `reconcilePhaseBarrier` (different symptom: `phase-runner.sh` exit 0 but barrier incomplete)
- FIX-008: `let artifacts` in `runPmReview` (PM TypeError, not barrier)
- FIX-009: `task_active` on concurrent `task.start` (task ownership, not barrier)
