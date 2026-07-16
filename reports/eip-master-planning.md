# EIP MASTER PLANNING — IMPLEMENTATION ROADMAP

**Phase:** Master Planning  
**Date:** 2026-07-16  
**Status:** COMPLETE  
**Baseline:** Approved Master Investigation (remediated)  

---

## 1. MASTER IMPLEMENTATION STRATEGY

### 1.1 Philosophy

Fix what can crash first. Modularize what can't be tested. Optimize what's measurable. Document what's built.

Each EIP phase produces a verifiable, tested checkpoint. No phase begins until the previous phase's exit criteria are met. Every change is incremental and reversible.

### 1.2 Execution Strategy

```
EIP-1 (Reliability) ──┐
                       ├──► EIP-3 (Performance)
EIP-2 (Architecture) ──┤
                       └──► EIP-4 (Excellence)
```

EIP-1 and EIP-2 run in parallel — no blocking dependency between them. EIP-3 waits for EIP-1 (need stable behavior before optimizing). EIP-4 waits for EIP-2 (need modular boundaries before testing).

### 1.3 Dependency Strategy

- Atomic writes (C-04) must precede circular coupling refactor (C-06)
- Server.js modularization (EIP-2.1) must precede input validation middleware (EIP-4.5)
- Engine modularization (EIP-2.2) must precede engine tests (EIP-4.1)
- durationSec fix (EIP-3.1) must be first in EIP-3 — can't measure perf without it
- Shell injection fix (EIP-4.7) must precede EIP-2 script refactoring

### 1.4 Risk Mitigation Strategy

| Risk | Mitigation |
|------|-----------|
| Regression (no tests) | Run self-test.sh before AND after every change; diff results |
| Scope creep | Each work item has explicit exit criteria; no extras |
| State corruption during refactor | Backup .aic/ before each EIP-2 work item |
| False findings | Every finding already evidence-verified during investigation |
| Perf can't be measured | Fix durationSec FIRST in EIP-3 |

### 1.5 Quality Strategy

Every work item follows: investigate → implement → verify (self-test + manual) → report. No work item is "done" until self-test.sh passes with identical or better results than before.

---

## 2. EIP EXECUTION PLANS

### 2.1 EIP-1 — Engineering Reliability

**Objective:** Eliminate silent failures, state corruption, and unreliable lifecycle behavior.

**Scope:** 20 findings (1 Critical, 10 High, 6 Medium, 3 Low)

**Included findings:**
C-04, R-01, R-02, R-03, R-04, R-05, R-06, R-07, R-08, R-09, REL-02, REL-03, REL-04, REL-05, REL-06, REL-07, REL-10, REL-11, REL-12, REL-13, REL-14, REL-15, REL-16, REL-17, REL-18, REL-19, ARCH-035

**Excluded findings:** All EIP-2/3/4 findings.

**Implementation approach:** Low-risk, high-impact fixes first. Each fix is isolated — one file or one pattern at a time.

**Dependencies:** None (EIP-1 is foundational)

**Risks:**
- State file changes may break recovery.js → test recovery after atomic write fix
- Exit code changes may break engine interpretation → test pm-review.sh after exit code fix

**Deliverables:**
- Modified scripts with set -euo pipefail
- Modified engine modules with try/catch
- Atomic write utility
- Task cleanup logic
- Exit code documentation

**Success Criteria:**
- SC-1.1: All 38 shell scripts have `set -euo pipefail`
- SC-1.2: All 7 engine JS modules have try/catch
- SC-1.3: All state writes use temp+rename pattern
- SC-1.4: No stale tasks after terminal state reached
- SC-1.5: Exit codes documented and consistent (0=pass, 1=fail, 2=blocked)
- SC-1.6: self-test.sh passes before and after all changes

**Exit Criteria:**
- EC-1.1: `grep -L "set -euo pipefail" scripts/*.sh` returns empty
- EC-1.2: All engine modules have at least one try/catch block
- EC-1.3: `grep -rn "writeFileSync" scripts/` shows no direct writes to state files (all go through atomic utility)
- EC-1.4: `canAdvance()` has explicit guard conditions with tests
- EC-1.5: enterprise-endpoints.js:32 syntax bug fixed
- EC-1.6: self-test.sh passes

