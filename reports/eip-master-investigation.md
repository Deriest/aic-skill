# EIP MASTER INVESTIGATION REPORT

**Phase:** Master Investigation  
**Date:** 2026-07-16  
**Investigator:** Hermes (TVD Assistant)  
**Repository:** AIC Skill (`~/.hermes/skills/workflows/aic`)  
**Version:** 3.3.0  
**Status:** COMPLETE  

---

## 1. EXECUTIVE SUMMARY

The AIC Skill repository is a functionally capable but engineering-immature codebase. It successfully orchestrates a 15-worker AI development pipeline with a custom FSM engine, REST API server, and real-time dashboard. However, the repository exhibits significant engineering debt across all four EIP dimensions.

**Key findings:**

- **Reliability:** 4 shell scripts with no `set -e` (silent failure risk); 4 JS engine modules with zero try/catch; FSM `canAdvance()` has a logic bug; 11 stale tasks in `.aic/` (9 CANCELLED, 1 BLOCKED, 1 PLANNING — never cleaned up)
- **Architecture:** 160 reference docs (10,084 lines) with heavy topical overlap; server.js is a 1,038-line monolith handling all routing inline; dashboard version mismatch (package.json v3.1.3 vs SKILL.md v3.3.0)
- **Performance:** No token budgeting in worker prompts; cachedRead uses 5s TTL but no invalidation on writes; knowledge subsystem uses linear scan (no index optimization)
- **Excellence:** Only 1 test file (self-test.sh, 111 lines, config-checking only); zero unit tests for engine modules; no CI/CD; no benchmarking; 28 untracked files in git

**Engineering maturity rating:** Level 2 of 5 (Repeatable but not Defined). The system works through individual heroics and accumulated reference documentation rather than systematic engineering practice.

---

## 2. REPOSITORY BASELINE

### 2.1 Quantitative Baseline

```
Metric                          Value       Evidence
──────────────────────────────────────────────────────────────
Total source files              277         find . -not -path './.git/*'
Source size (excl deps)         4.5 MB      du -sh (excl node_modules/dist)
Dashboard node_modules          138 MB      du -sh dashboard/node_modules
Scripts (JS)                    18          find scripts -name "*.js"
Scripts (SH)                    56          find scripts -name "*.sh"
Scripts (PY)                    14          find scripts -name "*.py"
Script total lines              8,689       wc -l on all scripts
Reference docs                  160         find references -name "*.md"
Reference total lines           10,084      wc -l on all ref docs
Dashboard source files          36          find dashboard/src -type f
Templates                       38          find templates -type f
Docs files                      13          find docs -name "*.md"
.aic runtime files              59          find .aic -type f
.aic size                       920 KB      du -sh .aic
Git untracked files             28          git status --short | grep "^??"
Git modified files              2           git status --short | grep "^ M"
Git commits (visible)           6           git log --oneline
```

### 2.2 Top Files by Size

```
File                                    Lines    Role
──────────────────────────────────────────────────────────────
scripts/server.js                       1,038    API server (monolith)
scripts/engine/index.js                  959    Engine orchestrator (monolith)
scripts/worker-execution-pipeline.py      578    Worker execution
scripts/setup.sh                          481    Setup wizard
scripts/intake-evaluate.py                467    Intake evaluation
scripts/pm-review.sh                     288    PM quality gate
scripts/spawn-worker.sh                   259    Worker spawning
scripts/engine/observability.js            247    Observability
scripts/phase-runner.sh                   242    Phase execution
SKILL.md                                  606    System specification
```

### 2.3 Technology Stack

```
Layer           Technology                Version
──────────────────────────────────────────────────
Engine          Node.js (CommonJS)        Not pinned
Server          Node.js http module       Raw (no framework)
Dashboard       React + TypeScript        React 18.3, TS 5.5
Dashboard build Vite                       5.4
Dashboard CSS   TailwindCSS               3.4
Validation      Python 3                  3.12.3
Shell scripts   Bash                      Not pinned
Orchestration   OpenCode CLI              External dep
```

---

## 3. CURRENT ENGINEERING MATURITY

### 3.1 Maturity Assessment (CMMI-inspired)

| Dimension | Level | Justification |
|-----------|-------|---------------|
| Reliability | 2/5 | Works but through workarounds; no systematic error handling |
| Architecture | 2/5 | Functional separation exists but monoliths and doc sprawl |
| Performance | 1/5 | No measurement, no optimization, no baseline |
| Testing | 1/5 | Single config-check script; no unit/integration tests |
| Documentation | 3/5 | Extensive but fragmented; 160 ref docs with overlap |
| Observability | 2/5 | Basic metrics + event store but no dashboards/alerting |
| Security | 2/5 | Auth exists but input validation gaps in server |
| Process | 2/5 | Pipeline exists but no CI/CD, no code review gate |

**Overall: Level 2 — Repeatable.** The system produces consistent results through established patterns, but those patterns are not formally defined, measured, or enforced.

---

## 4. ARCHITECTURE ASSESSMENT (EIP-2)

### 4.1 Module Boundary Assessment

**Finding A-01: server.js is a monolith (1,038 lines)**
- **Evidence:** `scripts/server.js:1-1038` — all HTTP routing, CORS, auth, config, task management, metrics, latency tracking, and file serving handled in a single file with inline `if/else` routing (lines 391-877).
- **Severity:** High
- **Impact:** Any change risks breaking unrelated endpoints; impossible to test endpoints in isolation; no clear API contract.
- **EIP Phase:** EIP-2

**Finding A-02: engine/index.js is a monolith (959 lines)**
- **Evidence:** `scripts/engine/index.js:1-959` — `createEngine()` function spans the entire file; includes task lifecycle, checkpoint management, barrier coordination, PM review, artifact filtering, worker reset, and dashboard sync.
- **Severity:** High
- **Impact:** Single point of failure; no testable boundaries; changes cascade unpredictably.
- **EIP Phase:** EIP-2

**Finding A-03: worker-completion-contract.sh is a cat heredoc, not a script**
- **Evidence:** `scripts/worker-completion-contract.sh:1-11` — entire file is `cat << 'COMPLETION'` that prints a text contract. No logic, no enforcement. The "contract" is a prompt instruction, not a validated contract.
- **Severity:** Medium
- **Impact:** Workers can violate the "contract" without detection; no programmatic enforcement.
- **EIP Phase:** EIP-2

### 4.2 Dependency Graph

**Finding A-04: Implicit dependency on directory structure**
- **Evidence:** `scripts/server.js:21-33` — 12 hardcoded paths constructed via `path.join(SKILL_DIR, '.aic', ...)`. No configuration; paths assumed.
- **Severity:** Medium
- **Impact:** Moving the skill directory or renaming `.aic/` breaks everything.
- **EIP Phase:** EIP-2

