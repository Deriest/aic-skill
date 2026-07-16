# Eip Consolidated

> **Consolidated from 3 files.** Originals archived in `references/archive/`.

**Original files merged:**
- `eip-investigation-findings.md`
- `eip1-reliability-audit-2026-07-16.md`
- `eip2-architecture-audit-2026-07-16.md`

---

---

## Source: `eip-investigation-findings.md`

# EIP Investigation Findings — Performance & Excellence Audit

**Date:** 2026-07-16  
**Scope:** EIP-3 (Performance) + EIP-4 (Excellence) read-only investigation  
**Method:** Systematic file-by-file review of all 57 scripts, engine modules, docs, and runtime state

## EIP-3: Performance Findings

### PERF-01: Excessive Python3 Subprocess Spawn in spawn-worker.sh
**Severity:** High  
**Location:** `scripts/spawn-worker.sh:66,73,87-88,133-134,138,168,170,225,248`  
A single worker spawn invokes `python3 -c` 6-8 times for trivial JSON parsing (taskId, leaseId, token counts, completion payload). ~400ms overhead per worker. `jq` is available but never used. WECP pipeline is Python and could handle all JSON natively.

### PERF-02: cache-context.sh Built But Never Called
**Severity:** High  
**Location:** `scripts/spawn-worker.sh:47` calls `context-gather.sh` directly; `scripts/cache-context.sh` is dead code  
Caching layer with git-HEAD invalidation and LRU eviction exists but is never used in any production path. Every worker spawn does a fresh `find . -maxdepth 3` against the project directory. For parallel 3-worker phases, this runs 3x redundantly.

### PERF-03: context-gather.sh Produces Minimal Value
**Severity:** Medium  
**Location:** `scripts/context-gather.sh:12-18`  
`find . -maxdepth 3 | head -n 50` with `--tier` argument accepted but ignored. Comment says "No artificial limits" but limits to 50 files and 3 depth. Output is a comma-separated string, not structured context. Wasted I/O for near-zero value.

### PERF-04: phase-runner.sh Spawns 6+ Python Subprocesses Per Worker
**Severity:** High  
**Location:** `scripts/phase-runner.sh:62,98,100,101,117,122,127,155`  
For each worker in a phase: 6-7 `python3 -c` / `python3 script.py` invocations for prompt assembly (task scope, trivial classification, contract loading, research/implementation blocks). For a 3-worker phase: 18-21 Python subprocess spawns adding ~1-1.5s before workers start. Should be a single Python orchestrator.

### PERF-05: Metrics Read-Full-Array-Write-Full-Array Pattern
**Severity:** Medium  
**Location:** `scripts/server.js:836-845`, `scripts/metrics.sh:15-25`  
Both server and CLI read entire `metrics.json` array, append one entry, write entire array back. O(n) per metric record. No file locking — race condition risk under concurrent worker metric reporting.

### PERF-06: API Key Re-read on Every curl_api Call
**Severity:** Medium  
**Location:** `scripts/api-auth.sh:10-19,23-24`  
`_aic_get_api_key()` reads and parses `.aic/auth.json` with Python3 on every `curl_api` call. In spawn-worker.sh, `curl_api` is called 4x — 4 Python invocations for the same key. Should be read once at source time and exported.

### PERF-07: Strict Phase Serialization (No Cross-Phase Parallelism)
**Severity:** Low  
**Location:** `scripts/engine/index.js:407-455`, `scripts/engine/fsm.js`  
Phases are strictly serial (barrier pattern, by design). No early-start optimization. Architecturally correct but a throughput limiter.

### PERF-08: Prompt Bloat — 10+ Context Blocks Per Worker
**Severity:** Medium  
**Location:** `scripts/phase-runner.sh:192-209`  
Each worker prompt can contain: PLANNING_AUTHORITY_BLOCK, CANONICAL_SPEC_BLOCK (entire spec file), PM_REPAIR_BLOCK, CLOSEOUT_CONTEXT_BLOCK, TASK_SCOPE, TRIVIAL_TASK_BLOCK, IMPLEMENTATION_TRIVIAL_BLOCK, RESEARCH_PLANNING_BLOCK, IMPLEMENTATION_SKELETON_BLOCK, CONTRACT_BLOCK, COMPLETION_BLOCK. Combined prompt can exceed 10K tokens before task instruction. Metrics confirm PM input tokens range 325-12,427.

