# Dispatcher Artifact Contracts

## Metadata Header

Every artifact must include:

```
---
worker: [worker_name]
task_id: [TASK-XXX]
phase: [lifecycle_phase]
capability_profile: [System/Thinker/Crafter/Sprinter]
started_at: [ISO 8601]
completed_at: [ISO 8601]
duration_seconds: [N]
sub_workers_spawned: [N or 0]
self_validation: [PASS/FAIL]
---
```

## Artifact Registry

| # | Artifact | Producer | Phase | Required Sections |
|---|----------|----------|-------|-------------------|
| 1 | User Summary | Dispatcher | Init | Task classification, project, scope estimate |
| 2 | Structured Clarification Request | PM | Investigate | Questions (max 5), context, priority |
| 3 | Discovery Report | PM | Investigate | Objective, Scope, Out of Scope, Dependencies, Constraints, Assumptions, Known Unknowns, Acceptance Criteria, Confidence, Verdict |
| 4 | Work Package | PM | Investigate | Task breakdown, file targets, acceptance criteria per sub-task |
| 5 | Phase Review Verdict | PM | All phases | Verdict (PASS/REWORK), missing items, feedback |
| 6 | Architecture Specification | Architect | Planning | System overview, module design, API contracts, data models, tech decisions |
| 7 | Research Report | Research | Investigate | Scope, methodology, findings, evidence, recommendations |
| 8 | Backend Implementation Report | Backend | Implementation | Modules modified, files changed, build status, test results |
| 9 | Frontend Implementation Report | Frontend | Implementation | Components modified, files changed, render status, console warnings |
| 10 | Verification Evidence Report | QA | Verification | Acceptance criteria matrix, Verified/Assumed/Not Tested, verdict |
| 11 | Design Specification | Designer | Implementation | Component layouts, design tokens, responsive breakpoints |
| 12 | Infrastructure Report | Infrastructure | Planning | Deployment targets, container configs, CI/CD scripts |
| 13 | Security Advisory Report | Security | Planning | Threat model, vulnerability scan, remediation guidance |
| 14 | Performance Optimization Report | Performance | Verification | Baseline, profiling results, bottlenecks, recommendations |
| 15 | Data Architecture Specification | Data | Planning | Schema design, relationships, migration scripts |
| 16 | Integration Specification | Integration | Planning | External services, API adapters, error handling |
| 17 | Documentation Handoff Report | Documentation | Closeout | Docs updated, docs created, accuracy verification |
| 18 | Release Checklist | Governor | Closeout | Compliance items, status per item, blocking issues |
| 19 | Release Summary | Governor | Closeout | Task summary, changes made, release recommendation |

## File Convention

All artifacts saved to: `.aic/tasks/TASK-XXX/reports/<artifact-name>.md`
