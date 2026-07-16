# v3.3.0 Master Implementation Plan — "Pipeline Resilience + Planning Intelligence"

**Baseline:** v3.2.0 | **Target:** v3.3.0 | **Status:** Architecture Frozen, M1 COMPLETE, awaiting M2 approval

## Architecture Evolution (3 corrections applied this session)

1. **Recovery Framework** — Retry is not the architecture. Recovery is. Retry is ONE strategy among many.
2. **Deterministic Verdicts** — UNKNOWN and MANUAL_APPROVAL_REQUIRED removed. Only PASS, REWORK, BLOCKED.
3. **Resolution Plans** — PM returns verdict + executable resolution plan. Dispatcher executes the plan.

See `references/recovery-framework-architecture.md` for full architecture.

## Root Cause Summary (3 real production tasks)

| Task | Root Cause | Classification |
|------|-----------|----------------|
| TASK-009 | Vague prompt → Architect/Research conflict | Prompt ambiguity |
| TASK-010 | `pm-review.sh` missing `--auto` | Permission issue |
| TASK-011 | Same Smart Approval issue at Verification | Permission issue |

## 11 Work Packages

| WP | Milestone | Objective | Status |
|----|-----------|-----------|--------|
| WP-1.1 | M1 | Permission Recovery Infrastructure | DONE |
| WP-1.2 | M1 | Artifact Provider Abstraction | DONE |
| WP-1.3 | M1 | Recovery Engine (retry + degraded + BLOCKED) | DONE |
| WP-1.4 | M1 | Recovery Readiness Check | DONE |
| WP-2.1 | M2 | Canonical Spec Generation | Pending |
| WP-2.2 | M2 | Artifact Metadata Envelope (9 fields) | Pending |
| WP-2.3 | M2 | PM Review Staleness Detection | Pending |
| WP-2.4 | M2 | Framework Invariant + Contract Validation | Pending |
| WP-3.1 | M3 | Cross-Worker Conflict Classification | Pending |
| WP-3.2 | M3 | Cross-Worker Repair Prompt (4-excerpt) | Pending |
| WP-3.3 | M3 | Repair Optimization + Spec Drift | Pending |

## M1 Files Modified

- `scripts/pm-review.sh` — --auto added, degraded mode handler
- `scripts/artifact-provider.js` — NEW: ArtifactProvider class
- `scripts/engine/index.js` — provider integration, recovery loop, BLOCKED terminal state
- `scripts/preflight.sh` — permission canary
- `scripts/health-check.sh` — permission probe

## Artifact Metadata Schema (v1)

9 fields: schema_version, task_id, phase, worker, generation, timestamp, supersedes, repair_iteration, canonical_spec_version.

Backward compat: no frontmatter → schema_version 0.

## Canonical Spec Configuration

```json
{"canonicalSpec": {"model": "auto", "tier": "sprinter", "provider": "inherit"}}
```

## Release Strategy

Single commit, single tag, single push at end. No milestone commits/tags.