### PERF-09: Knowledge Subsystem — Linear Scan, No Full-Text Search, Index Unused
**Severity:** Medium  
**Location:** `scripts/knowledge-search.sh:17-44`, `scripts/knowledge-index.sh:14-64`  
- `knowledge-search.sh` does O(n) substring match on registry, no inverted index.
- `knowledge-index.sh` builds a type/tag/worker/status index, but `knowledge-search.sh` never uses it — reads registry directly.
- `knowledge-memory.sh:36` writes entire store.json on every `retrieve` call (to increment access_count). Read-modify-write on every access.
- All 8 knowledge scripts use `python3 << PYEOF` with shell variables interpolated into Python source — injection risk.

### PERF-10: Dashboard Cache-Control: no-store on Static Assets
**Severity:** Low  
**Location:** `scripts/server.js:351,987`  
Static assets with hashed filenames (e.g., `vendor-DgfdK1uK.js`) served with `no-store`. Browser re-downloads vendor JS on every page load. Could safely cache for a year.

### PERF-11: health-check.sh Spawns Full opencode Session for Permission Check
**Severity:** Medium  
**Location:** `scripts/health-check.sh:31-43`  
`check_permission()` runs `opencode run "cat $cf" --auto --format json` — spawns a full AI session (5-30s) for a permission health check that should be sub-second.

## EIP-4: Excellence Findings

### EXC-01: self-test.sh Tests Existence, Not Behavior — Zero Functional Tests
**Severity:** Critical  
**Location:** `scripts/self-test.sh:1-111`  
Entire test suite checks file existence, binary availability, syntax validity, server health, env var presence. No unit tests for any Python script, auth.js, engine FSM, barrier logic, PM review parsing, API endpoints, knowledge CRUD, artifact validation, or the spawn-worker → WECP → validate → PM review chain. No regression tests for 20+ FIX/IMP items. `archive/ops/stress-test.sh` exists but is archived and only tests concurrent task submission.

### EXC-02: No Benchmarking — Zero Performance Baselines
**Severity:** Critical  
**Evidence:** Search for benchmark/profil/timing in `scripts/` returns 0 results. `durationSec` in metrics.json is always 0 (all 27 entries). No timing measurements for worker spawn, phase transitions, or API response. No profiling tools. EIP exit criteria EC-3.1 has no existing data.

### EXC-03: Version Mismatch Across Files
**Severity:** High  
**Evidence:**
- `SKILL.md:4`: `version: 3.3.0`
- `scripts/server.js:431`: `{ version: '3.1.3', milestone: 'J' }`
- `README.md:241`: "AIC version: v3.1.3"
- `CHANGELOG.md`: Latest entry is `[3.2.0]` — no 3.3.0 entry

### EXC-04: SKILL.md is 606 Lines — Decision Tree Unmaintainable
**Severity:** High  
**Location:** `SKILL.md:59-300+`  
~250 lines of `IF ... → load references/...` rules. Duplicated sections (e.g., "Discovery & Phase Review" appears twice at lines 174 and 178). 63KB file loaded into context on every `/aic` activation. No prioritization — all rules flat.

### EXC-05: Documentation Staleness
**Severity:** Medium  
- `docs/INDEX.md:5`: "27 endpoints" vs `README.md:229`: "21 endpoints"
- `docs/INDEX.md:12`: References `.env.example` at root, actual file at `templates/.env.example`
- `SKILL.md:81`: References `references/opencode-limit-object-pitfall.md` — not in file listing
- `CHANGELOG.md`: No v3.3.0 entry

### EXC-06: Observability — Missing Critical Metrics
**Severity:** High  
**Location:** `scripts/server.js:824-833`, `scripts/engine/observability.js:237-242`  
Tracked: token counts, API latency (p50/p95/p99), error rate, memory/CPU, worker status, phase state, events.
NOT tracked: `durationSec` (always 0), phase transition latency, PM review duration, WECP repair loop metrics (repair count, success rate), cache hit rate for context, token cost per phase, failure rate by worker type, retry counts, queue depth/wait time. `cacheRead`/`cacheWrite` token fields always 0 in metrics.json.

### EXC-07: Security — API Key Plaintext, Timing-Unsafe Comparison, RBAC Fail-Open, /api/config Exposes .env
**Severity:** High  
**Location:** `scripts/auth.js:5,16-22,64-66`, `scripts/api-auth.sh:10-13`, `scripts/server.js:470-471,534-543,937`  
1. API keys stored as plaintext JSON in `.aic/auth.json`.
2. Key comparison via `===` (non-constant-time) — timing attack vulnerable.
3. `server.js:937`: RBAC check `catch(rbacErr) { /* allow request to proceed */ }` — fail-open security policy.
4. `/api/config` is public (no auth) and returns full `.env` contents including `API_KEY`, `MODEL_THINKER`, etc. in plaintext.

