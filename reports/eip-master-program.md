# ENGINEERING IMPROVEMENT PROGRAM — MASTER PROGRAM

**Status:** CLOSED — Engineering Improvement Program Complete  
**Date:** 2026-07-16  
**Final Phase:** Master Closeout  
**Program Manager:** Hermes (TVD Assistant)  
**Target Repository:** AIC Skill (`~/.hermes/skills/workflows/aic`)  
**Final Version:** 3.3.0  
**Engineering Maturity:** Level 3 (Defined)  

---

## 1. CHARTER

### 1.1 Purpose

This charter establishes the Engineering Improvement Program (EIP) for the AIC Skill repository — a 15-worker orchestration system built as a Hermes skill. The program is a structured initiative to systematically improve engineering quality across four dimensions: reliability, architecture, performance, and excellence.

### 1.2 Mission

Raise the engineering maturity of the AIC Skill repository from its current operational-but-organic state to a disciplined, well-tested, observable, and maintainable engineering artifact — without changing its purpose, workflow philosophy, or user-facing behavior.

### 1.3 Authority

This program operates under PM authority. All phases require explicit approval before proceeding. No code changes are made during the Master Program phase. Changes are gated: investigate first, report second, execute only upon approval.

### 1.4 Scope Boundary Statement

This program addresses engineering quality only. It does NOT change what the system does, how users interact with it, or the operational workflow model. Feature development, runtime redesign, new repositories, SaaS considerations, and breaking architectural changes are explicitly out of scope.

### 1.5 Success Definition

The program succeeds when:
- Every phase completes with its exit criteria met
- All existing functionality passes regression verification
- The repository has deterministic validation, clean architecture boundaries, efficient execution, and production-grade observability
- No regression in user-facing behavior

---

## 2. ENGINEERING IMPROVEMENT SCOPE

### 2.1 In Scope

| Area | What Will Be Improved |
|------|----------------------|
| Scripts | `scripts/` — 57 scripts (JS/SH/PY) covering pipeline, workers, validation, auth, metrics, knowledge, context |
| Engine | `scripts/engine/` — FSM, events, barriers, persistence, recovery, observability, artifact validation |
| References | `references/` — 130+ reference documents (consolidation, deduplication, contract clarity) |
| Dashboard | `dashboard/` — Frontend UI (Tailwind, PostCSS) |
| Documentation | `SKILL.md`, `docs/`, `README.md`, `CHANGELOG.md`, `AGENTS.md` |
| Runtime State | `.aic/` — state management, task isolation, auth, health checks |
| Templates | `templates/` — phase templates, artifact templates |
| CI/Quality | Validation scripts, invariants checks, self-test, framework invariants |
| Archive | `archive/` — historical baselines and defect records (review only, no changes unless consolidation needed) |

### 2.2 Out of Scope

- New features or workflow redesign
- Standalone runtime extraction
- SaaS/marketplace/business model
- Breaking changes to the 15-worker model or pipeline phases
- New repository structure or migration
- Changing the Hermes skill integration model
- Model provider configuration (unless engineering quality issue)

### 2.3 Repository Inventory (Baseline Snapshot)

```
Component              Count    Notes
─────────────────────────────────────────────────
Total files            ~277     Excluding .git
Scripts                57       .js, .sh, .py
Engine modules         7        scripts/engine/
Reference docs         130+     references/
Dashboard assets       ~20      dashboard/
Templates              ~10      templates/
Archive artifacts      ~50      archive/
Runtime state files    ~30      .aic/
Repository size        144MB    Excluding .git
Languages              3        JavaScript, Shell, Python
External deps          Node.js  (server, engine, auth, metrics)
```

---

## 3. ENGINEERING OBJECTIVES

### 3.1 EIP-1 — Engineering Reliability

**Objective:** Improve deterministic behavior, validation robustness, workflow integrity, execution stability, and engineering correctness.

Key focus areas:
- Deterministic state machine transitions (FSM)
- Consistent worker completion contracts
- Robust error handling and exit code semantics
- Pipeline orchestrator reliability
- Artifact validation correctness
- Task isolation and cleanup
- Auth token lifecycle management

### 3.2 EIP-2 — Engineering Architecture

**Objective:** Improve modularity, maintainability, architectural boundaries, internal contracts, dependency management, and scalability.

