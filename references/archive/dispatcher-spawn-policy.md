# Dispatcher Spawn Policy

## When to Spawn Sub-workers

A Head Worker SHOULD spawn sub-workers when:
- Work is naturally parallel and can be partitioned
- Tasks are independent with minimal cross-file synchronization
- Scope >= 3 files or >= 2 modules
- Multiple independent deliverables exist

## When NOT to Spawn Sub-workers

A Head Worker SHOULD NOT spawn sub-workers when:
- Work is tightly coupled (shared state or global functions)
- Reasoning is sequential (step B requires step A)
- Change is trivial (coordination overhead exceeds benefit)

## Sub-worker Inheritance

Sub-workers inherit exactly:
- Same responsibility as Head Worker
- Same capability profile as Head Worker
- Same execution model as Head Worker

Sub-workers do NOT introduce:
- New responsibilities
- New authority
- New capability profile

## Sub-worker Lifecycle

1. Head Worker analyzes scope
2. Head Worker defines N sub-scopes
3. Head Worker creates N prompt files
4. Head Worker invokes spawn-sub.sh N times (blocking)
5. Each sub-worker executes assigned scope
6. Each sub-worker produces Sub-Worker Report
7. Head Worker reads all sub-reports
8. Head Worker consolidates into one official artifact
9. Head Worker performs self-validation
10. Head Worker marks Completed

## Consolidation Rules

- Only Head Worker produces official artifact
- Sub-worker reports are internal only
- Head Worker must resolve conflicts between sub-reports
- Head Worker must identify cross-cutting concerns