### EXC-08: detect-context.sh Sends Literal "***" as Bearer Token
**Severity:** Medium  
**Location:** `scripts/detect-context.sh:44,82`  
Lines 44 and 82: `-H "Authorization: Bearer ***"`. The literal string `***` is sent as the bearer token. The `api_key` parameter is accepted by the function but never used. API context window detection always fails (unauthorized), silently falling back to hardcoded table or 256K default. Feature is broken but degrades silently.

### EXC-09: security-pat-injection-pitfall.md Documents a Bypass, Not a Fix
**Severity:** Medium  
**Location:** `references/security-pat-injection-pitfall.md:18-22`  
Document explains how to use `python3 -c` to write GitHub PATs to `~/.git-credentials` to bypass Hermes smart approval blocks. Documents a security bypass as "safe workaround" rather than addressing why PATs need shell injection. No proper solution proposed (git credential helpers, env vars, secret management).

### EXC-10: Shell Variable Interpolation into Python Code (Injection Risk)
**Severity:** High  
**Location:** All 8 knowledge-*.sh scripts  
Every knowledge script uses `python3 << PYEOF` with shell variables interpolated directly into Python source:
```python
query = '$QUERY'.lower()  # breaks if QUERY contains single quote
```
If `$QUERY` contains `'; os.system('rm -rf /'); '` — arbitrary code execution. All 8 scripts have this pattern. Critical injection vulnerability at the shell→Python trust boundary.

### EXC-11: No CI/CD Pipeline
**Severity:** High  
No `.github/workflows/`, no `Makefile` with test targets, no pre-commit hooks. Only quality gate is `self-test.sh` (existence checks). No automated linting, dependency scanning, or secret scanning.

### EXC-12: No Coding Standards Document
**Severity:** Medium  
No `CONTRIBUTING.md`, no `STYLE.md`, no linter configs (`.eslintrc`, `.pylintrc`, `.shellcheckrc`). 57 scripts across 3 languages with inconsistent patterns.

### EXC-13: __pycache__ Present in Repository
**Severity:** Low  
`scripts/__pycache__/phase-contract-loader.cpython-312.pyc` exists in working tree. `.gitignore` should prevent this.

### EXC-14: node_modules Present in Working Tree
**Severity:** Medium  
`dashboard/node_modules/` with hundreds of packages present. Bloats working directory significantly. Should be installed fresh, not committed.

### EXC-15: monitor.sh watch Loop Spawns 4 Subprocesses Per Iteration
**Severity:** Low  
**Location:** `scripts/monitor.sh:52-56`  
`watch` action runs `monitor.sh dashboard` in a loop, spawning `health-check.sh`, `metrics.sh`, `logger.sh`, and `curl` — each spawning Python. At 5s intervals, continuous cold-start overhead. Should be a single persistent script.

## Summary by Priority

| Priority | IDs | Count |
|----------|-----|-------|
| Critical | EXC-01, EXC-02 | 2 |
| High | PERF-01, PERF-02, PERF-04, EXC-03, EXC-04, EXC-06, EXC-07, EXC-10, EXC-11 | 9 |
| Medium | PERF-03, PERF-05, PERF-06, PERF-08, PERF-09, PERF-11, EXC-05, EXC-08, EXC-09, EXC-12, EXC-14 | 11 |
| Low | PERF-07, PERF-10, EXC-13, EXC-15 | 4 |

## Key Observations

1. **Biggest perf win:** Eliminate Python subprocess spawns. spawn-worker.sh + phase-runner.sh spawn 24-30 Python interpreters per 3-worker phase (~2-3s overhead). A single Python orchestrator would eliminate this.
2. **Context caching is dead code.** cache-context.sh was written but never wired up. Connecting it eliminates redundant `find` calls.
3. **Test situation is critical.** Zero functional tests. Any change to 57 scripts has no regression safety net.
4. **Security has real gaps.** `/api/config` exposes `.env` with API keys without auth. RBAC fails open. All knowledge scripts have shell→Python injection vulnerabilities. `durationSec` always 0 means no time tracking.
5. **Version drift indicates release process gaps.** SKILL.md=3.3.0, server.js=3.1.3, README=3.1.3, CHANGELOG has no 3.3.0 entry.