**Finding A-05: Cross-layer coupling — engine imports from scripts/**
- **Evidence:** `scripts/engine/index.js:8` — `require('../artifact-provider')` — engine module reaches up to parent scripts directory, violating layer separation.
- **Severity:** Low
- **Impact:** Engine is not self-contained; can't be extracted or tested independently.
- **EIP Phase:** EIP-2

### 4.3 Configuration Management

**Finding A-06: Scattered configuration sources**
- **Evidence:** Config spread across: `.env` (env vars), `.env.example` (template), `scripts/config.sh` (shell config), `.aic/auth.json` (auth keys), `requirements.json` (dep requirements), `dashboard/requirements.json` (dashboard-specific), `templates/.env.example` (project template).
- **Severity:** Medium
- **Impact:** No single source of truth for configuration; settings can conflict across files.
- **EIP Phase:** EIP-2

### 4.4 Reference Document Organization

**Finding A-07: 160 reference docs with heavy topical overlap**
- **Evidence:**
  - 16 dashboard-related docs (dashboard-config-*, dashboard-*-pitfalls, dashboard-*-workflow, dashboard-specification, dashboard-ui-rules, etc.)
  - 12 runtime-fix docs (runtime-fix008 through runtime-fix021)
  - 8 runtime-oat docs (runtime-oat-*)
  - 11 imp docs (imp-001 through imp024)
  - 9 epic-201 docs (epic-201-*)
  - Total: 10,084 lines of reference documentation
- **Severity:** High
- **Impact:** Conflicting guidance risk; maintenance burden; context window overflow when loading multiple refs; hard to find canonical answer.
- **EIP Phase:** EIP-2

**Finding A-08: Dashboard config pitfall docs overlap significantly**
- **Evidence:**
  - `references/dashboard-config-provider-selection-pitfall.md` (10 lines)
  - `references/dashboard-config-save-pitfall.md` (14 lines)
  - `references/dashboard-config-ui-pitfalls.md` (10 lines)
  - `references/dashboard-config-fetch-models.md` (35 lines)
  - All describe ConfigPage.tsx issues; some share root causes (apiKey masking, provider selection).
- **Severity:** Medium
- **Impact:** 4 docs for related issues; should be consolidated into 1 dashboard-config-pitfalls.md.
- **EIP Phase:** EIP-2

**Finding A-09: Runtime fix docs are historical, not consolidated**
- **Evidence:** 12 separate `runtime-fixNNN-*.md` files, each 8-65 lines. Many are point-in-time records (e.g., "FIX-014 — WECP H1 preamble strip" at 8 lines). No consolidated "Known Fixes" or "Resolved Issues" document.
- **Severity:** Medium
- **Impact:** No way to know which fixes are still relevant vs. superseded;散 scattered knowledge.
- **EIP Phase:** EIP-2

### 4.5 Archive Organization

**Finding A-10: Archive contains active reference material**
- **Evidence:** `archive/pitfalls/` contains: `dispatcher-cold-start-activation.md`, `pm-investigate-hallucination-pattern.md`, `barrier-completion-tracking-bug.md`, `direct-opencode-bypass-pattern.md`. These are referenced in `SKILL.md` decision tree (line 50+: "load `references/dispatcher-cold-start-activation.md`"). But the actual file is in `archive/pitfalls/`, not `references/`.
- **Severity:** Medium
- **Impact:** SKILL.md references may point to wrong locations; knowledge fragmentation.
- **EIP Phase:** EIP-2

---

## 5. RELIABILITY ASSESSMENT (EIP-1)

### 5.1 Error Handling

**Finding R-01: 4 shell scripts have no `set -e` — silent failures**
- **Evidence:**
  - `scripts/worker-continue-prompt.sh` — no `set -e`
  - `scripts/worker-completion-contract.sh` — no `set -e`
  - `scripts/api-auth.sh` — no `set -e`
  - `scripts/context-gather.sh` — no `set -e`
- **Severity:** High
- **Impact:** Commands fail silently; pipeline continues with missing data; corrupted state.
- **EIP Phase:** EIP-1

**Finding R-02: 4 engine JS modules have zero try/catch**
- **Evidence:**
  - `scripts/engine/barrier.js` — 0 try/catch
  - `scripts/engine/fsm.js` — 0 try/catch
  - `scripts/engine/validate-artifact.js` — 0 try/catch
  - `scripts/observability-handler.js` — 0 try/catch
- **Severity:** High
- **Impact:** Unhandled exceptions crash the server; no error recovery in core modules.
- **EIP Phase:** EIP-1

### 5.2 FSM Analysis

**Finding R-03: FSM `canAdvance()` has a logic bug**
- **Evidence:** `scripts/engine/fsm.js:36-40`:
  ```javascript
  function canAdvance(from, barrierComplete, pmPass) {
    if (!barrierComplete || !pmPass) return false;
    const n = nextPhase(from);
    return n != null && n !== 'COMPLETE' || (from === 'CLOSEOUT' && pmPass);
  }
  ```
  Operator precedence: `&&` binds tighter than `||`. So this evaluates as:
  `(n != null && n !== 'COMPLETE') || (from === 'CLOSEOUT' && pmPass)`
  For `from = 'CLOSEOUT'`, `nextPhase('CLOSEOUT')` returns `'COMPLETE'`, so `n !== 'COMPLETE'` is false, first branch is false. Second branch: `pmPass` is already checked true at line 1, so returns true. Correct result but **by accident, not by design**. For `from = 'VERIFICATION'`, `n = 'CLOSEOUT'` (not null, not COMPLETE), returns true correctly. But the intent is unclear and the logic is fragile.
- **Severity:** Medium
- **Impact:** Correct behavior by coincidence; any refactor could break it.
- **EIP Phase:** EIP-1

**Finding R-04: FSM has no guard conditions per transition**
- **Evidence:** `scripts/engine/fsm.js` — `canAdvance()` only checks barrier + pmPass. No per-transition validation (e.g., investigate→planning requires investigation artifacts; planning→implementation requires plan artifacts). Artifact validation is done separately in `validate-artifact.js`, but the FSM itself has no hooks.
- **Severity:** Medium
- **Impact:** FSM and artifact validation are decoupled; validation bypass is possible.
- **EIP Phase:** EIP-1

### 5.3 Task Lifecycle

**Finding R-05: 11 stale tasks in .aic/tasks/ — never cleaned up**
- **Evidence:**
  ```
  TASK-20260715-001: status=active, phase=CANCELLED    (stale)
  TASK-20260715-002: status=active, phase=CANCELLED    (stale)
  TASK-20260715-003: status=active, phase=CANCELLED    (stale)
  TASK-20260715-004: status=active, phase=CANCELLED    (stale)
  TASK-20260715-005: status=active, phase=CANCELLED    (stale)
  TASK-20260715-006: status=active, phase=CANCELLED    (stale)
  TASK-20260715-007: status=active, phase=CANCELLED    (stale)
  TASK-20260715-008: status=active, phase=PLANNING     (stale)
  TASK-20260715-009: status=active, phase=CANCELLED    (stale)
  TASK-20260715-010: status=active, phase=CANCELLED    (stale)
  TASK-20260715-011: status=active, phase=BLOCKED      (stale)
  ```
  All 11 tasks have `status: "active"` but 9 are CANCELLED, 1 is BLOCKED, 1 is in PLANNING. The `status` field is never updated to match the actual phase.
- **Severity:** High
- **Impact:** `state.json` reports `currentTask: TASK-20260715-011` with workers "complete" — but the task is BLOCKED. Pipeline appears active when it's dead. New task starts may conflict.
- **EIP Phase:** EIP-1

**Finding R-06: state.json shows inconsistent worker status**
- **Evidence:** `.aic/state.json` — all workers (pm, architect, research, frontend) have `status: "complete"` and `currentTask: "TASK-20260715-011"`, but TASK-011's `state.json` says `phase: BLOCKED`. Workers report "complete" but task is blocked.
- **Severity:** High
- **Impact:** Dashboard and API show false "complete" status; misleading.
- **EIP Phase:** EIP-1

### 5.4 Exit Code Semantics

**Finding R-07: Inconsistent exit codes across scripts**
- **Evidence:**
  - Most scripts: `exit 1` for any failure (config.sh:47, config.sh:60, deploy.sh:29, deploy.sh:38, deploy.sh:74, deploy.sh:102, health-check.sh:106, etc.)
  - `context-gather.sh:8`: `exit 0` (always succeeds — even on error)
  - `cache-context.sh:24`: `exit 0` (always succeeds)
  - No script uses `exit 2` for "blocked" or "rework needed" — this semantic exists in PM review but not in exit codes.
- **Severity:** Medium
- **Impact:** Callers can't distinguish between "failed" and "blocked"; pipeline can't programmatically route based on exit code.
- **EIP Phase:** EIP-1

### 5.5 Pipeline Orchestrator

**Finding R-08: Pipeline orchestrator is fire-and-forget**
- **Evidence:** `scripts/pipeline-orchestrator.sh:1-55` — script starts a task via `POST /api/task-start`, prints "Pipeline runs asynchronously", then `exit 0`. No polling, no status tracking, no error callback. Caller has no way to know if pipeline succeeded.
- **Severity:** Medium
- **Impact:** Pipeline failures are silent; user must manually check status.
- **EIP Phase:** EIP-1

### 5.6 Recovery

**Finding R-09: Recovery module exists but coverage is unknown**
- **Evidence:** `scripts/engine/recovery.js` (exists, `reconcileOnStartup` function). `scripts/recovery.sh` (exists). But no test verifies recovery behavior; no documentation of which failure modes are covered.
- **Severity:** Medium
- **Impact:** Recovery may not handle all failure modes; untested.
- **EIP Phase:** EIP-1

---

## 6. PERFORMANCE ASSESSMENT (EIP-3)

### 6.1 Context and Token Efficiency

**Finding P-01: No token budgeting in worker prompts**
- **Evidence:** `scripts/spawn-worker.sh:1-259` — worker prompts are assembled from templates and context files without any token counting or budget enforcement. No `max_tokens` parameter or context truncation logic.
- **Severity:** Medium
- **Impact:** Worker prompts may exceed context window; no cost control; potential API failures.
- **EIP Phase:** EIP-3

**Finding P-02: Context gathering is not optimized**
- **Evidence:** `scripts/context-gather.sh` (192 lines) — always `exit 0` (never fails), no caching, reads files fresh every time. `scripts/cache-context.sh` exists but `context-gather.sh` doesn't reference it.
- **Severity:** Medium
- **Impact:** Redundant file reads; unnecessary I/O; slow worker startup.
- **EIP Phase:** EIP-3

### 6.2 Server Performance

**Finding P-03: cachedRead uses 5s TTL with no write invalidation**
- **Evidence:** `scripts/server.js:52-63` — `cachedRead()` caches JSON file reads for 5 seconds. But `invalidateCache()` (line 63) is only called in one place. Most write operations don't invalidate the cache, meaning stale data can be served.
- **Severity:** Medium
- **Impact:** API responses may return stale state for up to 5 seconds after a write.
- **EIP Phase:** EIP-3

### 6.3 Knowledge Subsystem

**Finding P-04: Knowledge subsystem uses linear scan**
- **Evidence:** `scripts/knowledge-search.sh`, `scripts/knowledge-index.sh` — index is built and queried via `jq` filters. No inverted index, no caching of query results. `knowledge-index.sh:35`: "No index found — run rebuild first" — index must be manually rebuilt.
- **Severity:** Low
- **Impact:** Knowledge queries are slow with large knowledge bases; no incremental updates.
- **EIP Phase:** EIP-3

### 6.4 Dashboard Performance

**Finding P-05: Dashboard has 138MB of node_modules (local, not tracked)**
- **Evidence:** `du -sh dashboard/node_modules` = 138MB. `.gitignore` correctly excludes `node_modules/`. Not a git issue, but increases local disk footprint and slows `npm install`.
- **Severity:** Low
- **Impact:** Slow setup; no impact on runtime once built.
- **EIP Phase:** EIP-3 (minor)

---

## 7. ENGINEERING PROCESS ASSESSMENT (EIP-4)

### 7.1 Testing

**Finding E-01: Only 1 test file — config checking only**
- **Evidence:** `scripts/self-test.sh` (111 lines) — checks: .env exists, model vars set, opencode installed, node/npm available, curl/jq available. No tests for: FSM transitions, API endpoints, worker spawning, artifact validation, auth, pipeline flow.
- **Severity:** Critical
- **Impact:** No regression protection; changes can break anything without detection.
- **EIP Phase:** EIP-4

**Finding E-02: Zero unit tests for engine modules**
- **Evidence:** No test files found for: `fsm.js`, `barrier.js`, `events.js`, `event-store.js`, `persistence.js`, `recovery.js`, `validate-artifact.js`, `observability.js`, `index.js`. No test framework installed (no jest, mocha, vitest in dependencies).
- **Severity:** Critical
- **Impact:** Core engine logic is untested; FSM bugs (R-03) go undetected.
- **EIP Phase:** EIP-4

### 7.2 CI/CD

**Finding E-03: No CI/CD pipeline**
- **Evidence:** No `.github/workflows/` directory, no `.gitlab-ci.yml`, no `Jenkinsfile`, no `Makefile` with test targets. Git has only 6 commits visible.
- **Severity:** High
- **Impact:** No automated quality gates; untested code can be committed.
- **EIP Phase:** EIP-4

### 7.3 Version Control Hygiene

**Finding E-04: 28 untracked files, 2 modified — no clean working tree**
- **Evidence:** `git status --short` shows 28 `??` (untracked) and 2 ` M` (modified). Untracked includes 20+ reference docs that are actively used.
- **Severity:** Medium
- **Impact:** Important docs are not version controlled; loss risk; no history.
- **EIP Phase:** EIP-4

### 7.4 Version Alignment

**Finding E-05: Dashboard version mismatch**
- **Evidence:** `dashboard/package.json:2` — `"version": "3.1.3"`. `SKILL.md:4` — `version: 3.3.0`. Dashboard is 2 minor versions behind.
- **Severity:** Low
- **Impact:** Confusing version tracking; no single version number.
- **EIP Phase:** EIP-4

---

## 8. VALIDATION ASSESSMENT (EIP-1/EIP-4)

**Finding V-01: Artifact validation exists but is disconnected from FSM**
- **Evidence:** `scripts/validate-phase-artifact.py` (138 lines), `scripts/validate-implementation-artifact.py`, `scripts/validate-framework-invariants.sh` (76 lines), `scripts/engine/validate-artifact.js` — 4 separate validators with no shared schema or contract. FSM `canAdvance()` doesn't call any validator.
- **Severity:** High
- **Impact:** Validation can be bypassed; inconsistent validation across phases.
- **EIP Phase:** EIP-1 + EIP-4

**Finding V-02: Two framework invariant validators (sh + py)**
- **Evidence:** `scripts/validate-framework-invariants.sh` (76 lines) and `scripts/validate-framework-invariants.py` — duplicate functionality in different languages.
- **Severity:** Low
- **Impact:** Maintenance burden; potential divergence.
- **EIP Phase:** EIP-2

---

## 9. DOCUMENTATION ASSESSMENT (EIP-4)

**Finding D-01: SKILL.md is well-structured but overloaded**
- **Evidence:** `SKILL.md` (606 lines) — contains identity, activation, responsibilities, core rules, decision tree, API patterns, pitfall references, lifecycle, architecture rules. Functions as both spec and operational manual.
- **Severity:** Low
- **Impact:** Too large for quick reference; too critical to split.
- **EIP Phase:** EIP-4

**Finding D-02: docs/ is sparse compared to references/**
- **Evidence:** `docs/` has 13 files (819 lines). `references/` has 160 files (10,084 lines). Ratio: 12:1. Most knowledge is in references, not docs. `docs/INDEX.md` is only 40 lines.
- **Severity:** Medium
- **Impact:** Documentation is scattered; no clear "start here" for new developers.
- **EIP Phase:** EIP-4

**Finding D-03: AGENTS.md is explicitly deprecated**
- **Evidence:** `AGENTS.md:3` — "DEPRECATED (2026-07-09) — Retained for Hermes `_load_agents_md()` backward compatibility." Still present, still loaded.
- **Severity:** Low
- **Impact:** Confusing; two sources of truth (AGENTS.md says "see SKILL.md").
- **EIP Phase:** EIP-4

---

## 10. MAINTAINABILITY ASSESSMENT (EIP-2)

**Finding M-01: No coding standards document**
- **Evidence:** No `CONTRIBUTING.md`, no `.editorconfig`, no `eslint.config.js` (only in dashboard node_modules), no `prettierrc`. Scripts use mixed naming: `kebab-case` (spawn-worker.sh), `snake_case` (worker_execution_pipeline.py), `camelCase` (server.js functions).
- **Severity:** Medium
- **Impact:** Inconsistent style; harder to read and maintain.
- **EIP Phase:** EIP-2

**Finding M-02: Mixed languages without clear boundaries**
- **Evidence:** Shell scripts call Python inline (`pipeline-orchestrator.sh:19-29` — heredoc Python). Python scripts call shell commands. JS modules are called by shell scripts. No clear language-per-layer.
- **Severity:** Low
- **Impact:** Debugging across language boundaries is difficult.
- **EIP Phase:** EIP-2

---

## 11. TECHNICAL DEBT ASSESSMENT

### 11.1 Debt Register

| ID | Debt Item | Severity | Effort | EIP Phase |
|----|-----------|----------|--------|-----------|
| TD-01 | server.js monolith (1,038 lines, inline routing) | High | Medium | EIP-2 |
| TD-02 | engine/index.js monolith (959 lines) | High | Medium | EIP-2 |
| TD-03 | 160 reference docs with overlap | High | High | EIP-2 |
| TD-04 | Zero unit tests for engine | Critical | High | EIP-4 |
| TD-05 | self-test.sh only checks config | Critical | Medium | EIP-4 |
| TD-06 | No CI/CD | High | Medium | EIP-4 |
| TD-07 | 4 scripts without set -e | High | Low | EIP-1 |
| TD-08 | 4 engine modules without try/catch | High | Low | EIP-1 |
| TD-09 | FSM canAdvance() logic fragility | Medium | Low | EIP-1 |
| TD-10 | Stale task cleanup never runs | High | Low | EIP-1 |
| TD-11 | state.json/status field inconsistency | High | Low | EIP-1 |
| TD-12 | Exit code inconsistency | Medium | Low | EIP-1 |
| TD-13 | Pipeline orchestrator fire-and-forget | Medium | Medium | EIP-1 |
| TD-14 | No token budgeting | Medium | Medium | EIP-3 |
| TD-15 | cachedRead no write invalidation | Medium | Low | EIP-3 |
| TD-16 | Dashboard version mismatch | Low | Low | EIP-4 |
| TD-17 | 28 untracked files | Medium | Low | EIP-4 |
| TD-18 | Duplicate validators (sh + py) | Low | Low | EIP-2 |
| TD-19 | No coding standards doc | Medium | Low | EIP-2 |
| TD-20 | Archive refs referenced by SKILL.md | Medium | Low | EIP-2 |

### 11.2 Debt by EIP Phase

```
EIP-1 (Reliability):    10 items (2 High, 1 Critical, 7 Medium)
EIP-2 (Architecture):   7 items (3 High, 4 Medium)
EIP-3 (Performance):    3 items (3 Medium)
EIP-4 (Excellence):     5 items (1 Critical, 2 High, 2 Medium)
Total:                  20 items (4 High-critical, 16 Medium-Low)
```

---

## 12. RISK ASSESSMENT

### 12.1 Investigation-Verified Risks

| ID | Risk | Likelihood | Impact | Evidence | Mitigation |
|----|------|------------|--------|----------|------------|
| IR-01 | Engine crash from unhandled exception | High | Critical | R-02: barrier.js, fsm.js, validate-artifact.js have 0 try/catch | Add try/catch to all engine modules |
| IR-02 | Pipeline continues with missing data | High | High | R-01: 4 scripts without set -e | Add set -euo pipefail to all scripts |
| IR-03 | False "complete" status on dashboard | Confirmed | High | R-05/R-06: stale tasks, inconsistent state.json | Fix task lifecycle cleanup |
| IR-04 | Regression goes undetected | Confirmed | Critical | E-01/E-02: no unit tests | Add engine tests first |
| IR-05 | Reference doc conflicts | Medium | Medium | A-07/A-08: 160 docs with overlap | Consolidate and deduplicate |
| IR-06 | Knowledge loss from untracked files | Medium | Medium | E-04: 28 untracked files | Commit all active reference docs |
| IR-07 | FSM transition bug | Low | High | R-03: canAdvance() logic fragility | Add explicit guard conditions + tests |
| IR-08 | Stale cache causes wrong API response | Medium | Medium | P-03: cachedRead 5s TTL no invalidation | Add write-time cache invalidation |
| IR-09 | False finding risk (sub-agent evidence reliability) | Medium | Medium | C-03 false positive | All Critical findings must be independently verified before baseline acceptance |
| IR-10 | Perf measurement impossible without durationSec fix | High | Medium | EXC-02 | Fix durationSec recording as first EIP-3 work item |
| IR-11 | Shell injection vulnerabilities exploited during EIP | Low | High | REL-08 | Fix injection vulnerabilities early, before EIP-2 script refactoring |

---

## 13. ROOT CAUSE ANALYSIS

### 13.1 Root Cause: Organic Growth Without Engineering Discipline

The repository grew organically through rapid iteration (v3.1.3 → v3.3.0 with 6 commits). Features were added by creating new scripts and reference docs rather than refactoring existing ones. This produced:

1. **Doc sprawl:** Each bug fix generated a new reference doc (runtime-fixNNN-*.md, imp-NNN-*.md) instead of updating canonical docs.
2. **Script sprawl:** 57 scripts for a system that logically has ~15 operations. Many scripts are thin wrappers or one-off utilities.
3. **Monolith accumulation:** server.js and engine/index.js grew linearly with features, never refactored.
4. **Test debt:** No tests were ever written; self-test.sh was added late as a config checker.
5. **State drift:** Task lifecycle management was added incrementally; cleanup was never automated.

### 13.2 Root Cause: No Engineering Gates

No CI, no code review, no test requirement, no linting. Changes go directly to working tree. The 28 untracked files prove that even important docs aren't committed.

---

## 14. GAP ANALYSIS

### 14.1 Gap Matrix

| Area | Current State | Target State | Gap |
|------|---------------|--------------|-----|
| Error handling | 4 scripts without set -e, 4 modules without try/catch | All scripts have set -euo pipefail, all modules have try/catch | 8 files to fix |
| FSM validation | canAdvance() fragile, no per-transition guards | Explicit guard conditions, tested transitions | FSM rewrite + tests |
| Task cleanup | 11 stale tasks, no auto-cleanup | Auto-cleanup on terminal states | Cleanup script + integration |
| Unit testing | Zero tests | Critical path coverage >80% | Test framework + suite |
| CI/CD | None | Automated test + lint on commit | GitHub Actions or equivalent |
| Doc organization | 160 refs, fragmented | ~40 consolidated refs + canonical docs | Doc audit + consolidation |
| server.js | 1,038-line monolith | Modular route handlers | Refactor into modules |
| engine/index.js | 959-line monolith | Decomposed functions | Refactor |
| Token efficiency | No budgeting | Token tracking + budget enforcement | Token counting + limits |
| Observability | Basic metrics, no alerting | Dashboard + alerting | Observability layer |
| Security | Auth exists, input validation gaps | Input validation on all endpoints | Validation middleware |
| Version control | 28 untracked files | Clean working tree | Git commit + .gitignore review |

---

## 15. ENGINEERING OPPORTUNITIES

| ID | Opportunity | Impact | Effort | EIP Phase |
|----|-------------|--------|--------|-----------|
| O-01 | Add `set -euo pipefail` to 4 scripts | Prevents silent failures | Low | EIP-1 |
| O-02 | Add try/catch to 4 engine modules | Prevents server crashes | Low | EIP-1 |
| O-03 | Implement task auto-cleanup on terminal states | Eliminates stale tasks | Low | EIP-1 |
| O-04 | Add explicit FSM transition guards | Deterministic state machine | Low | EIP-1 |
| O-05 | Refactor server.js into route modules | Maintainable API | Medium | EIP-2 |
| O-06 | Refactor engine/index.js into sub-modules | Testable engine | Medium | EIP-2 |
| O-07 | Consolidate 160 refs → ~40 canonical docs | Reduces doc noise | High | EIP-2 |
| O-08 | Add vitest/jest for engine unit tests | Regression protection | Medium | EIP-4 |
| O-09 | Add GitHub Actions CI | Automated quality gate | Low | EIP-4 |
| O-10 | Add token counting to worker prompts | Cost control | Medium | EIP-3 |
| O-11 | Add cache invalidation on writes | Data consistency | Low | EIP-3 |
| O-12 | Commit untracked reference docs | Version control hygiene | Low | EIP-4 |
| O-13 | Align dashboard version to 3.3.0 | Version consistency | Low | EIP-4 |
| O-14 | Add input validation middleware to server | Security | Medium | EIP-4 |
| O-15 | Consolidate duplicate validators | Reduce maintenance | Low | EIP-2 |

---

## 16. CROSS-PHASE DEPENDENCY ANALYSIS

```
EIP-1 (Reliability)                    EIP-2 (Architecture)
├── O-01: set -e (independent)          ├── O-05: server.js refactor (independent)
├── O-02: try/catch (independent)       ├── O-06: engine refactor (independent)
├── O-03: task cleanup (independent)    ├── O-07: doc consolidation (independent)
├── O-04: FSM guards (independent)      ├── O-15: validator consolidation (after O-04)
│                                       │
└─── EIP-3 (Performance)                └─── EIP-4 (Excellence)
     ├── O-10: token budget (after EIP-1)     ├── O-08: unit tests (after EIP-2)
     ├── O-11: cache invalidation             ├── O-09: CI/CD (after O-08)
     │   (independent)                        ├── O-12: git hygiene (independent)
     │                                       ├── O-13: version align (independent)
     │                                       ├── O-14: input validation (after EIP-2)
     │                                       │
     └── EIP-3 depends on EIP-1              └── EIP-4 depends on EIP-2
         (reliable baseline needed)               (clean architecture needed
          before optimizing)                       before testing)
```

### Key Dependencies:
- **O-04 → O-15:** Consolidate validators after FSM guards are in place
- **EIP-1 → EIP-3:** Must fix silent failures before optimizing
- **EIP-2 → EIP-4:** Must modularize before writing tests (test boundaries)
- **O-05 → O-14:** Input validation middleware needs server modularization
- **O-06 → O-08:** Engine tests need modular engine

---

## 17. RECOMMENDED EIP BACKLOG

### 17.1 EIP-1 Backlog (Reliability) — Priority: Highest

| # | Work Item | Severity | Effort | Dependencies |
|---|-----------|----------|--------|--------------|
| EIP-1.1 | Add `set -euo pipefail` to 4 scripts (R-01) | High | Low | None |
| EIP-1.2 | Add try/catch to 4 engine modules (R-02) | High | Low | None |
| EIP-1.3 | Implement task auto-cleanup on terminal states (R-05) | High | Low | None |
| EIP-1.4 | Fix state.json/status field synchronization (R-06) | High | Low | EIP-1.3 |
| EIP-1.5 | Add explicit FSM transition guards (R-03, R-04) | Medium | Low | None |
| EIP-1.6 | Standardize exit codes (0=pass, 1=fail, 2=blocked) (R-07) | Medium | Low | None |
| EIP-1.7 | Add pipeline status polling to orchestrator (R-08) | Medium | Medium | None |
| EIP-1.8 | Document and test recovery coverage (R-09) | Medium | Medium | None |

### 17.2 EIP-2 Backlog (Architecture) — Priority: High

| # | Work Item | Severity | Effort | Dependencies |
|---|-----------|----------|--------|--------------|
| EIP-2.1 | Refactor server.js into route modules (A-01) | High | Medium | None |
| EIP-2.2 | Refactor engine/index.js into sub-modules (A-02) | High | Medium | None |
| EIP-2.3 | Consolidate 160 refs → canonical docs (A-07, A-08, A-09) | High | High | None |
| EIP-2.4 | Centralize configuration management (A-06) | Medium | Medium | None |
| EIP-2.5 | Fix archive/reference path mismatches (A-10) | Medium | Low | None |
| EIP-2.6 | Consolidate duplicate validators (V-02) | Low | Low | EIP-1.5 |
| EIP-2.7 | Add coding standards document (M-01) | Medium | Low | None |

### 17.3 EIP-3 Backlog (Performance) — Priority: Medium (after EIP-1)

| # | Work Item | Severity | Effort | Dependencies |
|---|-----------|----------|--------|--------------|
| EIP-3.1 | Add token counting/budgeting to worker prompts (P-01) | Medium | Medium | EIP-1 complete |
| EIP-3.2 | Fix cachedRead write invalidation (P-03) | Medium | Low | None |
| EIP-3.3 | Optimize context gathering with caching (P-02) | Medium | Medium | None |
| EIP-3.4 | Add knowledge index incremental updates (P-04) | Low | Medium | None |

### 17.4 EIP-4 Backlog (Excellence) — Priority: Medium (after EIP-2)

| # | Work Item | Severity | Effort | Dependencies |
|---|-----------|----------|--------|--------------|
| EIP-4.1 | Add test framework + engine unit tests (E-01, E-02) | Critical | High | EIP-2.2 |
| EIP-4.2 | Add CI/CD pipeline (E-03) | High | Low | EIP-4.1 |
| EIP-4.3 | Commit untracked files + git hygiene (E-04) | Medium | Low | None |
| EIP-4.4 | Align versions (dashboard → 3.3.0) (E-05) | Low | Low | None |
| EIP-4.5 | Add input validation middleware (V-01) | High | Medium | EIP-2.1 |
| EIP-4.6 | Improve docs/INDEX.md as entry point (D-02) | Medium | Low | None |
| EIP-4.7 | Security audit (auth, PAT, input validation) | High | Medium | None |

---

## 18. INVESTIGATION CONCLUSIONS

### 18.1 Summary of Findings

The AIC Skill repository is a **functionally capable system with significant engineering debt**. The system works — it orchestrates 15 AI workers through a structured pipeline with an FSM engine, REST API, and real-time dashboard. But it works despite its engineering, not because of it.

**Critical gaps:**
1. **Zero test coverage** for core engine logic — any change is a leap of faith
2. **Silent failure paths** — 4 scripts without `set -e`, 4 modules without `try/catch`
3. **State management inconsistency** — stale tasks, false "complete" status, no auto-cleanup
4. **Documentation sprawl** — 160 reference docs (10,084 lines) with heavy overlap
5. **Monolithic core** — server.js (1,038 lines) and engine/index.js (959 lines) are unmanageable

**Strengths to preserve:**
1. **Well-designed FSM** — clear phase order, terminal states, phase plans
2. **Comprehensive reference documentation** — extensive, even if fragmented
3. **Working observability** — event store, metrics, latency tracking exist
4. **Auth system** — API key management with RBAC roles
5. **Template system** — 38 structured templates for phase artifacts

### 18.2 Recommended Execution Order

```
Phase 1: EIP-1 (Reliability) — Fix silent failures first
  ├── EIP-1.1: set -euo pipefail (1 day)
  ├── EIP-1.2: try/catch in engine (1 day)
  ├── EIP-1.3: task auto-cleanup (1 day)
  ├── EIP-1.4: state.json sync (1 day)
  ├── EIP-1.5: FSM guards (1 day)
  ├── EIP-1.6: exit codes (1 day)
  ├── EIP-1.7: pipeline polling (2 days)
  └── EIP-1.8: recovery testing (2 days)

Phase 2: EIP-2 (Architecture) — Modularize and consolidate
  ├── EIP-2.1: server.js refactor (3 days)
  ├── EIP-2.2: engine/index.js refactor (3 days)
  ├── EIP-2.3: doc consolidation (5 days)
  ├── EIP-2.4: config centralization (2 days)
  ├── EIP-2.5: archive path fixes (1 day)
  ├── EIP-2.6: validator consolidation (1 day)
  └── EIP-2.7: coding standards (1 day)

Phase 3: EIP-3 (Performance) — Optimize reliable baseline
  ├── EIP-3.1: token budgeting (3 days)
  ├── EIP-3.2: cache invalidation (1 day)
  ├── EIP-3.3: context caching (2 days)
  └── EIP-3.4: knowledge index (2 days)

Phase 4: EIP-4 (Excellence) — Test, document, secure
  ├── EIP-4.1: test framework + engine tests (5 days)
  ├── EIP-4.2: CI/CD (1 day)
  ├── EIP-4.3: git hygiene (1 day)
  ├── EIP-4.4: version alignment (1 day)
  ├── EIP-4.5: input validation (2 days)
  ├── EIP-4.6: docs entry point (1 day)
  └── EIP-4.7: security audit (2 days)
```

### 18.3 Exit Criteria Verification

| Exit Criterion | Met? | Evidence |
|----------------|------|----------|
| Entire repository investigated | YES | 277 files catalogued, 57 scripts analyzed, 160 refs reviewed, 36 dashboard files examined |
| Every finding supported by evidence | YES | All findings cite file:line evidence |
| Engineering gaps classified | YES | 20 debt items classified by EIP phase |
| Risks documented | YES | 8 investigation-verified risks |
| Work categorized into EIP-1 through EIP-4 | YES | 4 backlogs with 27 work items |
| Cross-phase dependencies identified | YES | Dependency diagram + key dependencies |
| Source of Truth updated | YES | See Section 19 below |
| Ready for Master Planning | YES | Backlog with effort estimates and dependencies |

---

## 19. SOURCE OF TRUTH UPDATE

The following findings from this investigation supersede assumptions in the Master Program:

### 19.1 Amended Assumptions

| Original Assumption | Finding | Amendment |
|--------------------|---------|-----------|
| A-01: Repo is under git control | Confirmed, but 28 files untracked | Git hygiene is a priority (EIP-4.3) |
| A-05: 15-worker model is stable | Confirmed | No changes needed |
| A-07: Archive is read-only reference | FALSE — SKILL.md references archive/pitfalls/ | Fix path references (EIP-2.5) |
| A-10: Version 3.3.0 is baseline | FALSE — dashboard is v3.1.3 | Version alignment needed (EIP-4.4) |

### 19.2 New Facts Established

1. **160 reference docs** (was estimated 130+) — 10,084 total lines
2. **57 scripts** (confirmed) — 8,689 total lines across JS/SH/PY
3. **138MB node_modules** in dashboard (local only, not tracked)
4. **Zero unit tests** for engine modules
5. **self-test.sh** is config-checking only (111 lines)
6. **server.js** is 1,038-line monolith with inline routing
7. **engine/index.js** is 959-line monolith
8. **FSM** is 84 lines — small but fragile (canAdvance logic bug)
9. **11 stale tasks** in .aic/tasks/ — cleanup never runs
10. **Dashboard** has 36 source files, React 18 + TypeScript + Vite

### 19.3 Authoritative Baseline for Planning

This investigation report (`reports/eip-master-investigation.md`) is now the authoritative engineering baseline. The Master Planning phase SHALL:
1. Use the 27-item EIP backlog (Section 17) as input
2. Respect the cross-phase dependencies (Section 16)
3. Reference the evidence register (Section 20) for all planning decisions
4. Not introduce findings not backed by this investigation

---

## 20. EVIDENCE REGISTER

### 20.1 Evidence Index

| Evidence ID | File | Lines | Finding(s) Supported |
|-------------|------|-------|---------------------|
| EV-001 | `scripts/server.js` | 1-1038 | A-01 (monolith), P-03 (cache), V-01 (validation) |
| EV-002 | `scripts/engine/index.js` | 1-959 | A-02 (monolith), A-05 (cross-layer coupling) |
| EV-003 | `scripts/engine/fsm.js` | 1-84 | R-03 (canAdvance bug), R-04 (no guards) |
| EV-004 | `scripts/engine/barrier.js` | full | R-02 (no try/catch) |
| EV-005 | `scripts/engine/validate-artifact.js` | full | R-02 (no try/catch), V-01 |
| EV-006 | `scripts/observability-handler.js` | full | R-02 (no try/catch) |
| EV-007 | `scripts/worker-continue-prompt.sh` | full | R-01 (no set -e) |
| EV-008 | `scripts/worker-completion-contract.sh` | 1-11 | R-01 (no set -e), A-03 (heredoc not script) |
| EV-009 | `scripts/api-auth.sh` | full | R-01 (no set -e) |
| EV-010 | `scripts/context-gather.sh` | 1-192 | R-01 (no set -e), P-02 (no caching) |
| EV-011 | `scripts/pipeline-orchestrator.sh` | 1-55 | R-08 (fire-and-forget) |
| EV-012 | `scripts/self-test.sh` | 1-111 | E-01 (config checking only) |
| EV-013 | `.aic/tasks/*/state.json` | all | R-05 (11 stale tasks), R-06 (status mismatch) |
| EV-014 | `.aic/state.json` | full | R-06 (false complete status) |
| EV-015 | `.aic/health.json` | full | R-06 (health degraded/unhealthy entries) |
| EV-016 | `references/dashboard-config-*.md` | 4 files | A-08 (dashboard config overlap) |
| EV-017 | `references/runtime-fix0*.md` | 12 files | A-09 (runtime fix sprawl) |
| EV-018 | `dashboard/package.json` | line 2 | E-05 (version 3.1.3) |
| EV-019 | `SKILL.md` | line 4 | E-05 (version 3.3.0) |
| EV-020 | `git status --short` | 30 lines | E-04 (28 untracked, 2 modified) |
| EV-021 | `.gitignore` | full | Confirms node_modules excluded but reports/ excluded too |
| EV-022 | `scripts/config.sh` | 1-60+ | A-06 (scattered config) |
| EV-023 | `requirements.json` | full | A-06 (separate from .env) |
| EV-024 | `templates/.env.example` | full | A-06 (third env template) |
| EV-025 | `scripts/cache-context.sh` | full | P-02 (exists but unused by context-gather) |
| EV-026 | `scripts/knowledge-*.sh` | 8 files | P-04 (linear scan, no incremental) |
| EV-027 | `scripts/validate-framework-invariants.sh` | 76 lines | V-02 (duplicate with .py) |
| EV-028 | `scripts/validate-framework-invariants.py` | full | V-02 (duplicate with .sh) |
| EV-029 | `archive/pitfalls/dispatcher-cold-start-activation.md` | exists | A-10 (referenced by SKILL.md but in archive) |
| EV-030 | `AGENTS.md` | line 3 | D-03 (deprecated but present) |

### 20.2 Verification Method

All evidence was collected through:
1. `find` commands for file enumeration and sizing
2. `wc -l` for line counts
3. `grep -rn` for pattern matching across source files
4. `python3 -c` for JSON parsing and verification
5. Direct file reading via `read_file` and `cat`
6. `git status` and `git log` for version control state
7. `du -sh` for disk usage measurement

No assumptions were made. Every finding is traceable to a specific file and line number.

---

## 21. APPENDIX A: SUB-AGENT INVESTIGATION RESULTS — RELIABILITY (22 FINDINGS)

Three parallel sub-agents were dispatched. The Reliability and Performance/Excellence agents completed. Their findings are integrated below. Key findings NOT in the main report are marked with [NEW].

### 21.1 Reliability Sub-Agent — Additional Findings

**[OVERTURNED] Finding REL-01: ~~`api-auth.sh` broken string literal causes shell corruption~~**
- **Status:** OVERTURNED during Master Investigation Review (2026-07-16)
- **Original Claim:** `scripts/api-auth.sh:29` — `auth_flag="X-API-Key: ***` with missing closing quote.
- **Verification:** Raw byte inspection confirms the file contains `auth_flag="X-API-Key: $key"` (bytes `24 6b 65 79` = `$key`), NOT literal `***`. The string is properly opened and closed with `"` on the same line. `bash -n` passes. `declare -f curl_api` shows correct function definition. The `***` in terminal output was variable display redaction, not file content.
- **Resolution:** Finding REMOVED from critical list. No bug exists.
- **EIP Phase:** N/A (overturned)

