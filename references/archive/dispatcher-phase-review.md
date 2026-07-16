# Dispatcher Phase Review Gate

## Overview

Every phase transition requires a double gate:
1. PM Review (completeness)
2. Dispatcher Gate (lifecycle API)

## PM Review

PM evaluates worker deliverable against:
- Phase objectives addressed
- Scope compliance (matches Work Package)
- Acceptance criteria referenced
- Deliverable complete (all required sections present)

PM does NOT evaluate:
- Technical correctness
- Architecture soundness
- Code quality
- Test adequacy

## PM Verdict

- **PASS:** Deliverable is complete, all phase objectives addressed
- **REWORK:** Deliverable is incomplete or missing scope

## Dispatcher Gate

Dispatcher reads PM verdict:
- If PASS: Advance phase via API, spawn next worker
- If REWORK: Re-spawn same worker with PM feedback

## Rework Rules

- Max 2 rework attempts per phase
- After 2 reworks: Escalate to user
- Rework feedback must be specific (what is missing, not what is wrong)

## Phase Transition Flow

```
Worker Completes → PM Review → PASS/REWORK
  PASS → Dispatcher Gate → API phase advance → Next Worker
  REWORK → Dispatcher → Re-spawn Worker with feedback
```
