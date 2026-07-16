# WP-3 Follow-up — task.cancel Root Cause Investigation

## Problem (Observed)

Final Runtime OAT labeled outcome **CANCEL_FAILED** while `currentTask` remained `TASK-20260714-LAND4`, `pipelineState: BLOCKED`, `pm: failed`.

## Execution Trace

| Stage | Input | Output | Success | Evidence |
|-------|--------|--------|---------|----------|
| Dispatcher / OAT script | `POST task.cancel` for `TASK-20260714-LAND4` | Shell branch `CANCEL_FAILED` | FAIL (client) | OAT used `curl -sf` without auth wrapper |
| HTTP Request (raw) | `POST /api/runtime/intent`, JSON body, no `X-API-Key` | HTTP **401**, body `{"error":"Missing API key..."}` | FAIL | Live replay 2026-07-14 |
| HTTP Request (`curl_api`) | Same payload + `X-API-Key` from `.aic/auth.json` | HTTP **200**, `{"ok":true}` | PASS | Live replay after `source scripts/api-auth.sh` |
| `server.js` route | `POST /api/runtime/intent` | `engine.handleIntent(intent, data)` | PASS (when auth OK) | `server.js` L413–418 |
| Auth gate | `/api/*` except public list | `auth.requireAuth` → 401 if missing key | PASS | `server.js` L407–409; `auth.js` L70–84 |
| Intent handler | `intent=task.cancel`, `taskId` | Clears `currentTask`, idle workers, checkpoint `CANCELLED` | PASS | `engine/index.js` L939–953 |
| Runtime state after (authenticated cancel) | N/A | `currentTask: null`, `pm: idle` | PASS | `GET /api/status` after successful cancel |

**Failure location:** **Client / HTTP layer** — request never authenticated; handler not invoked with valid session.

## Validation 1 — API Request

| Check | Result |
|-------|--------|
| Endpoint | `POST http://127.0.0.1:6868/api/runtime/intent` — correct |
| Method | POST — correct |
| Headers | OAT: `Content-Type: application/json` only — **missing `X-API-Key`** |
| Authentication | **Required** for `/api/runtime/intent` (not in `publicApi` list) |
| Payload | `{"intent":"task.cancel","taskId":"TASK-20260714-LAND4"}` — valid shape |
| Response (raw) | **401** + error JSON |
| Response (`curl_api`) | **200** + `{"ok":true}` |

**CANCEL_FAILED origin:** **Client side** (`curl -sf` treats 401 as failure; OAT script did not use `curl_api`).

## Validation 2 — Runtime Route

- Handler: `scripts/server.js` L413–418 → `engine.handleIntent(intent, data)`.
- With 401, route handler is **not reached** (`requireAuth` returns false at L409).

## Validation 3 — Intent Processing (`task.cancel`)

When request is authenticated:

1. `taskId = body.taskId || state.currentTask?.id` — L940
2. Checkpoint `pipelineState = 'CANCELLED'` — L942–944
3. `state.currentTask = null`, workers → `idle` — L946–950
4. Returns `{ ok: true }` — L953

No validation rejects BLOCKED/failed tasks for cancel in this code path.

## Validation 4 — Runtime State (before cancel)

From `.aic/state.json` (snapshot):

- `currentTask.id`: `TASK-20260714-LAND4`
- `pipelineState`: `BLOCKED`, `phaseStatus`: `failed`
- `pm`: `failed`, `leaseId`: `lease-69073b390ec33c34`

These states do **not** block cancel when auth succeeds (verified post-cancel).

## Evidence Matrix

| Stage | PASS | FAIL | Evidence |
|--------|------|------|----------|
| Payload shape | ✓ | | JSON intent + taskId |
| Raw HTTP without key | | ✓ | HTTP 401 |
| `curl_api` with key | ✓ | | HTTP 200, `ok:true` |
| Engine `task.cancel` | ✓ | | `engine/index.js` L939–953 |
| State cleared | ✓ | | `currentTask` null, `pm` idle |
| OAT method (raw curl) | | ✓ | Documented in `runtime-stop-all-tasks.md` L15 |

## Root Cause Classification

**Authentication Issue (client / operator procedure)** — with secondary label **Operator Error** in OAT execution.

Not classified as:

- Verified Runtime Bug (cancel works when authenticated)
- State Corruption (BLOCKED did not prevent cancel)
- Invalid Request payload (payload was valid; auth was missing)

## Verified Root Cause

**`task.cancel` failed in Final OAT because the HTTP call used unauthenticated `curl -sf` against a protected `/api/runtime/intent` endpoint, producing HTTP 401. The OAT labeled this `CANCEL_FAILED` and never invoked the engine cancel path. Authenticated `curl_api` completes cancel and clears runtime ownership.**

## Recommended Fix Scope (after PM approval — procedure/docs/OAT only)

1. **OAT scripts:** Always `source scripts/api-auth.sh` and use `curl_api` for `/api/runtime/intent` (per `references/runtime-stop-all-tasks.md`, `runtime-auth-pattern.md`).
2. **OAT reporting:** Distinguish `HTTP 401` / auth failure from engine `{"ok":false}`.
3. **Optional:** Dispatcher/runbook one-liner: cancel template with `curl_api`.

**Out of scope for this investigation:** Engine code changes (not required for this failure mode).

## Risk Assessment

| Risk | Level | Note |
|------|-------|------|
| False “runtime broken” diagnosis | High if OAT repeats raw curl | Mitigated by auth wrapper |
| Engine cancel regression | Low | Reproduced PASS with key |
| Stale lease after cancel | Low | Docs note reconcile; cancel cleared snapshot in test |

## Confidence

| Conclusion | Confidence |
|------------|------------|
| Failure at client auth, not cancel logic | **99%** |
| Engine cancel clears `currentTask` when called correctly | **99%** |
| BLOCKED state was reason for reject | **0%** (rejected by replay) |

---

*Investigation only. No code changes. Await PM approval before any implementation.*