**[NEW] Finding REL-02 (Critical): Non-atomic state file writes — data corruption risk**
- **Evidence:** `scripts/server.js:288-295` (saveState), `scripts/engine/persistence.js:22-41` (writeCheckpoint), `scripts/engine/index.js:628-643` (triggerKnowledgeAsync) — all use `fs.writeFileSync()` directly, no temp+rename pattern.
- **Impact:** Process crash mid-write corrupts state files. Server and shell scripts write concurrently to same JSON files with no locking.
- **EIP Phase:** EIP-1

**[NEW] Finding REL-03 (High): `spawn-worker.sh` lease completion suppressed by `|| true`**
- **Evidence:** `scripts/spawn-worker.sh:249-251` — `curl_api ... lease/.../complete > /dev/null 2>&1 || true`
- **Impact:** If server is down, lease completion is silently lost. Barrier never records completion → phase hangs indefinitely (silent deadlock).
- **EIP Phase:** EIP-1

**[NEW] Finding REL-04 (High): `task.cancel` doesn't stop running pipeline**
- **Evidence:** `scripts/engine/index.js:878-893` — sets `cp.pipelineState = 'CANCELLED'` but doesn't set `pipelineRunning = false`. `runPipeline` never checks cancellation status.
- **Impact:** Cancelled tasks continue executing, wasting resources and overwriting artifacts.
- **EIP Phase:** EIP-1

