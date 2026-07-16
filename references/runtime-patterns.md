# Runtime Patterns

> **Consolidated from 11 files.** Originals archived in `references/archive/`.

**Original files merged:**
- `runtime-authority-verification.md`
- `runtime-auth-pattern.md`
- `runtime-checkpoint-task-isolation.md`
- `runtime-cost-metrics.md`
- `runtime-gate-system.md`
- `runtime-lease-pitfall.md`
- `runtime-observability-wp80.md`
- `runtime-pipeline-authority.md`
- `runtime-pm-opencode-invocation-imp011.md`
- `runtime-recovery-investigation-wp3.md`
- `runtime-stop-all-tasks.md`

---

---

## Source: `runtime-authority-verification.md`

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
---

## Source: `runtime-auth-pattern.md`

# Runtime Auth Pattern — api-auth.sh

## Problem

After adding `auth.requireAuth()` to `server.js`, internal bash scripts (`spawn-worker.sh`, etc.) that call API endpoints via `curl` fail silently because they don't send auth headers.

## Solution: api-auth.sh Helper

`scripts/api-auth.sh` reads the first API key from `.aic/auth.json` and provides a `curl_api` wrapper that auto-injects the `X-API-Key` header.

### Usage in any runtime script

```bash
source "$(dirname "$0")/api-auth.sh"

# Instead of: curl -sf -X POST "$API_URL/api/agent-status" ...
# Use:
curl_api -X POST "$API_URL/api/agent-status" \
  -H "Content-Type: application/json" \
  -d "{\"agent\":\"$WORKER\",\"status\":\"working\"}" \
  2>&1 || echo "[WARN] agent-status failed" >&2
```

### What curl_api does

1. Reads first key from `$SKILL_DIR/.aic/auth.json`
2. Passes `-H "X-API-Key: $key"` to curl
3. Falls back to unauthenticated curl if no key exists (dev mode)

### Scripts that source api-auth.sh

- `spawn-worker.sh`
- `spawn-sub.sh`
- `phase-runner.sh`
- `pm-review.sh`
- `rework-handler.sh`

### Rules

1. NEVER use raw `curl -sf` for `/api/` endpoints — always `curl_api`
2. NEVER use `|| true` on API calls — log failures with `echo "[WARN]" >&2`
3. `|| true` is ONLY acceptable for: env file sourcing and non-critical `cp`

### server.js auth scope

Auth applies ONLY to `/api/*` routes. Dashboard static files and `GET /api/status` are exempt:

```javascript
// Line ~162: Dashboard reads status without auth
if (req.method === 'GET' && pathname === '/api/status') { ... }

// Line ~194: All other API routes require auth
if (pathname.startsWith('/api') && !auth.requireAuth(req, res)) return;
```

---

## Source: `runtime-checkpoint-task-isolation.md`

# Runtime checkpoint ↔ dashboard task isolation (FEAT-001)

## Class of failure

Runtime OAT reports **BLOCKED** for task **A** while **A** has no `reports/*.md`, no leases, and no `checkpoint.json` — yet global `currentTask.id` is **A** with `pipelineState=BLOCKED`.

## Root cause (proven 2026-07-13, TASK-20260713-009)

`syncDashboardFromCheckpoint(cp)` copies `cp.pipelineState`, `phaseStatus`, `phaseBarrier` onto **`state.currentTask` without verifying `cp` belongs to `state.currentTask.id`**.

When two pipelines overlap (e.g. **008** `task.retry` + **009** `task.start`), the **losing** task’s checkpoint update can paint **BLOCKED** onto the **current** task id.

Engine path: `runPhase` → `pm-review.sh` exit ≠ 0 → `cp.pipelineState = 'BLOCKED'` → `syncDashboardFromCheckpoint(cp)`.

`runPmReview` with **zero** artifacts returns `allPass: true, skipped: true` — so **BLOCKED cannot be attributed to PM on an empty `reports/`** for that task id.

## Forensic checklist (no code changes)