---

## Source: `eip1-reliability-audit-2026-07-16.md`

# EIP-1 Reliability Audit — scripts/ Directory (2026-07-16)

Full audit of 50 scripts (JS, SH, PY) for engineering reliability issues.
22 findings across 10 dimensions.

## Summary by Severity

| Severity | Count | Finding IDs |
|----------|-------|-------------|
| Critical | 2 | F1, F2 |
| High | 8 | F3, F5, F6, F10, F11, F16, F17, F18 |
| Medium | 8 | F4, F7, F8, F9, F12, F13, F15, F22 |
| Low | 4 | F14, F19, F20, F21 |

---

## F1 — api-auth.sh Broken String Literal (Critical)

**File:** `scripts/api-auth.sh:29`

Line 29: `auth_flag="X-API-Key: ***` — the closing `"` is missing. Bash consumes the rest of the function body as the string value. Every call to `curl_api` with an API key sends a malformed header containing script source code.

**Impact:** All authenticated API calls from shell scripts fail silently or send corrupted auth headers. The `|| true` pattern at call sites masks this.

**Fix:** Close the string: `auth_flag="X-API-Key: $key"`

---

## F2 — Non-Atomic State File Writes (Critical)

**Files:** `server.js:291` (saveState), `engine/persistence.js:25` (writeCheckpoint), `engine/index.js:638` (triggerKnowledgeAsync), all queue.sh/metrics.sh/health-check.sh Python heredocs.

All state files written via direct `fs.writeFileSync` / `json.dump` without write-to-temp + rename. Server process and shell scripts write concurrently.

**Impact:** Process crash mid-write corrupts state files. `state.json` corruption loses all runtime state (active task, workers, leases).

**Fix:** Write to temp file, then `fs.renameSync` (atomic on same filesystem).

---

## F3 — FSM canAdvance Logic Bug (High)

**File:** `scripts/engine/fsm.js:44`

`return n != null && n !== 'COMPLETE' || (from === 'CLOSEOUT' && pmPass);`

JS precedence: `(n != null && n !== 'COMPLETE') || (from === 'CLOSEOUT' && pmPass)`. The CLOSEOUT branch leaks into all states. `canAdvance('INVESTIGATE', true, true)` returns true.

**Impact:** Latent — no current caller, but landmine for future use.

**Fix:** Add parens: `return (n != null && n !== 'COMPLETE') || (from === 'CLOSEOUT' && pmPass && n === 'COMPLETE');` — or better, delete if unused.

---

## F4 — BLOCKED Not in PHASE_ORDER (Medium)

**File:** `scripts/engine/fsm.js:3-11`

`BLOCKED` is terminal but not in `PHASE_ORDER`. Engine sets it directly (`cp.pipelineState = 'BLOCKED'`) rather than through an FSM transition function. No guard prevents invalid direct state mutations.

**Impact:** No FSM constraint on error-state transitions. Cannot audit or constrain transitions.

---

## F5 — Lease Completion Call Suppressed (High)

**File:** `scripts/spawn-worker.sh:249-251`

`curl_api ... > /dev/null 2>&1 || true` — lease completion silently lost if server is down. Engine's `finishLease` (which validates artifacts and marks barriers complete) is never called.

**Impact:** Workers succeed but pipeline stalls — barrier never records completion, causing indefinite `barrier_wait` hang.

---

## F6 — pm-repair-respawn.js Exits on First Delete Failure (High)

**File:** `scripts/pm-repair-respawn.js:13-14`

`process.exit(1)` on first file deletion failure. Caller continues with `spawnWorkersForPhase`, but old artifacts may still exist, causing barrier reconciliation to find stale "complete" artifacts.

**Impact:** PM repair loop respawns workers but old artifacts cause false barrier satisfaction — phase passes without actual repair.

---

## F7 — recovery.sh Recursive Self-Invocation (Medium)

**File:** `scripts/recovery.sh:54`

`bash "$0" restore "$LATEST"` — no recursion guard. If backup is corrupted, restore copies bad state, health check reports unhealthy again, potentially looping.

**Impact:** Infinite recovery loop if backup is corrupted.

---

## F8 — recovery.sh Doesn't Restart Server (Medium)

**File:** `scripts/recovery.sh:44-66`

Restores files but never restarts `server.js`. If server process holds corrupted in-memory state, file restore has no effect.

**Impact:** Recovery appears to succeed but system remains broken.

---