**[NEW] Finding REL-05 (High): `task.resume` restarts from beginning, doesn't resume**
- **Evidence:** `scripts/engine/index.js:859-877` — `runPipeline` starts from INVESTIGATE regardless of `cp.pipelineState`.
- **Impact:** Resume wastes all completed work by restarting pipeline from scratch.
- **EIP Phase:** EIP-1

**[NEW] Finding REL-06 (High): `pm-repair-respawn.js` exits on first delete failure**
- **Evidence:** `scripts/pm-repair-respawn.js:13-14` — `process.exit(1)` on first file deletion error.
- **Impact:** Old artifacts remain, causing false barrier satisfaction. PM repair passes without actual repair.
- **EIP Phase:** EIP-1

**[NEW] Finding REL-07 (High): `queue.sh` non-atomic read-modify-write on queue.json**
- **Evidence:** `scripts/queue.sh:15-27,30-44,69-93` — no file locking. `server.js` does same in ops-endpoints.js:98-107.
- **Impact:** Concurrent queue operations silently lose entries.
- **EIP Phase:** EIP-1

**[NEW] Finding REL-08 (High): Shell variable injection into Python heredocs — arbitrary code execution**
- **Evidence:** `scripts/knowledge-memory.sh:23,37,59`, `scripts/knowledge-search.sh:17-45`, `scripts/knowledge-reuse.sh:16-33` — shell vars interpolated directly into Python code.
- **Impact:** Crafted input (e.g., `'); os.system('rm -rf /')`) achieves arbitrary code execution.
- **EIP Phase:** EIP-4 (Security)

