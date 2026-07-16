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
