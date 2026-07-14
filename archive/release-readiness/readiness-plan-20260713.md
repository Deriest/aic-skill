---
worker: pm
task_id: TASK-20260713-PLANNING-READINESS
phase: Planning
capability_profile: Thinker
started_at: 2026-07-13T00:00:00Z
completed_at: 2026-07-13T00:00:00Z
duration_seconds: 0
sub_workers_spawned: 0
self_validation: PASS
---

# Production Release Readiness Plan

**Target:** AIC-SKILL **v1.0.0** (production-ready initial release per `references/release-process.md`)  
**Repo:** `/home/tvd/.hermes/skills/workflows/aic` @ `7c973bb` (dirty: `SKILL.md`, `dashboard/src/types/index.ts`, `knowledge/task-entries.json`, `references/dispatcher-artifact-contracts.md`)  
**Planning date:** 2026-07-13

## Executive summary

Release readiness is **gated by evidence**, not by narrative. Canonical release prerequisites (`release-process.md`) require closed milestones, regression audit PASS, post-audit PASS, final release validation PASS, and a **clean git tree**. Operational smoke today: `./scripts/deploy.sh validate` → **4/4 PASS** (health, auth.json, projects.json, permissions.json) with server on port 6868.

**Primary gap:** Full **Enterprise Runtime OAT** (pipeline-orchestrator, real opencode workers, PM gates end-to-end) is **not proven green** on current HEAD in this session. Archive evidence (Milestone K) shows a prior PASS path; post-IMP-003/007/FIX-008 references document recurring BLOCKED/Planning contract failures (TASK-030/031). **Recommendation:** **DO NOT PROCEED** to tag `v1.0.0` until a **serialized** guarded Runtime OAT on current code PASSes and working tree is clean.

## Scope

| In scope | Out of scope |
|----------|----------------|
| Readiness checklist, work packages, verification matrix, risk register | Implementing fixes (Implementation phase) |
| Mapping to `release-process.md`, milestone closeout, WECP/PM contracts | GitHub release API execution |
| Dedup against existing `templates/release-*.md` and `references/release-process.md` | Committing dirty files |

**Note:** Task prompt cited `references/checklists/production-release-readiness.yaml`, `references/templates/readiness-plan.md`, and `references/dedup-rules.md` — **not present** in repo at planning time. This plan subsumes that intent without duplicating full `release-process.md` prose.

---

## Readiness checklist (production)

| ID | Item | Gate type | Status | Evidence / pointer |
|----|------|-----------|--------|-------------------|
| R-01 | All milestones CLOSED | Release prereq | **UNKNOWN** | `release-process.md`; verify against `archive/milestones/` + open work in `MASTER-PLANNING-KM-REVIEW.md` |
| R-02 | Repository Regression Audit = PASS | Release prereq | **PARTIAL** | `archive/defects/AUDIT-FINAL.md` (historical PASS); re-run required on HEAD |
| R-03 | Post-Audit Review = PASS | Release prereq | **UNKNOWN** | `milestone-lifecycle.md` |
| R-04 | Final Release Validation = PASS | Release prereq | **NOT MET** | Blocked on R-10, R-11 |
| R-05 | Git working tree clean | Release prereq | **FAIL** | `git status` dirty (4 paths) |
| R-06 | No pending hotfixes | Release prereq | **UNKNOWN** | Dispatcher triage of open FIX/IMP threads |
| R-07 | `deploy.sh validate` (prod) | Ops smoke | **PASS** | 2026-07-13 session: 4/4 |
| R-08 | Single runtime instance + `/health` | Runtime prep | **PASS** | deploy validate health |
| R-09 | Dashboard OAT (API + render) | Milestone D class | **UNKNOWN** | Distinct from Runtime OAT per `SKILL.md` |
| R-10 | **Enterprise Runtime OAT** (full pipeline) | Milestone E/J class | **NOT MET** | `milestone-lifecycle.md`, `runtime-oat-guarded-forensics.md`; K archive PASS ≠ current HEAD |
| R-11 | WECP + PM parser + artifact contracts | Runtime quality | **PARTIAL** | FIX-004/005/006/008 shipped in refs; Planning `no contract (skip)` still observed (`runtime-oat-imp007-030-blocked-pm-engine.md`) |
| R-12 | Phase deliverable contract (IMP-001/002) | Tech debt vs blocker | **DEFERRED** | `phase-deliverable-contract-imp002-pilot.md` — pilot shipped; full consolidation not release blocker if OAT PASS |
| R-13 | VERSION file / tag alignment | Release artifact | **GAP** | `MASTER-PLANNING-KM-REVIEW.md`: no VERSION file; tag `v1.0.0` per `release-process.md` |
| R-14 | Documentation consolidation | Release hygiene | **PARTIAL** | `documentation-consolidation-pattern.md`; 60+ `references/*.md` — avoid new duplicate release docs |
| R-15 | `.aic/` runtime state not in release commit | Hygiene | **POLICY** | `milestone-closeout-pattern.md` — never commit task/worker leases |