## F9 — engine/recovery.js Incomplete Phase Status Coverage (Medium)

**File:** `scripts/engine/recovery.js:24`

Only handles `running`/`spawning`. Missing: `barrier_wait`, `pm_repair`, `failed`. Tasks in these states after crash are not recovered.

**Impact:** Tasks stuck in `barrier_wait` or `pm_repair` after crash are permanently stalled.

---

## F10 — task.resume Doesn't Reset Phase Status (High)

**File:** `scripts/engine/index.js:859-877`

`task.resume` unsets paused but doesn't reset `cp.phaseStatus`. `runPipeline` iterates from `INVESTIGATE` regardless of `cp.pipelineState`.

**Impact:** Resume doesn't actually resume — it restarts from the beginning, wasting work.

---

## F11 — task.cancel Doesn't Stop Running Pipeline (High)

**File:** `scripts/engine/index.js:878-893`

`task.cancel` sets `CANCELLED` in checkpoint and clears `state.currentTask` but doesn't set `pipelineRunning = false`. The running pipeline never checks for cancellation.

**Impact:** Cancelled tasks continue executing, wasting resources and overwriting artifacts.

---

## F12 — pipelineRunning Flag Race (Medium)

**File:** `scripts/engine/index.js:802, 839`

Between check (`if (pipelineRunning)`) and set (`pipelineRunning = true`), there are synchronous but non-trivial operations. Two concurrent `task.start` requests in the same event loop tick could both pass.

**Impact:** Two concurrent pipelines on the same state files.

---

## F13 — validate-framework-invariants.sh No Argument Validation (Medium)

**File:** `scripts/validate-framework-invariants.sh:7-8`

Uses `$1` and `$2` without `${1:?}` validation. Empty arguments → empty array → for loop doesn't iterate → exits 0 (pass).

**Impact:** Missing arguments cause validation to pass vacuously, allowing invalid artifacts through the mechanical validation gate.

---

## F14 — pm-review.sh Exit Code 4 Undocumented (Low)

**File:** `scripts/pm-review.sh:17`

Exit 4 (no artifacts) is undocumented and treated identically to exit 1 (REWORK) by the engine. No logging distinguishes "no artifacts" from "artifacts need rework".

---

## F15 — health-check.sh HEALTH_FILE Not Exported (Medium)

**File:** `scripts/health-check.sh:7, 57, 60`

`HEALTH_FILE` is a bash variable but not in the `export` list at line 57. Python heredoc falls back to relative path `.aic/health.json`.

**Impact:** Health data written to wrong path when run from non-skill directory.

---

## F16 — queue.sh Non-Atomic Read-Modify-Write (High)

**File:** `scripts/queue.sh:15-27, 30-44, 69-93` and `server.js` `/api/queue/enqueue`

Both shell and API read-modify-write `queue.json` without file locking. Concurrent operations overwrite each other's changes.

**Impact:** Concurrent queue operations silently lose entries.

---

## F17 — knowledge-memory.sh Shell Variable Injection (High)

**File:** `scripts/knowledge-memory.sh:23, 37, 59`

`$KEY` and `$VALUE` interpolated directly into Python heredoc. Crafted input containing Python syntax becomes arbitrary code execution. Same pattern in `knowledge-search.sh` and `knowledge-reuse.sh`.

**Impact:** Arbitrary code execution via crafted input to knowledge management scripts.

---

## F18 — server.js RBAC Fail-Open (High)

**File:** `scripts/server.js:937`

`} catch(rbacErr) { /* RBAC check failed, allow request to proceed */ }`

If RBAC check throws, the catch block silently allows the request with no authorization.

**Impact:** Any error in RBAC checking makes all protected endpoints accessible without authorization.

---

## F19 — auth.js Reads Credentials From File on Every Request (Low)

**File:** `scripts/auth.js:16-22, 64`

`loadCredentials()` does `fs.readFileSync` on every API request. No caching. Potential JSON parse failure if `auth.json` is being written concurrently.

---

## F20 — auth.json Has No Token Expiry (Low)

**File:** `scripts/auth.js:29-40, 51-67`

API keys have `createdAt` but no `expiresAt`. No refresh, no rotation, no revocation list.

---

## F21 — server.js Graceful Shutdown Double Save (Low)

**File:** `scripts/server.js:1001-1018`

First save preserves worker state. Second save (lines 1006-1011) resets workers to idle, overwriting the first. On restart, recovery.js finds no `working` workers to reconcile.

---

## F22 — phase-runner.sh Barrier Timeout Never Enforced (Medium)