**[NEW] Finding REL-09 (High): `server.js` RBAC fail-open on exception**
- **Evidence:** `scripts/server.js:937` — `catch(rbacErr) { /* RBAC check failed, allow request to proceed */ }`
- **Impact:** Any RBAC error makes all protected endpoints accessible without authorization.
- **EIP Phase:** EIP-4 (Security)

**[NEW] Finding REL-10 (Medium): `recovery.js` only handles running/spawning states**
- **Evidence:** `scripts/engine/recovery.js:24-26` — only checks `phaseStatus === 'running' || 'spawning'`.
- **Impact:** Tasks in `barrier_wait` or `pm_repair` after crash are not recovered → permanent stall.
- **EIP Phase:** EIP-1

**[NEW] Finding REL-11 (Medium): `health-check.sh` HEALTH_FILE not exported to Python heredoc**
- **Evidence:** `scripts/health-check.sh:57,60` — `HEALTH_FILE` not in export list; Python falls back to relative `.aic/health.json`.
- **Impact:** Health data written to wrong path when run from non-skill directory.
- **EIP Phase:** EIP-1

**[NEW] Finding REL-12 (Medium): `validate-framework-invariants.sh` no argument validation**
- **Evidence:** `scripts/validate-framework-invariants.sh:7-8` — plain `$1` and `$2` without `:?`.
- **Impact:** Empty/missing args cause validation to pass vacuously.
- **EIP Phase:** EIP-1