Key focus areas:
- Script modularity and single-responsibility
- Reference document organization and deduplication
- Internal API contracts between scripts
- Configuration management consolidation
- Clear separation of concerns (engine vs. orchestration vs. validation)
- Dependency graph clarity
- Template and pattern reuse

### 3.3 EIP-3 — Engineering Performance

**Objective:** Improve execution efficiency, context efficiency, resource utilization, workflow throughput, and token efficiency.

Key focus areas:
- Script execution overhead reduction
- Context gathering and caching efficiency
- Token consumption optimization in worker prompts
- Pipeline phase transition latency
- Knowledge subsystem query efficiency
- Dashboard rendering performance
- Concurrent task resource management

### 3.4 EIP-4 — Engineering Excellence

**Objective:** Achieve production-grade engineering quality through comprehensive testing, documentation, observability, profiling, and overall maturity.

Key focus areas:
- Test coverage for critical paths
- Benchmarking pipeline throughput
- Documentation completeness and accuracy
- Observability and metrics dashboards
- Profiling hotspots
- Security audit (auth, PAT injection, input validation)
- Engineering maturity assessment

---

## 4. ENGINEERING SUCCESS CRITERIA

### 4.1 Program-Level Success Criteria

| ID | Criterion | Measurable Target |
|----|-----------|-------------------|
| SC-01 | No functional regression | All existing workflows produce identical user-facing outcomes |
| SC-02 | Deterministic pipeline | Pipeline produces same output for same input across 3 consecutive runs |
| SC-03 | Validation coverage | All phase transitions validated; all artifacts schema-checked |
| SC-04 | Architectural clarity | Every script has a clear contract; no ambiguous responsibilities |
| SC-05 | Performance baseline | Pipeline execution time documented; no >10% regression |
| SC-06 | Test coverage | Critical path scripts have automated tests |
| SC-07 | Documentation currency | All docs reflect post-improvement state; no stale references |
| SC-08 | Observability | Key metrics (phase duration, token usage, error rate) are trackable |

### 4.2 Per-Phase Success Criteria

Defined in the Exit Criteria section below.

---

## 5. ENGINEERING EXIT CRITERIA

### 5.1 EIP-1 Exit Criteria

| ID | Criterion |
|----|-----------|
| EC-1.1 | All FSM transitions are validated with explicit guard conditions |
| EC-1.2 | Worker completion contracts are consistent across all 15 workers |
| EC-1.3 | Exit codes follow documented semantics (0=pass, 1=fail, 2=blocked) with no ambiguity |
| EC-1.4 | Pipeline orchestrator handles all known failure modes (stale tasks, timeouts, auth expiry) |
| EC-1.5 | Artifact validation catches schema violations before phase transitions |
| EC-1.6 | Task cleanup on abnormal termination is verified |
| EC-1.7 | Regression test confirms existing workflows are preserved |

### 5.2 EIP-2 Exit Criteria

| ID | Criterion |
|----|-----------|
| EC-2.1 | No script has more than one clear responsibility |
| EC-2.2 | Internal contracts between scripts are documented |
| EC-2.3 | Reference documents are deduplicated; no conflicting guidance |
| EC-2.4 | Configuration is consolidated (no scattered config sources) |
| EC-2.5 | Dependency graph is documented and acyclic |
| EC-2.6 | Archive contains only historical artifacts; active code has no dead references to archived paths |

### 5.3 EIP-3 Exit Criteria

| ID | Criterion |
|----|-----------|
| EC-3.1 | Pipeline baseline timing is documented |
| EC-3.2 | Context caching reduces redundant reads by measurable amount |
| EC-3.3 | Token usage per worker prompt is optimized without changing output quality |
| EC-3.4 | No script has unnecessary I/O or subprocess overhead |
| EC-3.5 | Dashboard load time is profiled and optimized where obvious wins exist |

### 5.4 EIP-4 Exit Criteria

| ID | Criterion |
|----|-----------|
| EC-4.1 | Critical path scripts have automated tests that pass |
| EC-4.2 | Benchmark suite exists for pipeline throughput |
| EC-4.3 | Documentation is reviewed for accuracy and completeness |
| EC-4.4 | Key metrics are exposed via observability endpoints |
| EC-4.5 | Security review completed for auth, PAT handling, and input validation |
| EC-4.6 | Engineering maturity assessment documented |

---

## 6. ENGINEERING GOVERNANCE

### 6.1 Decision Authority