**File:** `scripts/phase-runner.sh:211`, `scripts/engine/barrier.js:11`

Barrier has `timeout: 600000` (10 min) but `barrierSatisfied()` never checks it. Failed lease acquisition causes a 10-minute hang before the phase fails.

---

## Exit Code Semantics Summary

| Script | 0 | 1 | 2 | 3 | 4 |
|--------|---|---|---|---|---|
| pm-review.sh | PASS | REWORK | BLOCKED | — | No artifacts (undocumented) |
| phase-runner.sh | All passed | Worker(s) failed | Invalid format | — | — |
| spawn-worker.sh | Success | Failure | — | — | — |
| validate-framework-invariants.sh | Valid | Invalid | — | — | — |
| worker-validation.sh | PASS | FAIL | — | — | — |
| worker-execution-pipeline.py | Validated | Failed | Usage error | — | — |
| validate-phase-artifact.py | Valid | Invalid | Usage error | — | — |
| recovery.sh | Success | Failure | — | — | — |
| pm-repair-respawn.js | — | Delete failed | Usage error | — | — |
| preflight.sh | Ready | Blocker count | — | — | — |

**Inconsistencies:**
- Exit 2 = "usage error" in Python scripts, "BLOCKED" in pm-review.sh, "invalid format" in phase-runner.sh
- Exit 4 unique to pm-review.sh, undocumented
- Exit 3 (formerly UNKNOWN, eliminated by FIX-004) was replaced by exit 4 without documentation
- preflight.sh uses exit code as failure count (1-5 possible), not boolean

## Key Patterns

1. **Silent failure swallowing** (`|| true`) at 15+ call sites masks API, lease, and validation failures
2. **Non-atomic file writes** affect all 8+ JSON state files — no write-then-rename anywhere
3. **No file locking** on shared state files — concurrent access from server.js and shell scripts unprotected
4. **FSM bypass** — engine directly mutates `cp.pipelineState` instead of going through FSM transition functions
5. **Shell variable injection** into Python heredocs pervasive in knowledge scripts
6. **Exit codes inconsistent** — same code means different things across scripts; engine treats unknown codes as REWORK

---

## Source: `eip2-architecture-audit-2026-07-16.md`

# EIP-2 Architecture Audit — Module Boundaries & Dependency Graph (2026-07-16)

**Scope:** Module boundaries, dependency graph, configuration management, code duplication, script responsibilities, internal contracts, reference document organization.
**Method:** Read-only investigation of all 57 scripts, config files, references, templates, dashboard source, and archive.
**Distinct from:** EIP-1 (reliability/bugs), EIP-3 (performance), EIP-4 (excellence).

## Summary

| Severity | Count |
|----------|-------|
| Critical | 4 |
| High | 9 |
| Medium | 11 |
| Low | 7 |
| **Total** | **31** |

---

## 1. Module Boundaries — Script Responsibilities

### ARCH-001 | Critical | server.js is a 1038-line God Object
**Location:** `scripts/server.js:1-1038`
40+ inline routes, RBAC, rate limiting, static serving, state management, metrics, cost calc, latency SLI, audit logging, .env parsing, CORS — all in one file. RBAC matrix at line 907 is after most routes already matched, making it unreachable for most endpoints.

### ARCH-002 | High | engine/index.js mixes orchestration, persistence, and API contract logic
**Location:** `scripts/engine/index.js:1-959`
Pipeline state machine, PM review loop, barrier reconciliation, worker spawning, lease management, artifact validation, task context reading, dashboard snapshot building, intent handling. `readTaskContext` duplicated here (line 923) — identical to server.js (line 139).

### ARCH-003 | High | spawn-worker.sh has 5+ responsibilities in one script
**Location:** `scripts/spawn-worker.sh:1-259`
Env loading, lease acquisition, WECP delegation, legacy opencode invocation with inline Node.js runner generation, artifact extraction with Strategy B continue fallback, FIX-019 planning post-gen gate, metrics posting, lease completion. ~150 lines of inline logic in the legacy path alone.

### ARCH-004 | Medium | phase-runner.sh embeds prompt engineering in bash heredocs
**Location:** `scripts/phase-runner.sh:56-209`
Constructs worker prompts using inline Python heredocs for Planning Authority, Research Planning, Implementation Skeleton, and Closeout Context blocks. Prompt engineering decisions embedded in bash.