---

## Work packages

### WP-R1 — Pre-release hygiene and tree freeze

| Field | Value |
|-------|--------|
| Owner | Governor / Dispatcher (orchestration) |
| Depends on | — |
| Deliverables | Clean `git status`; staged release-only commits; `VERSION` or tag message per `release-process.md` |
| Acceptance | `git status -sb` shows no unintended modifications; user explicit commit for release |

### WP-R2 — Regression audit (HEAD)

| Field | Value |
|-------|--------|
| Owner | QA + PM |
| Depends on | WP-R1 optional parallel |
| Deliverables | Regression audit report (PASS/FAIL), syntax/dashboard build, grep policies (`curl_api`, no debug) |
| Acceptance | Matches `archive/defects/AUDIT-FINAL.md` bar; all FAIL items ticketed |

### WP-R3 — Deploy / ops validation matrix

| Field | Value |
|-------|--------|
| Owner | Infrastructure |
| Depends on | Server running |
| Deliverables | `deploy.sh validate`, `deploy.sh status`, backup drill note |
| Acceptance | validate 4/4 PASS; documented port/PID |

### WP-R4 — Dashboard OAT (curl + vision)

| Field | Value |
|-------|--------|
| Owner | QA |
| Depends on | R-08 |
| Deliverables | Dashboard OAT checklist: pipeline phases, task card, metrics |
| Acceptance | Explicit report: **Dashboard OAT PASS**; no conflation with Runtime OAT |

### WP-R5 — Guarded Enterprise Runtime OAT

| Field | Value |
|-------|--------|
| Owner | Dispatcher + Runtime |
| Depends on | WP-R1 (server restart after engine patches), idle `currentTask` |
| Deliverables | OAT run log, task id, phase-by-phase PM exits, terminal COMPLETE/BLOCKED/INVALID |
| Acceptance | **Pipeline OAT PASS** via `pipeline-orchestrator.sh` or canonical intent API (`task.create` + rich `description`, `task.resume` not bogus pause) — per `wecp-architecture-and-pitfalls.md`, `runtime-oat-investigate-scope.md` |
| Min task description | FEAT-001 scope sentence in `task.create` JSON |

### WP-R6 — Contract & PM gate verification

| Field | Value |
|-------|--------|
| Owner | Backend / Runtime maintainers |
| Depends on | WP-R5 failures |
| Deliverables | Planning workers on WECP path (no spurious `no contract (skip)`); `pm-review.sh` exit maps to verdict (FIX-004) |
| Acceptance | Investigate + Planning + at least one Implementation worker PM PASS on OAT task |

### WP-R7 — Closeout artifacts (release task)

| Field | Value |
|-------|--------|
| Owner | PM + Governor |
| Depends on | WP-R5 PASS |
| Deliverables | `templates/release-checklist.md` filled, `templates/release-summary.md` with **PROCEED** |
| Acceptance | PM Review PASS on closeout; recommendation aligned with evidence |

### WP-R8 — Tag and publish (execution only)

| Field | Value |
|-------|--------|
| Owner | Dispatcher (user-triggered) |
| Depends on | R-01–R-07 satisfied |
| Deliverables | Annotated tag `v1.0.0`, push, GitHub release |
| Acceptance | `release-process.md` steps complete; no file changes in release step itself |

---

## Verification matrix

