# AIC Skill v4.0.0 — Compliance Hardening Report (Final)

## Verdict: **HARDENED**

---

## A. Summary

**13 defects fixed across 3 phases. 131 tests, all green.**

### Phase 1 — Engine Internal (4 fixes)

| ID | Severity | Issue | Fix |
|---|---|---|---|
| COMP-01 | HIGH | Barrier timeout fail-open | Returns `false` on timeout |
| COMP-02 | HIGH | task.retry arbitrary phase injection | Phase validated against PHASE_ORDER |
| COMP-03 | HIGH | PM review auto-passes on empty artifacts | Returns `{ allPass: false, reason: 'no_artifacts' }` |
| COMP-04 | HIGH | Pipeline completes task on phase failure | BLOCKED state with `failedPhase` metadata |

### Phase 2 — Dispatcher & Execution Boundary (6 fixes)

| ID | Severity | Issue | Fix |
|---|---|---|---|
| D-01 | CRITICAL | RBAC runs AFTER route dispatch | Moved RBAC before `handleRuntimeRoutes()` |
| D-02 | HIGH | `/api/reset` accessible to any user | RBAC enforced before routes; requires admin |
| D-03 | HIGH | `/api/runtime-gate` accessible to members | RBAC matrix: `runtime.*` lead+ only |
| D-04 | HIGH | normalizePhase accepts any string | New `validatePhase()` rejects unknown phases |
| D-05 | HIGH | Lease tier not validated | `issueLease()` validates tier against PHASE_PLANS |
| D-06 | MEDIUM | member role could write to runtime/task | RBAC matrix tightened |

### Phase 2b — Subagent Deep Audit (3 fixes)

| ID | Severity | Issue | Fix |
|---|---|---|---|
| D-07 | HIGH | finishLease double-finish (TOCTOU) | Status guard: rejects if `status !== 'active'` |
| D-08 | MEDIUM | Lease ID not validated in URL path | Regex: `lease-[a-f0-9]{16}` |
| D-09 | MEDIUM | SSRF via /api/models | Private/internal address blocklist in fetchUpstreamModelsJson |

---

## B. Residual Findings Triage

### RESIDUAL-01: Enterprise endpoints

**Finding:** `/api/projects`, `/api/permissions/assign`, `/api/resources/quota`, `/api/dispatchers`, `/api/workspaces` — write operations with no input validation.

**Attack path:** POST to these endpoints with arbitrary body fields.

**Required attacker access:** Valid API key with appropriate role.

**Existing auth boundary:** Auth check (line 205) → RBAC check (line 210) → route dispatch (line 245). RBAC runs BEFORE these handlers (confirmed: lines 210 < 245).

**Blast radius:** Low — writes to `.aic/*.json` files only. No code execution, no filesystem escape. `permissions.json` is only read by this server's own RBAC (which uses `auth.json`, not `permissions.json`).

**Can it cross trust boundary:** No. Files written are under `.aic/` dir, not code or config.

**Can it mutate state:** Yes — JSON files in `.aic/`.

**Can it execute code:** No.

**Can it access arbitrary files:** No — all paths are hardcoded under `aicDir`.

**Exploitability:** Requires authenticated API key with lead/admin role.

**Decision: ACCEPT_RISK** — RBAC prevents viewer/member access. Writes are limited to non-code JSON files under `.aic/`. Low blast radius.

### RESIDUAL-02: SSRF via `/api/models`

**Finding:** `POST /api/models` (public route, no auth) accepts user-controlled `baseURL` and makes HTTP request to it.

**Attack path:** `{ "baseURL": "http://169.254.169.254/latest/meta-data" }` or `{ "baseURL": "http://localhost:6868/api/status" }`.

**Required attacker access:** Network access to AIC server (no auth needed — public route).

**Existing auth boundary:** `handlePublicRoutes` runs BEFORE auth/RBAC. This is intentional for dashboard model list display.

**Blast radius:** MEDIUM — can probe internal network services, read cloud metadata.

**Can it cross trust boundary:** YES — can reach localhost, RFC1918, link-local.

**Can it mutate state:** No — only GET request.

**Can it execute code:** No.

**Can it access arbitrary files:** No — HTTP only.

**Decision: FIXED** — Added SSRF blocklist covering: localhost, 127.0.0.1, 0.0.0.0, ::1, 10.*, 192.168.*, 172.16-31.*, 169.254.*, fc00:*, fe80:*. Guard is inside `fetchUpstreamModelsJson()` so it applies regardless of how the function is called.

### RESIDUAL-03: Postmortem path traversal

**Finding:** `GET /api/postmortem/:taskId` — taskId extracted from URL path, used in `path.join()`.

**Attack path:** `GET /api/postmortem/../../etc/passwd`

**Required attacker access:** Authenticated API key.