### ARCH-005 | Low | setup.sh hardcodes paths and has stale worker count
**Location:** `scripts/setup.sh:22,38`
Hardcodes `SKILL_DIR` rather than deriving from script location. Says "10-Worker" when system has 15.

---

## 2. Dependency Graph — Circular Dependencies and Tight Coupling

### ARCH-006 | Critical | server.js ↔ engine/index.js circular state coupling
**Location:** `scripts/server.js:242-260`, `scripts/engine/index.js:68-78`
server.js passes `getState: () => state` and `setState` callbacks to engine. Engine mutates shared state directly (e.g., `state.workers[w].status = 'failed'`). Both can mutate the same state object with no synchronization. Engine calls `saveState()` which is server.js's function — bidirectional dependency.

### ARCH-007 | High | Three parallel endpoint handlers with inconsistent interfaces
**Location:** `scripts/ops-endpoints.js:51`, `scripts/enterprise-endpoints.js:12`, `scripts/observability-handler.js:14`
Three separate handler files with different signatures:
- `handleOpsEndpoint(req, res, send, readBody, state)`
- `handleEnterpriseEndpoint(req, res, send, readBody, state)`
- `handleObservability(req, res, pathname, send)` — missing `readBody` and `state`

### ARCH-008 | High | Engine spawns scripts that HTTP back into engine's own API
**Location:** `scripts/engine/index.js:179-189` → `scripts/spawn-worker.sh:70-73,249`
Engine → phase-runner.sh → spawn-worker.sh → HTTP API (lease issue/complete) → engine.issueLease/finishLease. Circular runtime dependency via HTTP.

### ARCH-009 | Medium | PHASE_PLANS (fsm.js) and PHASE_ALLOWED (server.js) duplicate the same concept
**Location:** `scripts/engine/fsm.js:15-28`, `scripts/server.js:670-676`
fsm.js defines which workers participate in each phase. server.js independently defines which workers are *allowed*. Can drift. If a worker is in PHASE_PLANS but not PHASE_ALLOWED, server rejects spawns the engine would have approved.

---

## 3. Configuration Management

### ARCH-011 | Critical | Configuration scattered across 6+ locations, no single source of truth
- `.env` — parsed 7 different ways across 3 languages (JS manual, bash source, Python manual, grep)
- Two different `.env.example` files (root vs templates/) with different content
- `.aic/auth.json`, `.aic/state.json`, `.aic/metrics.json`, `.aic/latency_metrics.json`, `.aic/health.json`
- `.aic/tasks/*/context.json`, `engine.json`, `state.json` (3 files per task)
- `requirements.json` in two locations with different schemas
- SKILL.md references `.aic/config.json` which does not exist

### ARCH-012 | High | Version mismatch: SKILL.md 3.3.0, server.js hardcodes 3.1.3
**Location:** `SKILL.md:4`, `scripts/server.js:431`
`/api/version` returns hardcoded `'3.1.3'`, 2 minor versions behind actual skill version.

### ARCH-013 | High | Two `.env.example` files with different content
**Location:** `.env.example` (root, 16 lines) vs `templates/.env.example` (45 lines with presets)

### ARCH-014 | Medium | Two `requirements.json` with different schemas, both stale
**Location:** `requirements.json` (root), `dashboard/requirements.json`

### ARCH-015 | Medium | Worker count mismatch: setup.sh says 10, system has 15
**Location:** `scripts/setup.sh:38`, `scripts/server.js:219-223`, `SKILL.md:3`

---

## 4. Code Duplication

### ARCH-021 | High | percentile() and buildLatencySli() duplicated in server.js and ops-endpoints.js
**Location:** `scripts/server.js:68-117`, `scripts/ops-endpoints.js:8-46`
Near-verbatim duplicate. Constants `SLO_API_P99_MS = 250` and `ERROR_BUDGET_PCT = 1` also duplicated.

### ARCH-022 | High | readTaskContext() duplicated in server.js and engine/index.js
**Location:** `scripts/server.js:139-146`, `scripts/engine/index.js:923-931`

### ARCH-023 | High | Node.js opencode runner pattern duplicated 4 times
**Location:** `scripts/spawn-worker.sh:105-122` (NODESCRIPT), `scripts/spawn-worker.sh:176-194` (CONTJS), `scripts/pm-review.sh:151-181` (NODESCRIPT), `scripts/worker-execution-pipeline.py:116-135` (_write_node_runner)

### ARCH-024 | Medium | SCRIPT_DIR/SKILL_DIR derivation in 20+ bash scripts
Every `.sh` file begins with the same 2-line pattern. `api-auth.sh` uses `BASH_SOURCE[0]` (more correct for sourced scripts) — inconsistent.

