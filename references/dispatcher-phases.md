# Dispatcher Phases

> **Consolidated from 3 files.** Originals archived in `references/archive/`.

**Original files merged:**
- `dispatcher-phase-review.md`
- `dispatcher-phase-skip-investigate.md`
- `dispatcher-qa-validation.md`

---

---

## Source: `dispatcher-phase-review.md`

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

---

## Source: `dispatcher-phase-skip-investigate.md`

# Dispatcher Phase Skip Investigate (Deprecated)

Historical — Investigate phase is mandatory. See `references/runtime-oat-investigate-scope.md`. Skipping Investigate is blocked by Engine FSM.

---

## Source: `dispatcher-qa-validation.md`

# Dispatcher QA Validation Policy

## Core Rule

QA must verify actual implementation. Report-based validation is a critical process defect.

## Evidence Categories

### Verified (Mandatory)
Items tested directly with concrete evidence:
- Terminal: build output, test results, exit codes
- API: curl responses, status codes, JSON schemas
- Browser: screenshots, console logs, UI interactions
- Files: git diff, syntax checks, lint output

### Assumed (Requires Justification)
Items not testable due to environmental limits:
- Must explain why not testable
- Must document assumption
- Critical paths CANNOT be assumed

### Not Tested (Requires Reason)
Items skipped:
- Must explain reason
- Must document risk
- Critical paths CANNOT be skipped

## PASS Criteria

All acceptance criteria from Discovery Report are in "Verified" status with concrete evidence.

## FAIL Criteria

Any of:
- Critical path in "Assumed" without justification
- Critical path in "Not Tested" without reason
- Build fails
- Tests fail
- API returns errors
- UI has console errors

## Verification Evidence Report

Sections:

- Acceptance Criteria Matrix (per criterion: status, evidence, notes)
- Verified Items (with logs/screenshots)
- Assumed Items (with justification)
- Not Tested Items (with reason)
- Overall Verdict (PASS / FAIL)