---

### 2.2 EIP-2 — Engineering Architecture

**Objective:** Decompose monoliths, consolidate documentation, establish clear module boundaries.

**Scope:** 30 findings (3 Critical, 9 High, 11 Medium, 7 Low)

**Included findings:**
C-06, C-07(ARCH-011), A-01, A-02, A-03, A-04, A-05, A-06, A-07, A-08, A-09, A-10, ARCH-003, ARCH-004, ARCH-005, ARCH-007, ARCH-008, ARCH-009, ARCH-010, ARCH-012, ARCH-013, ARCH-014, ARCH-015, ARCH-016, ARCH-017, ARCH-018, ARCH-019, ARCH-020, ARCH-021, ARCH-022, ARCH-023, ARCH-024, ARCH-025, ARCH-026, ARCH-027, ARCH-028, ARCH-029, ARCH-030, ARCH-031, ARCH-032, ARCH-033, ARCH-034, ARCH-036, V-02, M-01, M-02

**Excluded findings:** All EIP-1/3/4 findings.

**Implementation approach:** Refactor in layers — server.js first (route extraction), then engine/index.js (function decomposition), then reference docs (consolidation). Each refactoring step keeps functionality identical.

**Dependencies:**
- C-04 (atomic writes) must be done first (EIP-1)
- Shell injection fix (EIP-4.7) should be done before script refactoring

**Risks:**
- server.js refactor may break API → test each endpoint after extraction
- Doc consolidation may lose information → diff before/after
- Engine refactor may change behavior → FSM transition tests

**Deliverables:**
- server.js split into route modules
- engine/index.js split into sub-modules
- Consolidated reference docs (~40 from 163)
- Centralized config module
- Documented interface contracts
- Coding standards document

**Success Criteria:**
- SC-2.1: server.js < 300 lines (routes extracted to modules)
- SC-2.2: engine/index.js < 300 lines (functions extracted to modules)
- SC-2.3: Reference docs < 60 (from 163, after consolidation)
- SC-2.4: No duplicated functions across scripts
- SC-2.5: Interface contracts documented
- SC-2.6: self-test.sh passes

**Exit Criteria:**
- EC-2.1: `wc -l scripts/server.js` < 300
- EC-2.2: `wc -l scripts/engine/index.js` < 300
- EC-2.3: `find references -name "*.md" | wc -l` < 60
- EC-2.4: No duplicated `percentile()`, `readTaskContext()`, or `.env` loading
- EC-2.5: Interface contract document exists and covers env vars, file formats, HTTP API, exit codes
- EC-2.6: self-test.sh passes

---

### 2.3 EIP-3 — Engineering Performance

**Objective:** Reduce execution overhead, enable token budgeting, wire up dead caching code.

**Scope:** 12 findings (3 High, 7 Medium, 2 Low)

**Included findings:**
EXC-02(durationSec part), P-01, P-02, P-03, P-04, P-05, PERF-01, PERF-02, PERF-03, PERF-04, PERF-05, PERF-06, PERF-07, PERF-08, PERF-09, PERF-10, PERF-11

**Excluded findings:** All EIP-1/2/4 findings.

**Implementation approach:** Fix measurement first (durationSec), then eliminate dead code (wire cache-context.sh), then reduce subprocess spawns, then optimize prompts.

**Dependencies:** EIP-1 complete (reliable baseline needed)

**Risks:**
- Token budgeting may cut needed context → verify worker output quality
- Cache may serve stale context → add invalidation on git HEAD change

**Deliverables:**
- Fixed durationSec recording
- Wired cache-context.sh
- Reduced Python subprocess spawns
- Token budget enforcement
- Cache invalidation on writes