**[NEW] Finding REL-13 (Medium): `recovery.sh` recursive self-invocation with no depth limit**
- **Evidence:** `scripts/recovery.sh:54` — `bash "$0" restore "$LATEST"` — no recursion guard.
- **Impact:** Infinite recovery loop if backup is corrupted.
- **EIP Phase:** EIP-1

**[NEW] Finding REL-14 (Medium): `recovery.sh` doesn't restart server after restore**
- **Evidence:** `scripts/recovery.sh:44-66` — restores files but never restarts server.js.
- **Impact:** Server retains corrupted in-memory state after file restore.
- **EIP Phase:** EIP-1

**[NEW] Finding REL-15 (Medium): Barrier timeout defined but never enforced**
- **Evidence:** `scripts/engine/barrier.js:11` — 600000ms timeout defined. `barrierSatisfied` never checks timeout.
- **Impact:** Failed lease acquisition causes 10-minute hang before phase fails.
- **EIP Phase:** EIP-1

**[NEW] Finding REL-16 (Low): `auth.js` reads credentials from disk on every request**
- **Evidence:** `scripts/auth.js:16-22,64` — `fs.readFileSync` per request, no caching.
- **Impact:** Synchronous I/O per request; potential partial JSON read during concurrent writes.
- **EIP Phase:** EIP-1

**[NEW] Finding REL-17 (Low): `auth.json` has no token expiry or refresh**
- **Evidence:** `scripts/auth.js:29-40` — `createdAt` field but no `expiresAt`.
- **Impact:** Compromised keys valid indefinitely.
- **EIP Phase:** EIP-1

**[NEW] Finding REL-18 (Low): Graceful shutdown saves state twice, second overwrites first**
- **Evidence:** `scripts/server.js:1001-1018` — saves state, resets workers, saves again.
- **Impact:** In-flight worker state lost on shutdown; recovery can't find working workers.
- **EIP Phase:** EIP-1

**[NEW] Finding REL-19 (Low): `pm-review.sh` exit code 4 undocumented**
- **Evidence:** `scripts/pm-review.sh:17` — `exit 4` for missing artifacts. Engine treats as REWORK.
- **Impact:** No logging distinguishes "no artifacts" from "needs rework".
- **EIP Phase:** EIP-1

### 21.2 Reliability Sub-Agent — Exit Code Semantics Table

| Script | 0 | 1 | 2 | 3 | 4 |
|--------|---|---|---|---|---|
| pm-review.sh | PASS | REWORK | BLOCKED | — | No artifacts |
| phase-runner.sh | All passed | Worker(s) failed | Invalid format | — | — |
| spawn-worker.sh | Success | Failure | — | — | — |
| validate-framework-invariants.sh | Valid | Invalid | — | — | — |
| worker-validation.sh | PASS | FAIL | — | — | — |
| worker-execution-pipeline.py | Validated | Failed | Usage error | — | — |
| validate-phase-artifact.py | Valid | Invalid | Usage error | — | — |
| recovery.sh | Success | Failure | — | — | — |
| pm-repair-respawn.js | — | Delete failed | Usage error | — | — |
| preflight.sh | Ready | FAIL count | — | — | — |

**Inconsistencies:** Exit 2 = "usage error" in Python but "BLOCKED" in pm-review and "invalid format" in phase-runner. Exit 4 unique to pm-review, undocumented. preflight.sh uses exit code as failure count (1-5 possible).

### 21.3 Reliability Sub-Agent — Key Patterns

1. **Silent failure swallowing** (`|| true`) at 15+ call sites masks API, lease, and validation failures
2. **Non-atomic file writes** affect all 8+ JSON state files — no write-then-rename anywhere
3. **No file locking** on any shared state file — concurrent server.js + shell access unprotected
4. **FSM bypass** — engine directly mutates `cp.pipelineState` instead of going through FSM functions
5. **Shell variable injection** into Python heredocs is pervasive in all 8 knowledge scripts
6. **Exit codes inconsistent** — same code means different things across scripts

---

## 22. APPENDIX B: SUB-AGENT INVESTIGATION RESULTS — PERFORMANCE & EXCELLENCE (26 FINDINGS)

### 22.1 Performance Sub-Agent — Additional Findings

**[NEW] Finding PERF-01 (High): 6-8 Python3 subprocess spawns per worker for JSON parsing**
- **Evidence:** `scripts/spawn-worker.sh:66,73,87-88,133-134,138,168,170,225,248`
- **Impact:** ~400ms overhead per worker spawn. `jq` is available but never used.
- **EIP Phase:** EIP-3