| Check | Command / method | Pass criteria | WP |
|-------|------------------|---------------|-----|
| Deploy smoke | `./scripts/deploy.sh validate` | 4 PASS, 0 FAIL | R3 |
| Health | `curl -sf localhost:6868/health` | `"ok"` | R3 |
| Dashboard build | `cd dashboard && npm run build` | exit 0 | R2 |
| Engine syntax | `node --check scripts/engine/index.js` | exit 0 | R2 |
| PM parser spot | `references/pm-review-exit-code-pitfall.md` scenarios | PASS not exit 3 | R6 |
| WECP contract load | `scripts/phase-contract-loader.py` + `.aic/runtime-contracts.json` | workers match phases | R6 |
| Runtime OAT | Guarded script / orchestrator, poll to terminal | COMPLETE + evidence in `reports/` | R5 |
| Git clean | `git status -sb` | clean before tag | R1 |
| Release prereq doc | Read `release-process.md` checklist | all booleans true | R7 |

---

## Risk register

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|----|------|------------|--------|------------|-------|
| RK-1 | Claim Runtime OAT PASS from API curl only | Med | Critical | Label Dashboard vs Runtime OAT in every report (`SKILL.md`) | Dispatcher |
| RK-2 | Cross-task checkpoint BLOCKED (wrong task id) | Med | High | Serialize OAT; one active pipeline (`runtime-checkpoint-task-isolation.md`) | Runtime |
| RK-3 | PM exit 3 despite PASS text | Low | High | FIX-004 parser; verify on OAT | Runtime |
| RK-4 | Implementation NDJSON in reports | Med | Med | FIX-005 validator + prompts | Implementation |
| RK-5 | Tool-only opencode / empty extract | Med | High | FIX-006 completion contract; IMP-007 continue | WECP |
| RK-6 | `runPmReview` engine crash post-workers | Low | Critical | FIX-008 `let artifacts`; restart server after patch | Runtime |
| RK-7 | Planning legacy skip (weak artifacts) | Med | High | IMP-002 pilot contracts for Planning workers | Architect |
| RK-8 | Dirty tree at tag | High | Med | WP-R1 before WP-R8 | Governor |
| RK-9 | Missing VERSION file | Med | Low | Tag message carries version; optional VERSION in WP-R1 | PM |
| RK-10 | Provider timeout (aic/Opus) | Med | High | Resume from failed phase; `runtime-stop-all-tasks.md` | Dispatcher |

---

## Dependencies (DAG summary)

```
WP-R1 ──┬──> WP-R8
WP-R2 ──┤
WP-R3 ──┼──> WP-R4 ──┐
        │            ├──> WP-R5 ──> WP-R6 ──> WP-R7 ──> WP-R8
        └────────────┘
```

---

## Deduplication notes

| Existing artifact | Relationship to this plan |
|-------------------|---------------------------|
| `references/release-process.md` | **Canonical** for tag/push/gh release — not duplicated here |
| `templates/release-checklist.md` | **Closeout output** template — WP-R7 fills it |
| `templates/release-summary.md` | **Closeout output** template — WP-R7 PROCEED/DO NOT PROCEED |
| `archive/milestones/K/K-RUNTIME-OAT-FINAL-REPORT.md` | **Historical evidence** — re-verify on HEAD |
| `docs/release-readiness/readiness-plan.md` | **This document** — planning-only; update after Implementation |

---

## Planning compliance

| Requirement | Met |
|-------------|-----|
| Checklist | § Readiness checklist (R-01–R-15) |
| Work packages | § WP-R1–WP-R8 |
| Verification matrix | § Verification matrix |
| Risk register | § Risk register |
| Repo evidence cited | deploy validate, git SHA, missing prompt files noted |
| Dispatcher does not implement | Planning artifact only |

---

## Release recommendation (planning)

**DO NOT PROCEED** to `v1.0.0` until:

1. WP-R5 Enterprise Runtime OAT **PASS** on current code with serialized tasks and full `task.create` description.  
2. WP-R1 clean git tree (or explicit user-approved release commit).  
3. WP-R2 regression audit **PASS** on HEAD.  
4. WP-R7 Governor closeout **PROCEED** with PM Review PASS.

**Proceed path:** Execute WP-R1 → R2 → R3/R4 in parallel → R5 → R6 (if needed) → R7 → user-requested R8 per `release-process.md`.