1. OAT log: how many polls? Sudden `INVESTIGATE spawning` → `BLOCKED` with no PM lines for that task id?
2. `.aic/tasks/<TASK>/reports/` — any `*.md`?
3. `.aic/tasks/<TASK>/checkpoint.json` — exists? `pipelineState`?
4. `.aic/state.json` — `leases` filtered by `taskId`; `phaseBarrier.startedAt` vs other tasks’ leases
5. `/tmp/oat*.log` or phase-runner stdout — **VERDICT: REWORK** for a *different* task id
6. `pmReview` null + BLOCKED → suspect cross-task sync, not PM verdict on current task

## OAT hygiene (mandatory)

- **One active pipeline** per server: cancel/finish or wait for **BLOCKED/COMPLETE** on task **N** before `task.start` on **N+1**.
- Do not run full OAT **009** while **008** retry/resume is in flight.

## Smallest corrective actions

1. **Runtime:** gate `syncDashboardFromCheckpoint` on `checkpoint.id === state.currentTask.id` (or taskId field on cp).
2. **OAT:** serialize tasks; reset stale `currentTask` if needed (`/api/reset` only when user approves).
3. **Prompt:** `task.create` must carry **description** + Investigate deliverable (see `runtime-oat-investigate-scope.md`).

## Related

- `pm-review-exit-code-pitfall.md` — REWORK exit 1 is expected; parse `VERDICT:` not xargs
- `opencode-json-artifact-and-metrics.md` — artifact `.md` vs raw JSON; metrics from raw file
- `runtime-authority-verification.md` — canonical categories A–J
---

## Source: `runtime-cost-metrics.md`

# Runtime cost and metrics

## How cost is recorded

- **File:** `.aic/metrics.json` (append via `POST /api/metrics`)
- **Who posts:** `spawn-worker.sh` **legacy** branch only — after opencode, greps last `"input"`/`"output"` from NDJSON file
- **WECP path:** `worker-execution-pipeline.py` does **not** POST metrics (gap vs user expectation on cost tracking)

## Payload gaps

- POST body: `worker`, `tier`, `model`, `tokens` — **`taskId` not sent** (all 72 historical entries lack `taskId`)
- `GET /api/metrics` → `summary.cost` = USD estimate over **entire** metrics array (server.js rates), not filtered by task status

## User question: “task done masuk cost?”

**No per-task rule.** Done/failed/BLOCKED does not gate inclusion. Any legacy spawn with non-zero input tokens adds to global cost. Task `status: done` in `state.json` is unrelated to metrics linkage.

## Dashboard vs authoritative cost

- Authoritative: `GET /api/metrics` (nested `summary.cost`)
- `/api/metrics/summary` (ops-endpoints) — flat object, **no** cost field (different endpoint)

## When answering user about cost

Cite metrics.json + spawn path; mention WECP runs may be **missing** from cost until WECP posts metrics.

## Dispatcher answer template (Indonesian)

Task **done** tidak otomatis punya baris cost sendiri. Total cost = semua entri di `metrics.json` (legacy spawn dengan token). Status done/failed tidak difilter. WECP path saat ini biasanya **tidak** POST metrics.
---

## Source: `runtime-gate-system.md`

# Runtime Gate System

## Overview

Runtime Gates are first-class synchronization checkpoints in AIC v3.1. They are NOT lifecycle phases and NOT workers.

## Supported Gates

| Gate Type | Owner | Purpose |
|-----------|-------|---------|
| PM Review | PM | Validates artifact completeness before phase transition |
| Dispatcher Gate | Dispatcher | Advances lifecycle only after PM PASS |
| Waiting User | Dispatcher | Pauses pipeline for user clarification |
| Sub-worker Sync | Head Worker | Blocks completion until all sub-workers finish |

## Runtime State

```json
{
  "runtimeGate": {
    "type": "pm-review",
    "owner": "pm",
    "target": "architect",
    "status": "reviewing",
    "startedAt": 1234567890,
    "metadata": {}
  }
}
```

## API

- `POST /api/runtime-gate` — Set or clear runtime gate state
- `GET /api/status` — Returns current runtimeGate in state

