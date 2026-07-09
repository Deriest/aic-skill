# Runtime Gate System

## Overview

Runtime Gates are first-class synchronization checkpoints in AIC v3.1. They are NOT lifecycle phases and NOT workers.

## Supported Gates

| Gate Type | Owner | Purpose |
|-----------|-------|---------|
| PM Review | PM | Validates artifact completeness before phase transition |
| Dispatcher Gate | Dispatcher | Advances lifecycle only after PM PASS |
| Waiting User | Dispatcher | Pauses pipeline for user clarification |
| Sub-worker Sync | Head Worker | Blocks completion until all sub-workers finish |

## Runtime State

```json
{
  "runtimeGate": {
    "type": "pm-review",
    "owner": "pm",
    "target": "architect",
    "status": "reviewing",
    "startedAt": 1234567890,
    "metadata": {}
  }
}
```

## API

- `POST /api/runtime-gate` — Set or clear runtime gate state
- `GET /api/status` — Returns current runtimeGate in state

## Dashboard

Pipeline panel split into two columns:
- Left: Rule of 5 lifecycle phases
- Right: Current Runtime Gate status (type, owner, target)

## Double Gate System

Every phase transition requires:
1. PM Review (completeness validation) → PASS/REWORK
2. Dispatcher Gate (API lifecycle advance)

Worker completes → PM Review → PASS → Dispatcher Gate → Next Worker
Worker completes → PM Review → REWORK → Return to same Worker

## Sources

- ADR-002 §4.3
- SPEC-002 §7
- RUNTIME-GATE-IMPLEMENTATION.md