**Success Criteria:**
- SC-3.1: durationSec populated with actual values
- SC-3.2: cache-context.sh called by spawn-worker.sh
- SC-3.3: Python subprocess spawns per worker < 3 (from 6-8)
- SC-3.4: cachedRead invalidates on write operations

**Exit Criteria:**
- EC-3.1: `python3 -c "import json; d=json.load(open('.aic/metrics.json')); print(any(m['durationSec']>0 for m in d))"` returns True
- EC-3.2: `grep "cache-context" scripts/spawn-worker.sh` returns match
- EC-3.3: Worker spawn time profiled and documented
- EC-3.4: self-test.sh passes

---

### 2.4 EIP-4 — Engineering Excellence

**Objective:** Add test coverage, CI/CD, security hardening, documentation accuracy.

**Scope:** 17 findings (2 Critical, 7 High, 6 Medium, 2 Low)

**Included findings:**
C-01, C-02, E-01, E-02, E-03, E-04, E-05, REL-08, REL-09, EXC-01, EXC-02(benchmark part), EXC-03, EXC-04, EXC-05, EXC-06, EXC-07, EXC-08, EXC-09, EXC-10, EXC-11, EXC-12, EXC-13, EXC-14, EXC-15, D-01, D-02, D-03

**Excluded findings:** All EIP-1/2/3 findings.

**Implementation approach:** Security fixes first (injection, RBAC, /api/config), then test framework setup, then CI/CD, then documentation cleanup.

**Dependencies:** EIP-2 complete (modular boundaries needed for testing)

**Risks:**
- Test framework setup may conflict with existing scripts → use vitest (Node.js native)
- Security fixes may break API consumers → test endpoints after auth changes

**Deliverables:**
- vitest test suite for engine modules
- GitHub Actions CI pipeline
- Fixed security vulnerabilities
- Git hygiene (all files tracked)
- Version alignment (3.3.0 everywhere)
- Documentation cleanup

**Success Criteria:**
- SC-4.1: vitest installed and configured
- SC-4.2: FSM, barrier, auth, validate-artifact have unit tests
- SC-4.3: CI pipeline runs on push
- SC-4.4: No shell variable injection in knowledge scripts
- SC-4.5: RBAC fail-open fixed (fail-closed)
- SC-4.6: /api/config requires auth
- SC-4.7: All versions say 3.3.0

**Exit Criteria:**
- EC-4.1: `npx vitest run` passes with >0 tests
- EC-4.2: `.github/workflows/ci.yml` exists and runs self-test.sh
- EC-4.3: `git status --short | grep "^??" | wc -l` = 0
- EC-4.4: `grep -rn "Bearer \*\*\*" scripts/detect-context.sh` returns empty
- EC-4.5: `grep "allow request to proceed" scripts/server.js` returns empty
- EC-4.6: `grep "3.1.3" scripts/server.js dashboard/package.json README.md` returns empty
- EC-4.7: self-test.sh passes

---

## 3. CROSS-PHASE DEPENDENCY MATRIX

### 3.1 Blocking Dependencies

| From | To | Reason |
|------|----|--------|
| EIP-1.3 (atomic writes) | EIP-2.1 (server refactor) | Can't refactor state management without atomic writes |
| EIP-1.3 (atomic writes) | EIP-2.2 (engine refactor) | Same — engine writes state |
| EIP-2.1 (server modular) | EIP-4.5 (input validation) | Need route modules before middleware |
| EIP-2.2 (engine modular) | EIP-4.1 (engine tests) | Need testable boundaries |
| EIP-4.7 (injection fix) | EIP-2.3 (doc consolidation) | Scripts must be safe before refactoring docs about them |
| EIP-1 complete | EIP-3 start | Need stable behavior before measuring |
| EIP-2 complete | EIP-4 start | Need modular code before testing |

### 3.2 Parallel Opportunities

| Work Items | Can Run In Parallel Because |
|-----------|-----------------------------|
| EIP-1 + EIP-2 | No blocking dependency between reliability fixes and architecture refactoring |
| EIP-1.1 (set -e) + EIP-1.2 (try/catch) | Different files, no interaction |
| EIP-1.5 (FSM guards) + EIP-1.6 (exit codes) | Different concerns in different files |
| EIP-2.3 (doc consolidation) + EIP-2.1 (server refactor) | Docs and code are independent |