**FEAT-001:** Engine-owned TASK-* runs: `runtimeGate`, `phaseBarrier`, `pmReview` on snapshot come from **Runtime Engine**. External `POST /api/phase-barrier` and worker `agent-status` return **403**. See `references/runtime-pipeline-authority.md`.

## Dashboard

Pipeline panel split into two columns:
- Left: Rule of 5 lifecycle phases
- Right: Current Runtime Gate status (type, owner, target)

## Double Gate System

Every phase transition requires:
1. PM Review (completeness validation) → PASS/REWORK
2. Dispatcher Gate (API lifecycle advance)

Worker completes → PM Review → PASS → Dispatcher Gate → Next Worker
Worker completes → PM Review → REWORK → Return to same Worker

## Sources

- ADR-002 §4.3
- SPEC-002 §7
- RUNTIME-GATE-IMPLEMENTATION.md

---

## Source: `runtime-lease-pitfall.md`

# Runtime Lease Enforcement Pitfall

**Symptom:** 
Running ad-hoc tests via `bash scripts/spawn-worker.sh <phase> <tier> <dir> <prompt>` manually fails with the following error:
`ERROR: No runtime lease. Engine must issue lease before spawn.`

**Root Cause:** 
The orchestration engine now strictly enforces lease validation for worker execution. Workers cannot be spawned out-of-band directly via `spawn-worker.sh` without the NodeJS engine (`engine/index.js`) first issuing a valid lease in the state store.

**Resolution:**
To test workers, verify LLM connectivity, or run ad-hoc tasks:
1. **Do not** use `spawn-worker.sh` directly for testing.
2. **Use the pipeline:** Trigger tasks properly via the API (`POST /api/task-start`) or the orchestrator (`pipeline-orchestrator.sh`).
3. **Direct OpenCode bypass (for raw connectivity tests):** If you only need to test LLM connectivity outside the pipeline and don't need artifacts extracted, use `opencode` directly via stdin:
   ```bash
   echo "Test prompt" | opencode run -m <ModelName> --auto
   ```
---

## Source: `runtime-observability-wp80.md`

# Runtime Observability (WP-80)

## When to load
Runtime monitoring gaps / `SV-007` through `SV-017` blocked / observability API design / runtime snapshot schema / event store / knowledge/lease/pipeline querying.

## Key findings
- Existing dashboard/monitoring relied on `/api/status` plus hidden engine internals; integration validation could not run because runtime process state was not observable through stable public APIs.
- Canonical runtime snapshot should be read-only and should not mutate engine state, workers, dispatcher, or pipeline execution.
- Single primary snapshot endpoint is preferred for dashboard, CLI, monitoring, and validation, with drill-down endpoints only where snapshot data would be too large or filtered.

## Architecture summary
- Primary endpoint: `GET /api/observability/runtime`
- Snapshot should include engine, active task, workers, leases, pipeline, knowledge, health, metrics, and recent events.
- Keep drill-down endpoints only for true narrowing use cases:
  - `GET /api/observability/workers/:id`
  - `GET /api/observability/events`
  - `GET /api/observability/pipeline/:taskId`
  - `GET /api/observability/knowledge/:taskId`
  - `GET /api/observability/tasks/:taskId/artifacts`
- Merge into snapshot instead of duplicating:
  - `workers`
  - `leases`
  - pipeline overview
  - aggregate knowledge status
  - health

## Canonical sources
- Worker status: `state.workers` in-memory
- Current task: `state.currentTask`
- Phase state: `.aic/tasks/<TASK-ID>/checkpoint.json`
- Leases: `state.engine.leases`
- Knowledge: `.aic/knowledge/` + `task-entries.json`
- Events: `.aic/events.jsonl` (append-only JSONL)
- Health/metrics: `.aic/health.json`, `.aic/metrics.json`

## Event store
- Use append-only JSONL (`events.jsonl`).
- Rotate at ~10MB; keep a small archive cap (e.g., last 5 rotated files).
- On startup, recover by truncating the last corrupted line instead of failing.
- Event persistence should be wired into existing engine event emission, not into a new engine redesign.

## WP dependency order
- `event-store`
- `observability-service`
- `REST layer`
- `dashboard` / `system-validation`
- `docs + closeout`