| Decision Type | Authority | Process |
|---------------|-----------|---------|
| Phase gate approval | User (TVD) | PM presents results; user approves/rejects |
| Implementation approach | PM proposes, user approves | Investigate → Report → Await approval |
| Scope changes | User only | PM may recommend; user decides |
| Emergency fixes | PM proposes with evidence | User approves with expedited review |

### 6.2 Communication Protocol

- **Language:** Bahasa Indonesia (matching user preference)
- **Updates:** Proactive phase-transition notifications
- **Reports:** Written to `reports/eip-*` in the repository
- **Escalation:** Blockers reported immediately with root cause analysis

### 6.3 Quality Gates

Every phase follows this gate:

```
Phase Start → Investigation → Report → [GATE: User Approval] → Implementation → Verification → Phase Complete
```

No phase proceeds past the gate without explicit user approval.

### 6.4 Anti-Pattern Enforcement

These are strictly prohibited:
- Implementing without investigation
- Reporting "fixed" without verification evidence
- Auto-committing without approval
- Scope creep beyond engineering quality
- Destructive operations on uncommitted files

---

## 7. ENGINEERING PHASE DEFINITIONS

### Phase Sequence

```
Master Program (current)
    ↓
Master Investigation
    ↓
Master Planning
    ↓
Implementation
    ├── EIP-1: Engineering Reliability
    ├── EIP-2: Engineering Architecture
    ├── EIP-3: Engineering Performance
    └── EIP-4: Engineering Excellence
    ↓
Master Verification
    ↓
Master Closeout
```

### 7.1 Master Program (THIS PHASE)

**Purpose:** Establish the program charter, scope, objectives, governance, and source of truth.  
**Output:** This document (`eip-master-program.md`)  
**Gate:** User review and approval before proceeding  

### 7.2 Master Investigation

**Purpose:** Deep-dive into the repository to understand current state, identify engineering debt, catalog issues, and establish a factual baseline.  
**Activities:**
- Code quality audit (all 57 scripts)
- Architecture review (dependency graph, module boundaries)
- Test coverage assessment
- Documentation audit
- Performance profiling baseline
- Security surface review
- Known issue catalog from references (fix/imp/defect records)

**Output:** `eip-master-investigation.md` with findings, issue catalog, and priority matrix

### 7.3 Master Planning

**Purpose:** Translate investigation findings into a sequenced implementation plan with priorities, effort estimates, and risk mitigations.  
**Activities:**
- Prioritize findings by impact and effort
- Sequence work across EIP-1 through EIP-4
- Define work packages within each EIP
- Identify dependencies between work packages
- Estimate effort per work package

**Output:** `eip-master-plan.md` with sequenced work packages

### 7.4 EIP-1 through EIP-4 (Implementation)