**Existing auth boundary:** RBAC protects this endpoint (it's a metrics route, dispatched after RBAC check at line 210).

**Blast radius:** NONE — `path.join()` normalizes `..` but the fixed suffix `/reports/postmortem-report.md` prevents reading arbitrary files. Even with `../../etc/passwd` as taskId, the resolved path is `<skillDir>/.aic/tasks/etc/passwd/reports/postmortem-report.md` — contained under the skill directory. The filename is hardcoded (`postmortem-report.md`), not user-controlled.

**Can it cross trust boundary:** No. `path.join()` normalizes traversal and the suffix anchors the path.

**Can it access arbitrary files:** No.

**Decision: NOT_EXPLOITABLE** — path.join normalization + fixed suffix prevents escape. Verified with explicit traversal tests.

### RESIDUAL-04: Direct shell script invocation

**Finding:** `spawn-worker.sh`, `phase-runner.sh`, `pm-review.sh` can be invoked directly from shell, bypassing engine/RBAC.

**Attack path:** `bash scripts/spawn-worker.sh <args>` from a terminal session.

**Required attacker access:** SSH/shell access to the server machine.

**Existing auth boundary:** `spawn-worker.sh` requires `AIC_LEASE_ID` (validates against engine API or pre-set env var). `phase-runner.sh` requires `.env` file and worker arguments. `spawn-sub.sh` has no lease requirement but is only called by spawn-worker.sh.

**Blast radius:** Can invoke opencode CLI with crafted env vars (model selection, task targeting). Cannot `git push`, cannot write to arbitrary paths.

**Can it cross trust boundary:** Only with local shell access (already past all network auth boundaries).

**Can it mutate state:** Yes — can write task artifacts to the tasks directory.

**Can it execute code:** Yes — invokes opencode CLI.

**Can it access arbitrary files:** No — artifacts write to `<tasksDir>/<taskId>/reports/`.

**Decision: ACCEPT_RISK** — This is a local developer CLI, intentionally outside the runtime trust boundary. An attacker with shell access already has full control. The engine's RBAC/FSM enforcement protects the HTTP API layer, which is the intended trust boundary for remote access. No git operations exist in any shell script (verified).

---

## C. Files Changed

| File | Phases | Reason |
|---|---|---|
| `scripts/engine/barrier.js` | 1 | Fail-closed timeout |
| `scripts/engine/intent.js` | 1 | Phase injection guard |
| `scripts/engine/pm-review.js` | 1 | Fail-closed empty artifacts |
| `scripts/engine/pipeline.js` | 1 | Fail-closed phase failure |
| `scripts/engine/fsm.js` | 2 | `validatePhase()` + `PHASES` set |
| `scripts/engine/lease.js` | 2,2b | Phase+tier validation, double-finish guard |
| `scripts/server.js` | 2 | RBAC before route dispatch |
| `scripts/middleware.js` | 2 | RBAC matrix tightened |
| `scripts/routes/runtime-routes.js` | 2b | Lease ID format validation |
| `scripts/routes/public-routes.js` | 2b | SSRF blocklist |
| `tests/compliance-hardening.test.js` | 1 | 31 tests |
| `tests/adversarial-bypass.test.js` | 1 | 13 tests |
| `tests/dispatcher-hardening.test.js` | 2,2b | 34 tests |
| `tests/residual-findings.test.js` | 3 | 14 tests |
| `reports/compliance-hardening-v4.md` | all | This report |

---

## D. Test Evidence

```
$ npx vitest run
Test Files  8 passed (8)
Tests     131 passed (131)
Duration  1.30s
```

| File | Tests | Coverage |
|---|---|---|
| `auth.test.js` | 4 | Credential validation |
| `barrier.test.js` | 10 | Barrier lifecycle, timeout |
| `fsm.test.js` | 19 | Phase ordering, validatePhase |
| `validate-artifact.test.js` | 6 | Artifact validation |
| `compliance-hardening.test.js` | 31 | Phase injection, empty artifacts, pipeline failure |
| `adversarial-bypass.test.js` | 13 | Gap documentation, RBAC, credentials |
| `dispatcher-hardening.test.js` | 34 | RBAC ordering, lease validation, terminal states |
| `residual-findings.test.js` | 14 | SSRF, path traversal, enterprise RBAC, shell invocation |

---

## E. Final Verdicts

**Dispatcher Verdict:** DISPATCHER_HARDENED
**System-Wide Verdict:** HARDENED

### Remaining risks (all LOW/accepted):

| Risk | Severity | Rationale |
|---|---|---|
| spawn-sub.sh no lease | LOW | Only invoked by spawn-worker.sh via engine |
| Event store no integrity | LOW | In-memory only, no persistence |
| No state file checksums | LOW | Single-process, atomic writes |
| Lease no duration limit | LOW | Barrier 600s timeout acts as proxy |
| Enterprise endpoint input validation | LOW | RBAC-gated, writes to .aic/ only |
| Shell scripts invocable directly | LOW | Local CLI, outside runtime trust boundary |