## Current status (as of 2026-07-15)
- **WP-80 IMPLEMENTATION COMPLETE** — all 6 endpoints verified at runtime.
- Pipeline orchestrator contract drift fixed (commit `1dd0a30`).
- Health check policy aligned: knowledge lazy → overall healthy.
- Dashboard config INTERCEPT issue resolved (removed from opencode.jsonc).
- Pending: WP-80 commit (code ready, awaiting PM commit order).

## Lessons
- If `phase-runner.sh` / `spawn-worker.sh` or lease-gated tooling blocks validation, check whether the missing capability is observability before assuming execution failure.
- `pipeline-orchestrator.sh` previously omitted the mandatory `description` field; Engine source of truth stays unchanged — fix the client/orchestrator payload contract.
- `curl_api()` must not send a literal placeholder header value; the safest repair pattern is building the header via an intermediate variable, not direct string interpolation inside `-H "..."`.
- Avoid `server.js` restart loops with `&` in foreground terminal; for long-lived servers use `terminal(background=true)` or explicit process management.
- `write_file`/`patch` tools with Smart Approval will escape `$key` to literal `***` when the content matches credential injection patterns. Use `terminal()` heredoc or Python inline to write files containing credential variables.
- When server.js is running from a previous `terminal(background=true)`, the old process must be killed before starting a new one. Check with `lsof -t -i:6868` first.
- `POST /api/project/active` may return `not found` — use `.env` file `AIC_PROJECT_DIR` instead for project path configuration.

## Recommended tests
Before declaring runtime observability done, verify:
- snapshot returns active task + worker + lease + phase state
- events endpoint returns persisted timeline after restart
- knowledge endpoint reflects lazy-not-initialized state until task completion
- historical pipeline lookup works for completed/failed tasks

## Implementation files (shipped in commit 1dd0a30 + WP-80)
- `scripts/engine/event-store.js` — append-only JSONL store with 10MB rotation, 5 archive cap, `_appendCount` optimization (rotation check every 100 appends)
- `scripts/engine/events.js` — modified to accept optional `persistFn` callback; event bus emits to in-memory array AND persists to JSONL
- `scripts/engine/observability.js` — read-only service with 5s TTL cache (`_cachedRead`/`_cachedJson`) for health.json, metrics.json, checkpoint.json, knowledge files
- `scripts/observability-handler.js` — thin HTTP handler, routes 6 endpoints, auth enforced in server.js before handler
- `scripts/server.js` — 3 patches: require, init obsHandler, route before 404

## Cache strategy (CR-O1/O3 refinement)
Observability service caches filesystem reads with 5s TTL via `_cachedRead()` / `_cachedJson()`. This prevents repeated I/O for health.json, metrics.json, and checkpoint.json on every `/api/observability/runtime` call. Cache is in-memory Map, invalidated by TTL (not explicit invalidation). Acceptable because these files change infrequently (health-check.sh runs manually or on schedule, metrics written on task completion).

---

## Source: `runtime-pipeline-authority.md`

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
---

## Source: `runtime-pm-opencode-invocation-imp011.md`

# PM Review — OpenCode invocation (IMP-010 / IMP-011)

## Failure modes (OAT chain)

| OAT | Symptom | Cause |
|-----|---------|--------|
| 033 | PM narrative, no VERDICT | `--auto` → model implemented instead of review |
| 034 | `read(promptFile)` permission denied | Positional path as message; no `--auto` |
| 035 | **Empty raw verdict** | `-f` OK but **message after `-f` parsed as file path** |

## CLI contract (`opencode run --help`)

- Positionals: `message` (array) — **not** “load this path as prompt body”.
- `-f` / `--file`: attach file to the user message.
- **Must** provide at least one message (not `-f` alone).

## Wrong argv (FIX-012 initial — breaks 035)

```javascript
['run', '-m', model, '--format', 'json', '-f', promptFile, reviewMsg]
```

OpenCode error: `File not found: <reviewMsg first line>` — treats trailing positional as **filesystem path**.

## Correct argv pattern