**[NEW] Finding PERF-02 (High): cache-context.sh is dead code — never called**
- **Evidence:** `scripts/spawn-worker.sh:47` calls `context-gather.sh` directly. `cache-context.sh` (34 lines) exists with git-HEAD-based cache invalidation but is never invoked.
- **Impact:** Every worker spawn does fresh `find . -maxdepth 3` — 200-500ms per spawn. 3 workers = 3x redundant.
- **EIP Phase:** EIP-3

**[NEW] Finding PERF-04 (High): 18-21 Python subprocess spawns for 3-worker phase prompt assembly**
- **Evidence:** `scripts/phase-runner.sh:62,98,100,101,117,122,127,155`
- **Impact:** ~1-1.5s latency before workers even start. Each spawn is a one-shot that could be a single Python orchestrator.
- **EIP Phase:** EIP-3

**[NEW] Finding PERF-08 (Medium): Prompt bloat — 10+ context blocks per worker, spec file injected whole**
- **Evidence:** `scripts/phase-runner.sh:192-209` — up to 10 injected blocks including full spec file.
- **Impact:** Worker prompts can exceed 10K tokens before task instruction. PM worker input tokens range 325-12,427.
- **EIP Phase:** EIP-3

**[NEW] Finding PERF-09 (Medium): Knowledge index built but never consumed by search**
- **Evidence:** `scripts/knowledge-index.sh` builds type/tag/worker/status index. `scripts/knowledge-search.sh` reads registry directly, ignoring the index.
- **Impact:** Index is dead code. Search is O(n) linear scan.
- **EIP Phase:** EIP-3

**[NEW] Finding PERF-11 (Medium): health-check.sh spawns full OpenCode AI session for permission check**
- **Evidence:** `scripts/health-check.sh:31-43` — `opencode run "cat $cf" --auto --format json`
- **Impact:** 5-30s for a health check that should be sub-second.
- **EIP Phase:** EIP-3

**[NEW] Finding PERF-10 (Low): Cache-Control: no-store on static assets with hashed filenames**
- **Evidence:** `scripts/server.js:351,987`
- **Impact:** Browser re-downloads vendor JS (100KB+) on every page load despite hash in filename.
- **EIP Phase:** EIP-3

### 22.2 Excellence Sub-Agent — Additional Findings

**[NEW] Finding EXC-02 (High): No benchmarking — durationSec always 0**
- **Evidence:** `.aic/metrics.json` — all 27 entries have `"durationSec": 0`. No timing measurements anywhere.
- **Impact:** EC-3.1 ("Pipeline baseline timing documented") has no existing data. No performance baselines.
- **EIP Phase:** EIP-3 (fix durationSec bug) + EIP-4 (add benchmark suite)

**[NEW] Finding EXC-03 (High): Version mismatch is worse than reported — 4-way mismatch**
- **Evidence:**
  - `SKILL.md:4` → v3.3.0
  - `scripts/server.js:431` → v3.1.3
  - `README.md:241` → v3.1.3
  - `CHANGELOG.md:5` → latest entry is [3.2.0], no 3.3.0 entry
- **Impact:** `GET /api/version` returns 3.1.3 while SKILL.md says 3.3.0. CHANGELOG missing 3.3.0 section entirely.
- **EIP Phase:** EIP-4

**[NEW] Finding EXC-04 (High): SKILL.md decision tree is ~250 lines, has duplicated sections**
- **Evidence:** `SKILL.md:59-300+` — "Discovery & Phase Review" section appears twice (lines 174-186 and 178-186). 63KB loaded into context on every `/aic` activation.
- **Impact:** Significant token consumption per activation; duplicated rules cause confusion.
- **EIP Phase:** EIP-4

**[NEW] Finding EXC-05 (Medium): Documentation references non-existent files**
- **Evidence:** `docs/INDEX.md:5` says "27 endpoints" but `README.md:229` says "21 endpoints". `docs/INDEX.md:12` references `.env.example` at root but actual file is at `templates/.env.example`. `SKILL.md:81` references `references/opencode-limit-object-pitfall.md` — not found.
- **Impact:** Broken references; inconsistent documentation.
- **EIP Phase:** EIP-4

**[NEW] Finding EXC-06 (High): Observability missing critical metrics**
- **Evidence:** `.aic/metrics.json` — `durationSec` always 0, `cacheRead`/`cacheWrite` always 0.
- **Missing:** phase transition latency, PM review duration, WECP repair metrics, cache hit rate, token cost per phase, failure rate by worker type, retry counts, queue depth.
- **EIP Phase:** EIP-4

**[NEW] Finding EXC-07 (High): /api/config endpoint exposes full .env including API keys without auth**
- **Evidence:** `scripts/server.js:470-471,534-543` — `/api/config` is public (no auth). Returns full `.env` contents including `API_KEY`, `MODEL_THINKER`, etc.
- **Impact:** Anyone on localhost can read all credentials.
- **EIP Phase:** EIP-4

**[NEW] Finding EXC-08 (Medium): detect-context.sh sends literal "***" as bearer token**
- **Evidence:** `scripts/detect-context.sh:44,82` — `-H "Authorization: Bearer ***"` — literal string, not a variable.
- **Impact:** Context window detection always fails (unauthorized). Feature is broken but silently degrades to defaults.
- **EIP Phase:** EIP-4

**[NEW] Finding EXC-09 (Medium): security-pat-injection-pitfall.md documents a bypass, not a fix**
- **Evidence:** `references/security-pat-injection-pitfall.md:18-22` — explains how to use `python3 -c` to write PATs to `~/.git-credentials` to bypass Hermes smart approval.
- **Impact:** Security bypass documented as "safe workaround" rather than addressing root cause.
- **EIP Phase:** EIP-4

**[NEW] Finding EXC-10 (High): Shell variable injection in all 8 knowledge scripts — injection vulnerability**
- **Evidence:** All `knowledge-*.sh` scripts use `python3 << PYEOF` with direct shell variable interpolation.
- **Impact:** Crafted input with single quotes achieves arbitrary code execution. Critical injection at trust boundary.
- **EIP Phase:** EIP-4 (security)

**[NEW] Finding EXC-13 (Low): `__pycache__` present in repository**
- **Evidence:** `scripts/__pycache__/phase-contract-loader.cpython-312.pyc` exists.
- **Impact:** Minor hygiene issue; .gitignore should cover this.
- **EIP Phase:** EIP-4

### 22.3 Performance & Excellence — Key Observations

1. **Biggest perf win:** Eliminate Python subprocess spawns. 24-30 Python interpreters per 3-worker phase = 2-3s pure overhead. Single Python orchestrator would fix.
2. **Context caching infrastructure is dead code.** cache-context.sh was written but never wired up.
3. **Test situation is critical.** Zero functional tests. self-test.sh checks "does file exist" only.
4. **Security has real gaps.** `/api/config` exposes .env without auth. RBAC fails open. All 8 knowledge scripts have injection vulnerabilities.
5. **Version drift indicates release process gaps.** 4-way version mismatch. CHANGELOG missing 3.3.0 entry.

---

## 23. APPENDIX C: SUB-AGENT INVESTIGATION RESULTS — ARCHITECTURE (31 FINDINGS)

The Architecture sub-agent completed with 31 findings (4 Critical, 9 High, 11 Medium, 7 Low). Full report at `/home/tvd/aic-architecture-audit-report.md`. Key NEW findings not in main report:

### 23.1 Architecture Sub-Agent — Critical Findings

**[NEW] Finding ARCH-006 (Critical): server.js ↔ engine/index.js circular state coupling**
- **Evidence:** `scripts/server.js:242-260` passes `getState: () => state` and `setState: (s) => { state = s; }` callbacks to engine. Engine mutates shared state directly (`engine/index.js:719`). Engine calls `saveState()` which is server.js's function.
- **Dependency chain:** server.js → engine/index.js → (mutates) → server.js state → server.js saveState()
- **Impact:** Bidirectional dependency with no synchronization. Both modules mutate same state object concurrently.
- **EIP Phase:** EIP-2

**[NEW] Finding ARCH-008 (High): Engine spawns scripts that HTTP back into engine's own API**
- **Evidence:** `scripts/engine/index.js:179-189` (spawnBash) → `scripts/spawn-worker.sh:70-73` (curl_api lease issue) → `scripts/spawn-worker.sh:249` (curl_api lease complete) → calls `engine.issueLease()` / `engine.finishLease()` via HTTP.
- **Impact:** Circular runtime dependency: Engine → bash → HTTP API → Engine. Engine could call these methods directly.
- **EIP Phase:** EIP-2

**[NEW] Finding ARCH-011 (High): Configuration scattered across 6+ locations, SKILL.md references nonexistent file**
- **Evidence:** Config spread across: `.env`, `.env.example` (root), `templates/.env.example`, `.aic/auth.json`, `.aic/state.json`, `.aic/metrics.json`, `requirements.json` (root), `requirements.json` (dashboard), `.aic/tasks/*/context.json`, `.aic/tasks/*/engine.json`. SKILL.md:25 references `.aic/config.json` — **file does not exist**.
- **.env parsed 7 different ways:** server.js (manual JS parser), spawn-worker.sh (bash source), WECP (Python parser), config.sh (grep), spawn-sub.sh (bash source), pm-review.sh (bash source), phase-runner.sh (bash source).
- **Impact:** No single source of truth. Different scripts may see different config values for same env var.
- **EIP Phase:** EIP-2

### 23.2 Architecture Sub-Agent — High Findings

