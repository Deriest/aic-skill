# Dispatcher Worker State Machine

## States

| State | Description |
|-------|-------------|
| Idle | Worker available, no task |
| Assigned | Task received, context not loaded |
| Running | Actively executing |
| Waiting | Blocked on external input |
| Blocked | Cannot proceed (missing dependency) |
| Sub-spawn | Head waiting for sub-workers |
| Self-Validation | Checking own output |
| Completed | Artifact generated, handoff ready |
| Failed | Non-recoverable error |
| Cancelled | Task cancelled |

## Transitions

| From | To | Trigger |
|------|----|---------|
| Idle | Assigned | Task assigned |
| Assigned | Running | Context loaded |
| Running | Waiting | External dependency |
| Waiting | Running | Dependency resolved |
| Running | Blocked | Missing dependency |
| Blocked | Running | Dependency provided |
| Running | Sub-spawn | Scope exceeds capacity |
| Sub-spawn | Running | Sub-workers complete |
| Running | Self-Validation | Execution complete |
| Self-Validation | Running | Rework needed |
| Self-Validation | Completed | Validation passes |
| Running | Failed | Non-recoverable error |
| Any | Cancelled | User/Dispatcher cancels |
| Failed | Running | Retry triggered |

## Logging

Format: `[TIMESTAMP] [WORKER] [STATE] [MESSAGE]`

Location: `.aic/tasks/TASK-XXX/logs/`

## Recovery

- Recoverable: retry same tier (max 3), then escalate tier
- Non-recoverable: enter FAILED, escalate to Head Worker/Dispatcher
- Blocked: wait for dependency, escalate if unresolved after 5 minutes