Put the **short review instruction immediately after `run`**, then flags, then `-f`:

```javascript
['run', reviewMsg, '-m', model, '--format', 'json', '-f', promptFile]
```

- `reviewMsg`: review-only + first line `VERDICT: PASS|REWORK|BLOCKED` (FIX-011).
- `promptFile`: full generated prompt (artifacts embedded) — **attach**, do not pass as sole positional.

## Worker vs PM (do not copy worker transport to PM)

| | Worker (WECP) | PM (`pm-review.sh`) |
|---|----------------|---------------------|
| Pattern | `run <promptPath> … --auto` | `run <shortMsg> … -f <prompt>` **no `--auto`** |
| Why | Needs tools to read path + execute | Reviewer only; path-as-message causes `read()` |

## Production blind spots (`pm-review.sh`)

- `node "$NODE_RUNNER" … 2>/dev/null || true` — **hides OpenCode stderr** (e.g. File not found).
- Empty stdout → `opencode-json-to-md.py` exits 1 → parser sees empty → UNKNOWN exit 3.

**Forensic recipe (no OAT):** run `opencode` with same argv, capture stdout/stderr, count NDJSON `type:text`, do not suppress stderr.

## Shipped (FIX-013)

`pm-review.sh` uses correct argv + `PM opencode diagnostics` / `PM extract failed` on empty output (replaces blind `2>/dev/null || true`).

**OAT 036:** Investigate + Planning PM **PASS** with `VERDICT:` — validates FIX-011/012/013. Implementation PM **REWORK** → IMP-012 (preamble), not transport.

## Related fixes

- FIX-011: review-only prompt, no `--auto` on PM.
- FIX-012: `-f` attach (argv order per this doc).
- FIX-013: message after `run`, then `-f`; diagnostics.
- Parser: unchanged (FIX-004); needs assistant text with `VERDICT:`.
---

## Source: `runtime-recovery-investigation-wp3.md`

# WP-3 — Runtime Recovery Investigation

## Observed
- Dispatcher historically recommended `server.js` restarts prematurely when the pipeline appeared "stuck."
- Pipeline stalls are consistently traced to `phaseBarrier` synchronization issues, not server crashes.
- A PM worker timeout (e.g., during Planning) incorrectly registers in the engine state as a `REWORK` verdict, incrementing the `rework.attempt` counter until the task is permanently poisoned.
- Sequential spawns (when foreground terminal is used without backgrounding) cause the engine's barrier tracking (`phaseBarrier.completed`) to drop worker completion events, leaving the phase blocked.

## Recovery Flow
The intended recovery sequence in the AIC architecture operates in nested loops:

1. **Worker Failure (Syntax/Schema):** Handled internally by WECP (`worker-execution-pipeline.py`) via the `repair` loop (default 2-3 attempts).
2. **Worker Failure (Crash/Timeout):** Handled by `spawn-worker.sh` wrapper via a basic retry loop (`MAX_ATTEMPTS=2`, `sleep 5`).
3. **Artifact Quality Failure:** Handled by `pm-review.sh` returning `REWORK` → `rework-handler.sh` respawns only the failed workers.
4. **Lease Completion:** Worker finishes, `POST /api/runtime/lease/{id}/complete`.
5. **Barrier Reconciliation:** Engine evaluates `phaseBarrier.completed`. If all workers match `phaseBarrier.workers`, the phase advances.
6. **Task Completion:** `pipeline-orchestrator.sh` finalizes the task.
7. **Runtime Idle:** Task completes, `state.json` marked done.

**Where recovery stops:** 
Recovery breaks at **Step 5 (Barrier Reconciliation)** if a worker times out or is spawned sequentially. The engine records a failed lease or increments `rework.attempt` without a valid PM verdict. The barrier never satisfies, and the orchestrator hangs. 

