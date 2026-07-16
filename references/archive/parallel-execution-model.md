# Parallel Execution Model

## Dependency Graph

```
Dispatcher → PM → Architect → [Data+Integration+Infra+Security] → [Backend+Frontend+Designer] → [QA+Performance] → Documentation → Governor → Dispatcher → User
```

## Mandatory Serial Workers

Dispatcher, PM, Architect, QA, Governor — define critical path.

## Parallel Eligibility (within phase)

| Group | Workers | Phase |
|-------|---------|-------|
| Planning Specialists | Data, Integration, Infrastructure, Security | Planning |
| Implementation Specialists | Backend, Frontend, Designer | Implementation |
| Verification Specialists | QA, Performance | Verification |

## Synchronization Barriers

1. User Input Barrier (Dispatcher ↔ User)
2. Clarification Barrier (PM ↔ User)
3. Architect Output Barrier (Planning → Implementation)
4. PM Review Barrier (after every Head Worker)
5. Dispatcher Gate Barrier (between phases)
6. Sub-worker Sync (within Head Worker)

## Sources

- PARALLEL-EXECUTION-INVESTIGATION.md
- OFFICIAL-SCHEDULER-POLICY.md