Each EIP follows:
1. Investigation (scoped to that EIP's domain)
2. Planning (work packages for that EIP)
3. Implementation (code/doc changes)
4. Verification (regression testing, validation)
5. Phase report

### 7.5 Master Verification

**Purpose:** Cross-cutting verification that all EIP improvements work together without regression.  
**Activities:**
- Full pipeline end-to-end test
- Cross-phase dependency verification
- Performance comparison (before vs. after)
- Documentation completeness check
- Final security review

### 7.6 Master Closeout

**Purpose:** Formal program completion.  
**Activities:**
- Final report generation
- Lessons learned documentation
- Version bump and changelog
- Archive program artifacts

---

## 8. ENGINEERING DELIVERABLES

### 8.1 Program-Level Deliverables

| # | Deliverable | Phase | Format |
|---|-------------|-------|--------|
| D-01 | EIP Charter & Program Package | Master Program | `eip-master-program.md` (this file) |
| D-02 | Investigation Report | Master Investigation | `eip-master-investigation.md` |
| D-03 | Master Plan | Master Planning | `eip-master-plan.md` |
| D-04 | EIP-1 Reliability Report | EIP-1 | `eip-1-reliability.md` |
| D-05 | EIP-2 Architecture Report | EIP-2 | `eip-2-architecture.md` |
| D-06 | EIP-3 Performance Report | EIP-3 | `eip-3-performance.md` |
| D-07 | EIP-4 Excellence Report | EIP-4 | `eip-4-excellence.md` |
| D-08 | Verification Report | Master Verification | `eip-verification.md` |
| D-09 | Closeout Report | Master Closeout | `eip-closeout.md` |

### 8.2 Per-Phase Artifact Deliverables

Each implementation phase produces:
- Modified/new source files (scripts, docs, configs)
- Test files (where applicable)
- Phase report with before/after evidence
- Regression verification results

---

## 9. ENGINEERING RISKS

### 9.1 Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R-01 | Regression in pipeline behavior during reliability improvements | Medium | High | Mandatory regression test after every change; backup before destructive ops |
| R-02 | Reference document consolidation introduces conflicting guidance | Medium | Medium | Cross-reference validation; user review of merged docs |
| R-03 | Performance optimization changes behavior | Low | High | Functional equivalence tests before/after optimization |
| R-04 | Scope creep into feature development | Medium | Medium | Strict scope gate at each phase; PM enforces boundary |
| R-05 | Context window overflow during investigation (130+ reference docs) | High | Low | Phased investigation; delegate sub-agents for parallel analysis |
| R-06 | Breaking changes to server API (localhost:6868) | Low | High | API contract tests; no endpoint changes without verification |
| R-07 | Auth/token lifecycle disruption | Low | High | Auth changes isolated and tested separately |
| R-08 | Archive artifacts accidentally modified | Low | Medium | Read-only review of archive/; changes only with explicit approval |
| R-09 | Dashboard regression during optimization | Medium | Medium | Visual verification after dashboard changes |
| R-10 | Inter-script contract changes cascade unexpectedly | Medium | High | Dependency mapping before changes; change isolation per work package |

### 9.2 Risk Response Strategy

- **High-impact risks:** Mandatory pre-change backup, post-change verification, user approval gate
- **Medium-impact risks:** Investigation report with risk assessment before proceeding
- **Low-impact risks:** Standard review process

---

## 10. ENGINEERING CONSTRAINTS

| ID | Constraint | Impact |
|----|-----------|--------|
| C-01 | Must preserve all existing functionality | No behavioral changes allowed |
| C-02 | Must maintain Hermes skill integration model | Cannot restructure as standalone project |
| C-03 | Must preserve the 15-worker orchestration model | Cannot redesign worker architecture |
| C-04 | Must maintain pipeline phase sequence | Investigate → Plan → Implement → Verify → Closeout |
| C-05 | Must operate within PM authority model | All changes require approval |
| C-06 | Must maintain compatibility with Node.js runtime | Engine and server scripts depend on Node |
| C-07 | Must not break dashboard functionality | Users depend on dash.aicompany.biz.id |
| C-08 | Must preserve .aic/ runtime contract | Server reads state from .aic/ |
| C-09 | Smart Approval blocks dotfile writes | GitHub PAT injection pattern must be preserved |
| C-10 | Changes must be incremental and reversible | No big-bang rewrites |

---

## 11. ENGINEERING ASSUMPTIONS

| ID | Assumption | Risk if Wrong |
|----|-----------|---------------|
| A-01 | The repository is under git version control | Cannot rollback changes safely |
| A-02 | Node.js runtime is available on the host | Engine and server scripts cannot execute |
| A-03 | The AIC server (localhost:6868) can be stopped/started for testing | Cannot verify server-side changes |
| A-04 | User will review and approve each phase gate | Program stalls at each gate |
| A-05 | The 15-worker model is stable and not being redesigned | EIP-2 architecture changes may conflict |
| A-06 | Hermes agent context window is sufficient for investigation | May need to delegate sub-agents |
| A-07 | Existing archive/ artifacts are read-only reference | Consolidation scope is larger than expected |
| A-08 | Python 3.12 and shell tools are available for running scripts | Script execution environment gaps |
| A-09 | Dashboard source is in-repo and deployable independently | Cannot verify frontend changes |
| A-10 | Current version 3.3.0 is the baseline | Version alignment issues with existing docs |

---

## 12. ENGINEERING DEPENDENCIES

### 12.1 Internal Dependencies

| Dependency | Depends On | Depended By |
|-----------|-----------|------------|
| Engine FSM | scripts/engine/fsm.js | pipeline-orchestrator.sh, phase-runner.sh |
| Artifact validation | validate-artifact.js, validate-phase-artifact.py | Phase transitions, closeout |
| Worker spawn | spawn-worker.sh | All worker invocations |
| Auth system | auth.js, api-auth.sh, .aic/auth.json | Server, API calls, dashboard |
| Config system | config.sh, .env | All scripts requiring API keys/endpoints |
| Knowledge subsystem | knowledge-*.sh (8 scripts) | Context gathering, lessons learned |
| Observability | observability-handler.js, metrics.sh | Dashboard, monitoring |
| Server | server.js | All API endpoints, dashboard backend |
| PM review | pm-review.sh, pm-repair-respawn.js | Pipeline quality gates |
| Context system | context-gather.sh, cache-context.sh, detect-context.sh | Worker prompt assembly |

### 12.2 External Dependencies

| Dependency | Purpose | Version/Status |
|-----------|---------|---------------|
| Node.js | Server runtime, engine execution | Required |
| Python 3 | Validation scripts, context processing | 3.12.3 (confirmed) |
| Shell (bash) | Pipeline orchestration, worker spawning | Required |
| Hermes Agent | Skill host platform | Current |
| Git | Version control | Required |
| OpenCode | Worker implementation tool | Required (`opencode --version` check) |

### 12.3 Cross-Phase Dependencies

```
EIP-1 (Reliability) must complete before EIP-3 (Performance)
  — Reliable behavior must be established before optimizing

EIP-2 (Architecture) must complete before EIP-4 (Excellence)
  — Clean architecture enables proper testing and documentation

EIP-1 and EIP-2 can proceed in parallel if resources allow
  — No direct dependency between reliability and architecture work

EIP-3 and EIP-4 depend on EIP-1 and EIP-2 respectively
  — Performance requires reliable baseline; excellence requires clean architecture
```

---

## 13. ENGINEERING ROADMAP

### 13.1 Phase Sequence and Estimated Effort

```
Phase                        Effort     Dependencies
─────────────────────────────────────────────────────────
Master Program               DONE       None
Master Investigation         Medium     Master Program approval
Master Planning              Medium     Investigation complete
EIP-1 Reliability            High       Master Planning complete
EIP-2 Architecture           High       Master Planning complete (parallel with EIP-1)
EIP-3 Performance            Medium     EIP-1 complete
EIP-4 Excellence             High       EIP-2 complete
Master Verification          Medium     All EIPs complete
Master Closeout              Low        Verification complete
```

### 13.2 Execution Strategy

```
Sequential gates:
  Master Program → [APPROVE] → Investigation → [APPROVE] → Planning → [APPROVE]

Parallel implementation (if approved):
  EIP-1 ─────┐
              ├──→ EIP-3 → Master Verification → Master Closeout
  EIP-2 ─────┘
         └──────────→ EIP-4 ──┘
```

### 13.3 Milestones

| Milestone | Gate | Criteria |
|-----------|------|----------|
| M0: Program Approved | User approves this document | This document reviewed and accepted |
| M1: Investigation Complete | Findings documented | All scripts, docs, and architecture reviewed |
| M2: Plan Approved | Work packages sequenced | Priorities, estimates, and dependencies mapped |
| M3: EIP-1 Complete | Reliability verified | Exit criteria EC-1.1 through EC-1.7 met |
| M4: EIP-2 Complete | Architecture verified | Exit criteria EC-2.1 through EC-2.6 met |
| M5: EIP-3 Complete | Performance verified | Exit criteria EC-3.1 through EC-3.5 met |
| M6: EIP-4 Complete | Excellence verified | Exit criteria EC-4.1 through EC-4.6 met |
| M7: Program Verified | Cross-cutting verification | Full pipeline regression test passes |
| M8: Program Closed | Closeout approved | Final report delivered, version bumped |

---

## 14. SOURCE OF TRUTH (SoT)

### 14.1 Purpose

This section establishes the authoritative reference for every subsequent phase of the Engineering Improvement Program. All future phases SHALL reference this SoT for scope, objectives, constraints, and governance.

### 14.2 Authoritative Documents

| Document | Path | Authority |
|----------|------|-----------|
| Master Program (this file) | `reports/eip-master-program.md` | Program charter, scope, governance |
| Investigation Report | `reports/eip-master-investigation.md` | Current state baseline, findings |
| Master Plan | `reports/eip-master-plan.md` | Implementation sequencing |
| SKILL.md | `SKILL.md` | AIC system specification |
| Architecture Invariants | `references/architecture-invariants-v3.md` | Architectural rules |
| Dispatcher Discipline | `references/dispatcher-spawn-policy.md` (via SKILL.md) | Behavioral rules |
| Runtime Gate System | `references/runtime-gate-system.md` | Pipeline gates |
| Worker Registry | `references/worker-registry.md` | Worker definitions |
| Release Process | `references/release-process.md` | Versioning rules |
| EDP Spec | `references/engineering-decision-package-spec.md` | Decision package format |

### 14.3 SoT Resolution Rules

1. **This document** is the top-level authority for the EIP program scope and governance
2. **SKILL.md** is the authority for how the AIC system works
3. **Investigation findings** supersede assumptions in this document when evidence contradicts them
4. **Per-phase reports** are the authority for what was actually done in each phase
5. **Conflict resolution:** When documents disagree, the later-phase document wins (investigation supersedes program assumptions, plan supersedes investigation estimates)

### 14.3 SoT Update Protocol

- Investigation phase may amend assumptions in this document (Section 11) if evidence warrants
- Planning phase may amend effort estimates (Section 13) based on investigation findings
- Scope changes require explicit user approval and an addendum to this document
- All amendments are logged in the phase report that triggered them

### 14.5 Investigation-Amended Facts (2026-07-16)

The Master Investigation (reports/eip-master-investigation.md) established these verified facts, superseding prior estimates:

1. Reference docs: 160 (was ~130+), 10,084 total lines
2. Scripts: 57 confirmed, 8,689 total lines (JS:18, SH:56, PY:14)
3. Dashboard: 36 source files, React 18 + TS + Vite, package.json v3.1.3 (mismatch with SKILL.md v3.3.0)
4. Dashboard node_modules: 138MB local (correctly gitignored, NOT tracked)
5. Unit tests: ZERO for engine modules; self-test.sh is config-checking only (111 lines)
6. server.js: 1,038-line monolith with inline routing
7. engine/index.js: 959-line monolith
8. FSM: 84 lines, canAdvance() has operator-precedence logic fragility
9. Stale tasks: 11 in .aic/tasks/ (9 CANCELLED, 1 BLOCKED, 1 PLANNING — all status="active")
10. Git: 28 untracked files, 2 modified, only 6 commits visible
11. No CI/CD, no test framework, no coding standards doc
12. 4 shell scripts without set -e; 4 engine JS modules without try/catch
13. Archive/pitfalls/ docs referenced by SKILL.md but not in references/ (path mismatch)
14. 20 technical debt items identified, classified across EIP-1 through EIP-4
15. 27 work items in recommended EIP backlog with effort estimates

### 14.6 Investigation-Amended Critical Findings (Sub-Agent Verified, 2026-07-16)

Sub-agent deep-dive investigations revealed additional critical/high findings beyond the main report:

**Critical (5):**
1. C-01: Zero unit tests for engine modules (all sources confirm)
2. C-02: self-test.sh checks file existence only, zero functional tests
3. C-03: `api-auth.sh:29` — broken string literal, closing `"` missing, corrupts all authenticated shell API calls
4. C-04: Non-atomic state file writes across 8+ JSON files — `fs.writeFileSync()` direct, no temp+rename, no file locking
5. C-05: No benchmarking — `durationSec` always 0 in all 27 metrics entries

**High (16, selected):**
- `task.cancel` doesn't stop running pipeline (engine/index.js:878-893)
- `task.resume` restarts from beginning, doesn't resume (engine/index.js:859-877)
- `spawn-worker.sh:249` lease completion suppressed by `|| true` — silent deadlock
- RBAC fail-open: `server.js:937` catch block allows all requests on error
- `/api/config` public endpoint exposes full .env including API keys
- Shell variable injection in all 8 knowledge scripts — arbitrary code execution
- `cache-context.sh` is dead code — never called by spawn-worker.sh
- 24-30 Python subprocess spawns per 3-worker phase = 2-3s pure overhead
- 4-way version mismatch: SKILL.md=3.3.0, server.js=3.1.3, README=3.1.3, CHANGELOG latest=[3.2.0]

**Updated debt total:** 79 items (deduplicated from 99 raw findings across 4 investigation sources)

### 14.7 Architecture Sub-Agent Findings (2026-07-16)

The Architecture sub-agent produced 31 findings (4 Critical, 9 High, 11 Medium, 7 Low). Full report: `/home/tvd/aic-architecture-audit-report.md`.

**Additional Critical findings:**
- C-06: `server.js:242-260` ↔ `engine/index.js:68-78` — circular state coupling via callbacks, both mutate shared state object with no synchronization
- C-07: Configuration scattered across 6+ locations. `.env` parsed 7 different ways across 3 languages. `SKILL.md:25` references `.aic/config.json` which **does not exist**.

**Additional High findings:**
- `enterprise-endpoints.js:32` — live syntax bug: missing curly braces, `return true` unconditional
- `fsm.js:15-28` PHASE_PLANS vs `server.js:670-676` PHASE_ALLOWED — duplicate concept, can drift
- `percentile()` and `buildLatencySli()` duplicated verbatim in server.js + ops-endpoints.js
- `readTaskContext()` duplicated in server.js + engine/index.js
- Node.js opencode runner pattern duplicated 4× across 3 files
- No documented interface contracts — 20+ env vars, 10+ file formats, all implicit
- 23 orphaned reference files not referenced in SKILL.md
- Engine spawns scripts that HTTP back into engine's own API (circular runtime dependency)
- `setup.sh:38` says "10-Worker" but system has 15
- RBAC enforcement at `server.js:907` is effectively dead code (placed after all routes)

**Architecture dependency graph** mapped and documented in Appendix C of investigation report.

---

## APPENDIX A: REPOSITORY STRUCTURE REFERENCE

```
~/.hermes/skills/workflows/aic/
├── SKILL.md                    # Primary system specification (606 lines)
├── README.md                   # Project readme
├── CHANGELOG.md                # Version history
├── AGENTS.md                   # Workspace rules (deprecated, compat)
├── LICENSE
├── .env / .env.example         # Environment configuration
├── requirements.json           # Dependency requirements
│
├── scripts/                    # 57 operational scripts
│   ├── engine/                 # Core engine (7 modules)
│   │   ├── fsm.js              # Finite state machine
│   │   ├── events.js           # Event system
│   │   ├── event-store.js      # Event persistence
│   │   ├── barrier.js          # Synchronization barriers
│   │   ├── persistence.js      # State persistence
│   │   ├── recovery.js         # Failure recovery
│   │   ├── observability.js    # Metrics and tracing
│   │   └── validate-artifact.js # Artifact validation
│   ├── server.js               # API server (localhost:6868)
│   ├── auth.js                 # Authentication
│   ├── pipeline-orchestrator.sh # Main pipeline control
│   ├── phase-runner.sh         # Phase execution
│   ├── spawn-worker.sh         # Worker spawning
│   ├── pm-review.sh            # PM quality gate
│   └── ... (50+ more scripts)
│
├── references/                 # 130+ reference documents
│   ├── architect-rules.md
│   ├── runtime-gate-system.md
│   ├── worker-registry.md
│   └── ... (128+ more docs)
│
├── dashboard/                  # Frontend UI
│   ├── postcss.config.js
│   └── tailwind.config.js
│
├── docs/                       # Documentation
│   ├── INDEX.md
│   └── wp-80-architecture-plan.md
│
├── templates/                  # Phase/artifact templates
│
├── reports/                    # Generated reports
│
├── archive/                    # Historical artifacts
│   ├── defects/
│   ├── milestones/
│   └── platform-experiments/
│
└── .aic/                       # Runtime state
    ├── auth.json               # API authentication
    ├── health.json             # Health status
    ├── state.json              # Global state
    ├── metrics.json            # Runtime metrics
    └── tasks/                  # Task-specific state
```

## APPENDIX B: GLOSSARY

| Term | Definition |
|------|-----------|
| AIC | AI Engineering Company — the 15-worker orchestration system |
| EIP | Engineering Improvement Program |
| FSM | Finite State Machine — engine/scripts/fsm.js |
| EDP | Engineering Decision Package |
| OAT | Operational Acceptance Test |
| PM | Project Manager (Hermes dispatcher role) |
| SoT | Source of Truth |
| WECP | Worker Execution Completion Protocol |
| Gate | Approval checkpoint between phases |
| Work Package | A scoped unit of work within an EIP phase |

---

## APPROVAL

**Document:** EIP Master Program v1.0  
**Prepared by:** Hermes (TVD Assistant)  
**Date:** 2026-07-16  

**Pending:** User (TVD) review and approval.

Upon approval, Master Investigation will begin.  
Upon rejection, this document will be revised per feedback.

---

*End of Master Program Package*
