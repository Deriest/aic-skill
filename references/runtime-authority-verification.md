## Runtime authority ad-hoc verify (FEAT-001)

Protected routes return **401** without `X-API-Key`; **403** with key when legacy mutation is blocked.

```bash
source scripts/api-auth.sh
KEY from .aic/auth.json → curl_api -H "X-API-Key: ..."

# Expect 403 (authed):
curl_api -X POST .../api/task-status -d '{"currentPhase":"Planning"}'
curl_api -X POST .../api/phase-barrier -d '{"action":"start","workers":["pm"]}'
# After task.start with TASK-*:
curl_api -X POST .../api/agent-status -d '{"agent":"pm","status":"working"}'
curl_api -X POST .../api/task-complete -d '{"taskId":"TASK-..."}'

# Expect 200 snapshot fields:
curl .../api/status  # connected, workers, engine, phaseBarrier, runtimeGate
```

Pattern: single `/tmp/hermes-verify-feat001-v2.sh` — ephemeral port, trap cleanup, `SUMMARY pass=N fail=0`.

**Not sufficient for Runtime OAT:** still need real `opencode` + full engine pipeline via `task.start` / engine `runPipeline`.

**Runtime OAT poll:** `GET /api/status` — `currentTask.pipelineState`, `phaseStatus`, `engine.runtimeGate`. Full pipeline may exceed 10–60 min per phase with Thinker tier.

**Repo J (2026-07-13):** delete `if (false)` legacy mutation blocks in `server.js` after 403 stubs exist.

**Worker path:** `spawn-worker.sh` → lease issue/complete; artifact validation in engine `finishLease`.

**Artifacts:** load `references/opencode-json-artifact-and-metrics.md` if PM BLOCKED on JSON dumps.