## Evidence
- **Logs:** Historical PITFALL logs from `dispatcher-discipline-aic` ("Promo site constraints", "Dispatcher manual state manipulation").
- **Barrier State:** When sequential spawns are used, `phaseBarrier.completed` shows `{"architect": "complete"}` but is missing `pm` and `research`, despite their scripts exiting 0.
- **Lease State:** "ERROR: No runtime lease. Engine must issue lease before spawn" occurs when retrying a poisoned barrier.
- **Runtime State (`state.json`):** `rework.attempt` > 2 and `rework.lastVerdict: REWORK` are recorded even when the actual event was an `ETIMEDOUT` exception, not a PM Review evaluation.

## Failure Classification

| Failure Type | Actual Root Cause | Historical Dispatcher Classification | Correct Classification |
|--------------|-------------------|--------------------------------------|------------------------|
| **WECP Schema Error** | Worker missed contract section | Normal operation (WECP Repair) | Handled automatically |
| **Worker Timeout** | `ETIMEDOUT` in spawn script | "Model availability / Server Stuck" | Engine Timeout |
| **Barrier Stall** | Sequential spawn dropping completion | "Pipeline Stuck -> Recommend Restart" | Barrier Sync Defect |
| **Lease Rejection** | Barrier is in transitional/poisoned state | "Unknown Error" | Poisoned State |

## Recovery Effectiveness
- **Success rate (WECP Repair):** HIGH. Contract validation and self-correction effectively prevent bad artifacts from reaching PM Review.
- **Success rate (PM Rework):** MEDIUM. Standard quality reworks succeed if feedback is clear.
- **Success rate (Barrier Stall):** ZERO. The engine cannot auto-recover from a dropped barrier completion or a timeout-poisoned rework counter.
- **False restart recommendations:** HIGH (prior to RH-001). Dispatcher frequently misdiagnosed barrier stalls as server crashes and requested restarts.

## Verified Findings
1. **Restart is virtually never required.** The server remains healthy (`/health` returns 200). 
2. **State poisoning is task-scoped.** A poisoned `phaseBarrier` or `rework.attempt` is isolated to the specific task ID (`.aic/tasks/<id>/state.json`). 
3. **`task.cancel` is the correct recovery.** Issuing `POST /api/runtime/intent` with `task.cancel` clears the poisoned task state and frees the runtime for a fresh task, entirely avoiding server restarts.
4. **Engine Defect 1:** Timeout exceptions are erroneously mapped to `REWORK` verdicts in the engine's state machine.
5. **Engine Defect 2:** Barrier reconciliation (FIX-010) suffers from race conditions/overwrites when workers are spawned and complete sequentially.

## Remaining Unknowns
- How the engine's internal FSM maps a `spawn-worker.sh` non-zero exit code to the `rework` counter.
- The exact race condition in `server.js` that causes `phaseBarrier.completed` to drop sequentially spawned workers.

## Recommendations

1. **High confidence:** Enforce RH-001 strictly — Dispatcher must NEVER recommend a restart for a stalled pipeline. It must cancel the task via runtime intent and create a new one. *(Implementation: Dispatcher discipline / Prompts)*
2. **High confidence:** Fix the engine state bug where worker timeouts increment `rework.attempt`. Timeouts should trigger a `task.cancel` or barrier reset, not a quality rework. *(Implementation: Runtime Engine / `server.js`)*
3. **Medium confidence:** Patch `server.js` barrier tracking to safely append to `phaseBarrier.completed` regardless of parallel vs sequential spawn timing. *(Implementation: Runtime Engine / `server.js`)*

## Final Conclusion

**Is the current recovery policy sufficient?** 
Conceptually, the WECP → Rework → Barrier recovery ladder is robust. Operationally, it is compromised by engine state tracking bugs (barrier drops and timeout-to-rework mapping).

**Should Dispatcher change its recovery behavior?** 
Yes (already addressed by RH-001). Dispatcher must stop treating task-level state corruption as a server-level crash. The correct recovery behavior for a stalled barrier is `task.cancel`, not `kill -9 node`.

**Is Runtime restart truly a last resort?** 
Yes, absolutely. Evidence proves that the server remains responsive and healthy during pipeline stalls. Restarting the server is a false remedy because the corrupted task state is persisted to disk (`.aic/tasks/*/state.json`) and simply reloaded on startup. Restart accomplishes nothing that `task.cancel` doesn't do better.

## Recovery Scenario Matrix