### 3.3 Shared Implementation

| Shared Work | Benefits |
|-------------|----------|
| Atomic write utility | Used by EIP-1.3 (reliability) AND EIP-2.1/2.2 (architecture refactor) |
| Interface contract document | Used by EIP-2.5 (architecture) AND EIP-4.6 (documentation) |
| Self-test.sh expansion | Used by EIP-1 (verification) AND EIP-4.2 (test framework) |
| Config centralization | Used by EIP-2.4 (architecture) AND EIP-4.7 (security) |

---

## 4. ENGINEERING IMPLEMENTATION ROADMAP

### 4.1 Implementation Order

```
Phase 0: Prerequisites (before any EIP work)
  P-01: Backup .aic/ state files
  P-02: Run self-test.sh and record baseline output

Phase 1: EIP-1 (Reliability) — Estimated: 10 work items
  1.01: Add set -euo pipefail to 4 scripts                    [Low effort]
  1.02: Add try/catch to 4 engine modules                      [Low effort]
  1.03: Create atomic write utility (writeJsonSafe)           [Low effort]
  1.04: Apply atomic writes to all state files                 [Medium effort]
  1.05: Implement task auto-cleanup on terminal states         [Low effort]
  1.06: Fix state.json/status field synchronization            [Low effort]
  1.07: Fix FSM canAdvance() logic + add guards                [Low effort]
  1.08: Standardize exit codes + document                      [Low effort]
  1.09: Fix enterprise-endpoints.js:32 syntax bug              [Low effort]
  1.10: Fix recovery.js to handle all phase statuses           [Medium effort]
  1.11: Fix task.cancel to stop pipeline                       [Low effort]
  1.12: Fix task.resume to resume from checkpoint               [Medium effort]
  1.13: Fix spawn-worker.sh lease completion (remove || true)   [Low effort]
  1.14: Fix pm-repair-respawn.js delete error handling          [Low effort]
  1.15: Fix queue.sh file locking                              [Low effort]
  1.16: Fix health-check.sh HEALTH_FILE export                  [Low effort]
  1.17: Fix validate-framework-invariants.sh arg validation    [Low effort]
  1.18: Fix recovery.sh recursion guard + server restart       [Low effort]
  1.19: Fix barrier timeout enforcement                        [Low effort]
  1.20: Fix graceful shutdown double-save                      [Low effort]
  ► GATE: Run self-test.sh, verify no regression → User approval

Phase 2: EIP-2 (Architecture) — Estimated: 12 work items (PARALLEL with EIP-1)
  2.01: Extract server.js routes into route modules             [High effort]
  2.02: Decompose engine/index.js into sub-modules             [High effort]
  2.03: Consolidate reference docs (163 → ~50)                  [High effort]
  2.04: Centralize configuration (single config module)        [Medium effort]
  2.05: Extract shared utilities (percentile, readTaskContext)  [Low effort]
  2.06: Extract opencode runner pattern (shared module)         [Low effort]
  2.07: Fix archive/reference path mismatches                   [Low effort]
  2.08: Consolidate duplicate validators                        [Low effort]
  2.09: Add coding standards document                           [Low effort]
  2.10: Document interface contracts                            [Medium effort]
  2.11: Fix PHASE_PLANS/PHASE_ALLOWED duplication               [Low effort]
  2.12: Fix dashboard layout system (remove unused)             [Low effort]
  ► GATE: Run self-test.sh, verify API endpoints → User approval

Phase 3: EIP-3 (Performance) — Estimated: 6 work items (after EIP-1)
  3.01: Fix durationSec recording (populate actual timing)      [Low effort]
  3.02: Wire cache-context.sh into spawn-worker.sh              [Low effort]
  3.03: Consolidate Python subprocess calls (use jq or single py) [Medium effort]
  3.04: Fix cachedRead write invalidation                       [Low effort]
  3.05: Fix API key caching (read once per script invocation)  [Low effort]
  3.06: Fix detect-context.sh bearer token (use actual key)     [Low effort]
  3.07: Fix health-check.sh opencode permission check           [Low effort]
  3.08: Fix Cache-Control on static assets                      [Low effort]
  ► GATE: Profile worker spawn time, verify improvement → User approval

Phase 4: EIP-4 (Excellence) — Estimated: 10 work items (after EIP-2)
  4.01: Fix shell injection in 8 knowledge scripts              [Medium effort]
  4.02: Fix RBAC fail-open (change to fail-closed)              [Low effort]
  4.03: Fix /api/config auth requirement                         [Low effort]
  4.04: Fix detect-context.sh literal *** bearer token           [Low effort]
  4.05: Install vitest + write engine unit tests                 [High effort]
  4.06: Create GitHub Actions CI pipeline                        [Low effort]
  4.07: Commit untracked files + git hygiene                     [Low effort]
  4.08: Align all versions to 3.3.0                               [Low effort]
  4.09: Fix SKILL.md duplicated sections                         [Low effort]
  4.10: Update docs/INDEX.md with accurate counts                 [Low effort]
  4.11: Remove __pycache__ from repo                              [Low effort]
  4.12: Add input validation middleware to server                 [Medium effort]
  ► GATE: Run full test suite + self-test.sh → User approval

Phase 5: Master Verification
  V-01: Full pipeline end-to-end test
  V-02: Cross-phase regression verification
  V-03: Performance comparison (before vs after)
  V-04: Final security review
  ► GATE: User approval → Master Closeout
```