### ARCH-025 | Medium | `.env` loading duplicated in 7 locations with different implementations
7 different implementations of "read .env" across 3 languages. Bash versions `source` the file (executing it as shell); JS and Python parse as text.

### ARCH-026 | Low | validate-framework-invariants.sh and .py are parallel implementations
**Location:** `scripts/validate-framework-invariants.sh` (76 lines), `scripts/validate-framework-invariants.py` (59 lines)

---

## 5. Reference Document Organization

### ARCH-016 | High | 155 reference files, 23 orphaned (not referenced in SKILL.md)
docs/INDEX.md claims "105 files" but actual count is 155 — 47% discrepancy.

### ARCH-017 | High | Reference clusters with heavy overlap
- 32 `runtime-*` files (many are fix-by-fix logs, should be consolidated)
- 16 `dashboard-*` files (4 about config issues alone)
- 3 `server-modification-pitfalls*` files split across milestones

### ARCH-018 | Medium | SKILL.md has 3 duplicated section headers
"### Discovery & Phase Review" (lines 174, 178), "### Work Package Structure" (lines 363, 378), "### Parallel Scheduler Pattern" (lines 367, 382) — all verbatim duplicates.

### ARCH-019 | Medium | SKILL.md is 606 lines — exceeds practical routing capacity
130+ conditional routing rules, 30+ user preferences, 20+ architectural decisions, 10+ workflow patterns. Many pitfalls are multi-paragraph narratives that belong in reference files.

---

## 6. Interface Contracts

### ARCH-029 | High | No documented interface contracts between scripts
Scripts communicate through:
1. **20+ environment variables** — discovered only by grepping
2. **10+ filesystem paths** — `.aic/tasks/<id>/reports/<worker>-output.md`, `.pm-last-edp.json`, etc.
3. **HTTP API** — lease issue/complete, task-start, metrics
4. **Exit codes** — 0/1/2/3/4 with overlapping meanings

None documented. The `.pm-last-edp.json` format is defined only in pm-review.sh inline Python. Exit code convention only documented in SKILL.md pitfall descriptions.

### ARCH-030 | Medium | Exit code 3 has dual meaning
pm-review.sh exit 3 can mean: (1) unrecognized verdict → BLOCKED, (2) PM UNKNOWN (FIX-004), (3) tool permission rejection, (4) opencode process failure. Engine treats exit 2 as BLOCKED, non-2 as REWORK — so exit 3 becomes REWORK, but SKILL.md says it should be BLOCKED.

### ARCH-035 | Medium | enterprise-endpoints.js:32 has a live syntax bug
`if (!proj) send(res, 404, ...); return true;` — `return true` executes unconditionally (no curly braces), making the handler always return true even when project is found. `send(res, 200, ...)` on line 34 is unreachable.

### ARCH-036 | Low | RBAC enforcement placed after most routes already matched
**Location:** `scripts/server.js:907-937`
RBAC check at line 907 is after nearly all routes matched (lines 419-900). Only unmatched routes reach it. `publicApi` allowlist (line 470) is the actual access control.

---

## 7. Dashboard Architecture

### ARCH-033 | Medium | Dashboard has 3 parallel layout systems
`layout/` (DashboardLayout, ConnectionIndicator, CRTOverlay, FloatingParticles), `new_layout/` (PipelineTracker, WorkspaceScene), `office/` (OfficeFloor, WorkerDesk, WorkerGrid, DeskComputer, StatusBubble). Unclear which is canonical. `new_layout` name suggests incomplete migration.

### ARCH-034 | Medium | Dashboard directly couples to backend API response shapes
`api/index.ts` defines response types inline. `DashboardContext` mirrors backend state shape exactly. No shared API contract file between frontend and backend.

---

## Cross-Cutting Observations

1. **Language polyglot problem:** Bash (38), Python (14), JavaScript (7) with no clear boundary. Bash generates JS code, Python calls bash scripts, JS spawns bash.
2. **Fix-driven architecture:** 21+ numbered fixes, each with its own reference document. Creates fix-centric rather than feature-centric organization.
3. **Ad-hoc state management:** 7+ persistence formats with no shared layer. Each file has its own read/write logic scattered across modules.
4. **Inconsistent error handling:** Mix of `{ ok: false, error }` returns, throws, null returns, stderr+exit. Engine uses both return objects and state mutations.
