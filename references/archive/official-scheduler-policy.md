# Official Scheduler Policy

## Decision: OPTION A — Sequential Head Workers

**Head Workers are sequential. Parallelism exists only through Sub-workers.**

## Reasoning

1. Coordination overhead of concurrent Head Workers adds complexity
2. PM Review bottleneck (multiple artifacts arriving simultaneously)
3. Dispatcher simplicity (sequential spawn-worker.sh calls)
4. Sub-workers already solve parallelism within phases
5. Rule of 5 integrity preserved

## Phase Execution Order

```
Dispatcher → PM → Architect → [specialists] → QA → Governor → Dispatcher → User
```

## Within Each Phase

Specialists (Data, Integration, Infra, Security) share identical prerequisites but execute sequentially. Parallelism delegated to sub-workers.

## Future: Phase-Based Parallel Scheduler (v3.2)

After PM Review automation is complete, AIC can adopt concurrent Head Workers within phases. Feasibility confirmed — no architectural blockers, only implementation convenience deferral.

## Sources

- OFFICIAL-SCHEDULER-POLICY.md
- ARCHITECTURE-CLARIFICATION-SCHEDULER.md
- FEASIBILITY-REVIEW-SCHEDULER.md
- ADR-UPDATE-PROPOSAL-SCHEDULER.md