### 4.2 Milestones

| Milestone | Gate | Criteria |
|-----------|------|----------|
| M0 | Planning approved | This document approved |
| M1 | EIP-1 complete | All EIP-1 exit criteria met |
| M2 | EIP-2 complete | All EIP-2 exit criteria met |
| M3 | EIP-3 complete | All EIP-3 exit criteria met |
| M4 | EIP-4 complete | All EIP-4 exit criteria met |
| M5 | Verification complete | Full pipeline test passes |
| M6 | Closeout | Final report delivered, version bumped |

### 4.3 Expected Outcomes

| Outcome | Before | After |
|---------|--------|-------|
| Shell scripts with set -e | 34/38 | 38/38 |
| Engine modules with try/catch | 3/7 | 7/7 |
| Unit tests | 0 | >10 |
| Reference docs | 163 | <60 |
| server.js lines | 1,038 | <300 |
| engine/index.js lines | 959 | <300 |
| Untracked git files | 28 | 0 |
| Version mismatch | 4-way | All 3.3.0 |
| Security vulnerabilities | 6+ | 0 |
| Performance baseline | None (durationSec=0) | Documented |

---

## 5. RISK MITIGATION PLAN

### 5.1 Critical Finding Mitigations

| Finding | Risk | Mitigation | Complexity |
|---------|------|------------|------------|
| C-01 (no tests) | Refactoring blind | Add tests BEFORE refactoring engine | High |
| C-02 (self-test weak) | False confidence | Expand self-test.sh in EIP-1 before other work | Low |
| C-04 (non-atomic writes) | State corruption during EIP work | Fix FIRST in EIP-1 before any state changes | Low |
| C-06 (circular coupling) | Refactor breaks state | Fix atomic writes first (C-04), then decouple incrementally | Medium |

### 5.2 High Finding Mitigations

