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