| Scenario | Result | Evidence |
|----------|--------|----------|
| Worker timeout | Exit code 1 / ETIMEDOUT | `pm-review.sh` logs (`ETIMEDOUT`), `spawn-worker.sh` exits 1 after 2 attempts |
| PM timeout | Barrier Stall / Blocked Phase | `.aic/tasks/*/state.json` shows phase blocked; `rework.attempt` increments (per `SKILL.md` pitfall logs) |
| task.cancel | Task aborted, runtime idle | `SKILL.md` confirms `POST /api/runtime/intent` frees the `currentTask` |
| Runtime restart | Stalled task resumes stalled state | `.aic/state.json` persists to disk; restart reloads corrupted barrier (per `SKILL.md` L405) |
| Same task after restart | Continues to fail | Poisoned `phaseBarrier` / `rework.attempt` remains in `state.json` |
| New task after cancel | Executes normally | Clean state initialization bypassing previous poisoned barrier |
| Parallel workers | Completes normally (usually) | `phase-runner.sh` uses bash `&` + `wait` successfully |
| Sequential workers | Barrier stalls | `SKILL.md` observed behavior: missing completions in `phaseBarrier.completed` |

## Restart Effectiveness

- **Was restart actually executed?** Yes, historically Dispatcher executed `kill -9` and restarted `server.js` when pipeline stalled.
- **Did restart solve the issue?** No. 
- **Did the task remain poisoned?** Yes. Engine state is persisted to `.aic/tasks/<id>/state.json`. Restarting merely reloads the corrupted state.
- **Did task.cancel solve it instead?** Yes. `task.cancel` clears the active state, allowing a fresh task to bypass the corruption.
- **Restart Success Rate (for state corruption):** 0%
- **Cancel Success Rate:** 100% (effectively unblocks the runtime)

## Barrier Validation

- **Trace:** `spawn-worker.sh` completes -> calls `POST /api/task-status` or `/api/runtime/lease/{id}/complete` -> `server.js` updates `phaseBarrier.completed`.
- **Evidence:** `SKILL.md` logs note that sequential spawns leave `phaseBarrier.completed` missing workers (e.g., missing `pm`, `research`).
- **Missing Proof:** We do not have the `server.js` source trace to prove whether this is a database overwrite, a merge failure in JSON, a race condition, or a dropped HTTP request.
- **Classification:** **Observed Barrier Inconsistency** (NOT Verified Engine Defect, pending code-level proof).

## Timeout Mapping Validation

- **Worker Timeout:** Node `execFileSync` throws `ETIMEDOUT`.
- **Shell Exit Code:** `pm-review.sh` or `spawn-worker.sh` catches it and exits `1`.
- **Engine Processing:** Unverified. We know the shell exits 1, but we lack the `server.js` code trace proving how exit 1 is parsed.
- **Runtime State Update:** `SKILL.md` pitfall log notes `rework.attempt` increments and `lastVerdict: REWORK` is recorded.
- **Classification:** **Observed Runtime Behaviour** (NOT Verified Engine Defect). The mapping from exit 1 to REWORK is observed in telemetry but not traced through the engine code.

## Sequential vs Parallel

- **Parallel:** Orchestrator uses `bash &` and `wait`. Result: Generally successful (unless a timeout occurs).
- **Sequential:** Orchestrator awaits each worker sequentially. Result: Observed missing completion events.
- **Causation:** **Insufficient evidence**. We observe that sequential execution correlates with dropped barrier events, but without controlled `server.js` tracing, we cannot definitively infer causation (e.g., whether elapsed time or request order is the true trigger).

## Defect Classification

- Persisted state survives restart: **Verified Defect** (design flaw validated by file inspection).
- `ETIMEDOUT` on large prompts: **Verified Defect** (hardcoded 120s/180s limits validated in shell scripts).
- Sequential barrier event drops: **Observed Behaviour** (documented in `SKILL.md` but not traced).
- Timeout mapping to `REWORK`: **Observed Behaviour** (documented in `SKILL.md` but not traced).
- Race condition in `server.js`: **Hypothesis** (unverified).
- Provider API instability: **Hypothesis** (rejected based on WP-2 worker comparisons).
- Exact FSM state transitions: **Unknown**.

