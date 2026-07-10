# Master Roadmap & Architecture Freeze Pattern

## When to Use

For projects spanning 3+ milestones with shared infrastructure. Establishes a single execution framework before any milestone begins.

## Lifecycle

```
Master Investigation → Master Roadmap → Master Planning → Architecture Freeze → Milestone Execution
```

## Architecture Freeze

After freeze:
- No milestone scope changes
- Adding milestone requires: Investigation → ADR → PM Approval → Roadmap update
- Adding WP requires: Milestone Investigation revision → PM Approval
- No new capabilities during implementation unless approved

## Standard Milestone Lifecycle (8 Gates)

```
Gate 1: Investigation (Capability Matrix, Gap Analysis, Risk Assessment)
Gate 2: Documentation Package (ADR, SPEC, CHANGESET, PLAN, PM REVIEW)
Gate 3: Implementation (continuous across all WPs, no user approval between WPs)
Gate 4: Verification (one per milestone, not per WP)
Gate 5: OAT (one per milestone, end-to-end)
Gate 6: Documentation Synchronization (only if drift exists)
Gate 7: PM Final Review
Gate 8: Closeout (Commit, Push, Freeze)
```

## Work Package Rules

- WPs are internal engineering traceability only
- NOT delivery milestones, NOT approval checkpoints
- Implementation proceeds continuously across all WPs
- User approval only at milestone boundaries

## Reporting Standard

Every report MUST include:
1. Test Method (how result was obtained)
2. Verification Tool (tools used)
3. Evidence (commands, logs, repo references)
4. Limitations (what was NOT verified)

## Pitfall: Documentation ≠ Connected

A feature existing in code does NOT mean any caller invokes it. Always verify:
1. Does the feature exist? (grep)
2. Does any caller invoke it? (grep for callers)
3. Does orchestration logic connect it? (check prompts/discipline)
4. Does it execute end-to-end? (run it)

Steps 2-4 missing = feature NOT complete regardless of documentation quality.