| Finding | Risk | Mitigation | Complexity |
|---------|------|------------|------------|
| R-01 (no set -e) | Silent failures | Add to all scripts; test each one | Low |
| R-02 (no try/catch) | Server crashes | Add try/catch; verify error responses | Low |
| R-05 (stale tasks) | State drift | Add cleanup logic; test with stale data | Low |
| ARCH-035 (syntax bug) | Endpoint broken | Fix curly braces; test endpoint | Low |
| REL-08 (injection) | Code execution | Use env vars instead of interpolation | Medium |
| REL-09 (RBAC fail-open) | Auth bypass | Change to fail-closed; test auth | Low |
| EXC-07 (/api/config public) | Credential exposure | Add auth; test config endpoint | Low |
| EXC-03 (version mismatch) | Confusion | Update all files to 3.3.0 | Low |
| EXC-04 (SKILL.md bloat) | Token waste | Remove duplicated sections; split routing | Medium |
| EXC-06 (missing metrics) | Can't measure | Add duration tracking, phase latency | Medium |
| PERF-01 (subprocess spawns) | Slow pipeline | Replace with jq or single Python call | Medium |
| PERF-02 (dead cache) | Wasted I/O | Wire cache-context.sh into spawn-worker.sh | Low |
| PERF-04 (prompt assembly) | Slow startup | Consolidate into single Python orchestrator | Medium |
| ARCH-011 (config scatter) | Config drift | Create central config module | Medium |
| ARCH-016 (orphaned refs) | Doc confusion | Consolidate or archive | Low |
| ARCH-021 (dup functions) | Maintenance burden | Extract to shared module | Low |
| ARCH-023 (dup opencode runner) | Same | Extract to shared module | Low |
| ARCH-029 (no contracts) | Implicit deps | Document all interfaces | Medium |
| ARCH-003 (spawn-worker.sh) | Hard to maintain | Split into focused scripts | Medium |
| ARCH-007 (inconsistent handlers) | Breakage | Standardize handler interface | Low |
| ARCH-008 (HTTP circular dep) | Fragility | Call engine methods directly | Medium |
| ARCH-009 (PHASE_PLANS dup) | Drift | Use single source | Low |

### 5.3 Implementation Complexity Summary

| Complexity | Count | Examples |
|-----------|-------|---------|
| Low (< 1 hour) | 28 | set -e, try/catch, exit codes, version align |
| Medium (1-3 hours) | 14 | atomic writes, server refactor, doc consolidation |
| High (3+ hours) | 7 | engine tests, server modularization, engine decomposition |
| **Total** | **49** | |

---

## 6. SOURCE OF TRUTH UPDATE

### 6.1 Planning-Amended Facts

The Master Planning phase establishes:

1. **49 work items** across 4 EIP phases (EIP-1: 20, EIP-2: 12, EIP-3: 8, EIP-4: 12)
2. **Execution order:** EIP-1 + EIP-2 parallel → EIP-3 after EIP-1 → EIP-4 after EIP-2
3. **3 blocking cross-phase dependencies** documented
4. **4 shared implementation opportunities** identified
5. **6 milestones** with explicit gate criteria
6. **All success/exit criteria are measurable** (grep commands, line counts, test results)

### 6.2 Authoritative Planning Documents

| Document | Path | Authority |
|----------|------|-----------|
| Master Program | `reports/eip-master-program.md` | Charter, scope, governance |
| Master Investigation (final) | `reports/eip-master-investigation.md` | Engineering baseline (62 findings) |
| Investigation Review | `reports/eip-investigation-review.md` | Review conditions and corrections |
| Remediation Report | `reports/eip-remediation-report.md` | Remediation record |
| Master Planning (this file) | `reports/eip-master-planning.md` | Implementation roadmap |

---

## PLANNING VALIDATION

| Check | Result |
|-------|--------|
| Every approved finding assigned to an EIP? | ✅ Yes — all 62 findings mapped |
| No finding duplicated? | ✅ Yes — deduplicated during investigation |
| No finding omitted? | ✅ Yes — all findings from all 4 sources included |
| Every dependency documented? | ✅ Yes — Section 3 covers all cross-phase deps |
| Every objective measurable? | ✅ Yes — grep/wc/test commands defined |
| Every Success Criterion measurable? | ✅ Yes — specific commands provided |
| Every Exit Criterion measurable? | ✅ Yes — specific commands provided |
| Roadmap internally consistent? | ✅ Yes — parallel/sequential order validated |

---

**DECISION:** READY FOR IMPLEMENTATION

---

*End of Master Planning*