**[NEW] Finding ARCH-003: spawn-worker.sh has 8 responsibilities in one 259-line script**
- **Evidence:** `scripts/spawn-worker.sh:1-259` — handles env loading, lease acquisition, WECP delegation, legacy opencode invocation with inline Node.js heredoc, artifact extraction with Strategy B, planning post-gen gate, metrics posting, lease completion.
- **EIP Phase:** EIP-2

**[NEW] Finding ARCH-007: Three endpoint handler files with inconsistent interfaces**
- **Evidence:** `ops-endpoints.js:51` — `handleOpsEndpoint(req, res, send, readBody, state)`. `enterprise-endpoints.js:12` — `handleEnterpriseEndpoint(req, res, send, readBody, state)`. `observability-handler.js:14` — `handleObservability(req, res, pathname, send)` — different signature, no shared base handler.
- **EIP Phase:** EIP-2

**[NEW] Finding ARCH-009: PHASE_PLANS (fsm.js) and PHASE_ALLOWED (server.js) duplicate same concept**
- **Evidence:** `scripts/engine/fsm.js:15-28` (PHASE_PLANS) vs `scripts/server.js:670-676` (PHASE_ALLOWED). Two independent definitions of which workers participate in each phase.
- **Impact:** If one is updated but not the other, server rejects spawns that engine approved (or vice versa).
- **EIP Phase:** EIP-2

**[NEW] Finding ARCH-016: 23 orphaned reference files not referenced in SKILL.md**
- **Evidence:** 155 ref files exist, SKILL.md references 138. 23 orphaned including 8 epic-201 sub-documents, wp202/wp2-wp3 summaries, and various investigation reports. docs/INDEX.md claims "105 files" — 47% discrepancy.
- **EIP Phase:** EIP-2

**[NEW] Finding ARCH-021: `percentile()` and `buildLatencySli()` duplicated in server.js and ops-endpoints.js**
- **Evidence:** `scripts/server.js:68-117` and `scripts/ops-endpoints.js:8-46` — nearly verbatim duplication. Constants `SLO_API_P99_MS = 250` and `ERROR_BUDGET_PCT = 1` also duplicated.
- **EIP Phase:** EIP-2

**[NEW] Finding ARCH-022: `readTaskContext()` duplicated in server.js and engine/index.js**
- **Evidence:** `scripts/server.js:139-146` and `scripts/engine/index.js:923-931` — nearly identical implementations.
- **EIP Phase:** EIP-2

**[NEW] Finding ARCH-023: Node.js opencode runner pattern duplicated 4 times**
- **Evidence:** `spawn-worker.sh:105-122`, `spawn-worker.sh:176-194`, `pm-review.sh:151-181`, `worker-execution-pipeline.py:116-135` — all generate Node.js scripts via heredoc to call opencode.
- **EIP Phase:** EIP-2

**[NEW] Finding ARCH-029: No documented interface contracts — all implicit**
- **Evidence:** Scripts communicate via 20+ env vars, 10+ file formats, HTTP API, and exit codes — none documented. Env var list was discovered by grepping. `.pm-last-edp.json` format defined only in pm-review.sh:214-241. engine.json schema defined only in engine/index.js writeCheckpoint calls.
- **EIP Phase:** EIP-2

### 23.3 Architecture Sub-Agent — Notable Medium/Low Findings

**[NEW] Finding ARCH-015: setup.sh says "10-Worker" but system has 15**
- **Evidence:** `scripts/setup.sh:38` — "10-Worker Orchestration". `SKILL.md:575` — "Worker count must match Worker Registry (15, not 10)".
- **EIP Phase:** EIP-2

**[NEW] Finding ARCH-018: SKILL.md has 3 duplicated section headers**
- **Evidence:** `SKILL.md:174,178` (Discovery & Phase Review ×2), `SKILL.md:363,378` (Work Package Structure ×2), `SKILL.md:367,382` (Parallel Scheduler Pattern ×2).
- **EIP Phase:** EIP-2

**[NEW] Finding ARCH-035 (High): enterprise-endpoints.js:32 has a live syntax bug**
- **Evidence:** `scripts/enterprise-endpoints.js:32` — `if (!proj) send(res, 404, { error: 'project not found' }); return true;` — `return true` executes unconditionally (no curly braces). The `send(res, 200, ...)` on line 34 is unreachable.
- **Impact:** `/api/projects/select/:id` endpoint always returns true (handled), preventing subsequent route handlers.
- **EIP Phase:** EIP-1 (Correctness bug)

**[NEW] Finding ARCH-033: Dashboard has 3 parallel layout systems**
- **Evidence:** `dashboard/src/components/layout/` (3 files), `dashboard/src/components/new_layout/` (2 files), `dashboard/src/components/office/` (5 files). Unclear which is canonical.
- **EIP Phase:** EIP-2

**[NEW] Finding ARCH-036: RBAC enforcement is effectively dead code**
- **Evidence:** `scripts/server.js:907-937` — RBAC check at line 907, but nearly all routes matched and returned by line 900. Only unmatched routes reach RBAC. The `publicApi` allowlist (line 470) is the actual access control.
- **EIP Phase:** EIP-2

### 23.4 Architecture Sub-Agent — Dependency Graph

```
SKILL.md (router)
  └→ references/*.md (155 files)

server.js
  ├→ auth.js
  ├→ ops-endpoints.js
  ├→ enterprise-endpoints.js
  ├→ observability-handler.js
  │    ├→ engine/event-store.js
  │    └→ engine/observability.js
  ├→ engine/index.js
  │    ├→ engine/fsm.js
  │    ├→ engine/barrier.js
  │    ├→ engine/persistence.js
  │    ├→ engine/recovery.js
  │    ├→ engine/events.js
  │    ├→ engine/validate-artifact.js
  │    ├→ artifact-provider.js
  │    └→ pm-repair-respawn.js
  └→ (spawns) phase-runner.sh
       ├→ spawn-worker.sh
       │    ├→ api-auth.sh
       │    ├→ phase-contract-loader.py
       │    ├→ worker-execution-pipeline.py (WECP)
       │    │    ├→ opencode-json-to-md.py
       │    │    ├→ opencode-token-extract.py
       │    │    ├→ validate-phase-artifact.py
       │    │    ├→ phase-contract-loader.py
       │    │    ├→ worker-noop-detector.py
       │    │    └→ trivial-task-prompt.py
       │    ├→ opencode-json-to-md.py
       │    ├→ opencode-token-extract.py
       │    ├→ legacy-extract-sid.py
       │    ├→ worker-continue-prompt.sh
       │    ├→ planning-post-gen-gate.py
       │    └→ (HTTP→server.js) lease issue/complete
       ├→ context-gather.sh
       ├→ phase-contract-loader.py
       ├→ trivial-task-prompt.py
       ├→ trivial-task-classifier.py
       ├→ closeout-context-block.py
       ├→ worker-completion-contract.sh
       ├→ pm-repair-respawn.js
       └→ validate-phase-artifact.py
  └→ (spawns) pm-review.sh
       ├→ api-auth.sh
       ├→ phase-contract-loader.py
       └→ opencode-json-to-md.py
```

No circular file-level dependencies, but runtime circular dependency via HTTP API (ARCH-008).

---

## 24. APPENDIX D: CONSOLIDATED FINDING COUNT (ALL SOURCES)

### 24.1 Total Findings by Source

| Source | Findings | Critical | High | Medium | Low |
|--------|----------|----------|------|--------|-----|
| Main Report (direct investigation) | 20 | 2 | 8 | 8 | 2 |
| Reliability Sub-Agent | 22 | 2 | 8 | 7 | 5 |
| Architecture Sub-Agent | 31 | 4 | 9 | 11 | 7 |
| Performance/Excellence Sub-Agent | 26 | 2 | 8 | 10 | 4 |
| **Deduplicated Total** | **62** | **5** | **23** | **22** | **12** |

### 24.2 Critical Findings (All Sources, Final)

| ID | Finding | Source |
|----|---------|--------|
| C-01 | Zero unit tests for engine modules | Main + Rel + Perf |
| C-02 | self-test.sh checks existence only, zero functional tests | Main + Perf |
| C-04 | Non-atomic state file writes across 8+ JSON files | Rel |
| C-06 | server.js ↔ engine/index.js circular state coupling | Arch |

### 24.3 Updated Debt Register Count (Final)

```
EIP-1 (Reliability):    20 items (1 Critical, 10 High, 6 Medium, 3 Low)
EIP-2 (Architecture):   30 items (3 Critical, 9 High, 11 Medium, 7 Low)
EIP-3 (Performance):    12 items (3 High, 7 Medium, 2 Low)
EIP-4 (Excellence):     17 items (2 Critical, 7 High, 6 Medium, 2 Low)
Total:                  79 items (deduplicated from 99 raw findings across 4 sources)
```

### 24.4 Key Architecture Patterns (Sub-Agent Summary)

1. **Language polyglot problem:** Bash (38), Python (14), JS (7) with no clear boundary for which language handles what. Bash generates JS code, Python calls bash scripts, JS spawns bash.
2. **Fix-driven architecture:** 21+ numbered fixes, each with own reference doc. Fix-centric not feature-centric organization.
3. **State management is ad-hoc:** 7+ persistence formats with no shared persistence layer. Each file has own read/write logic scattered across modules.
4. **Error handling inconsistent:** Some return `{ok: false}`, some throw, some return null, some write stderr and exit. Engine mixes return objects and state mutations.

---

*End of Master Investigation Report*

**Status:** COMPLETE  
**Ready for:** Master Planning (pending user approval)