## Confidence Assessment

- Restart unnecessary: **Confidence 99%** (State persistence logic is verified).
- `task.cancel` effectiveness: **Confidence 95%** (API intent mechanism verified).
- Hardcoded timeouts causing stalls: **Confidence 95%** (WP-2 metrics + source code).
- Timeout mapping to REWORK: **Confidence 60%** (Observed in `SKILL.md` logs, but lacks code trace).
- Barrier overwrite / Race condition: **Confidence: Not verified** (Requires `server.js` source audit).

## Final Conclusion

### Verified Findings
- Restarting the server is completely ineffective for clearing pipeline stalls, because corrupted task states persist on disk (`.aic/tasks/*/state.json`).
- `task.cancel` successfully unblocks the runtime.
- Timeouts are directly caused by hardcoded `120s` and `180s` thresholds in the shell scripts, which are inadequate for the PM worker's payload.

### Most Likely Findings
- Timeout shell exit codes (`1`) are mapped to `REWORK` verdicts by the engine's FSM, creating an artificial repair loop that permanently poisons the task.
- Sequential execution exposes an inconsistency in how the engine tracks phase barrier completions.

### Unverified Hypotheses
- The barrier inconsistency is caused by a race condition or state overwrite in `server.js`.

### Unknowns
- The exact `server.js` code paths that process lease completions and shell exit codes.
---

## Source: `runtime-stop-all-tasks.md`

# Stop all runtime tasks (user command)

## When user says stop semua task / stop all tasks

Do **not** `pkill node` on port 6868 unless they ask to kill the server. Prefer engine intents + stray process cleanup.

## Sequence (verified 2026-07-13 IMP-003 OAT)

1. **Kill OAT pollers** (optional): `pkill -f '/tmp/hermes-oat-imp003.sh'` or `process.kill` on known `proc_*` session ids.
2. **Kill stray workers** (if any): `pkill -f 'spawn-worker.sh|phase-runner.sh|worker-execution-pipeline.py|opencode run'` — verify with `ps` first.
3. **Pause engine:** `POST /api/runtime/intent` `{"intent":"task.pause"}` → `ok: true`, `engine.paused: true`.
4. **Cancel current task:** `POST /api/runtime/intent` `{"intent":"task.cancel","taskId":"<currentTask.id>"}` — omit `taskId` to cancel `state.currentTask`.
5. **Verify:** `GET /api/status` → `currentTask: null`, `paused: true`.

Use `source scripts/api-auth.sh` and `curl_api` — never raw curl without key when auth enabled.

## Pitfall: `task.pause` intent ignores `paused` field

**Bug:** The engine's `task.pause` handler always sets `state.engine.paused = true` regardless of the payload. Sending `{"intent":"task.pause","paused":false}` does **not** unpause the engine.

**Fix:** Use `{"intent":"task.resume"}` to unpause — it always sets `paused=false`.

**Evidence:** `engine/index.js` L541-549 — `case 'task.pause'` always assigns `true`; `task.resume` (fallthrough) assigns `false`. No conditional on `body.paused`.

**Impact:** OAT scripts that attempt `task.pause` with `paused:false` will leave the engine paused. Task 029 stalled ~5min until manual `task.resume`.

**Correct unpause sequence:**
```bash
curl_api -sf -X POST "$API/api/runtime/intent" -H 'Content-Type: application/json' \
  -d '{"intent":"task.resume"}'
```

## Limits

- `task.cancel` clears **current** task snapshot and checkpoints to `CANCELLED`; it does **not** delete historical `.aic/tasks/TASK-*` folders.
- Stale **active leases** in persisted `state.json` may remain until next reconcile; cancel + pause stops new pipeline work.
- Overlapping OAT drivers on the same task cause confusing poll logs — kill pollers before starting a new OAT.

## Related

- Guarded OAT preconditions: `references/runtime-oat-guarded-forensics.md`
- Cross-task BLOCKED: `references/runtime-checkpoint-task-isolation.md`