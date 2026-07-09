# Documentation-First Milestone Workflow

## Pattern

For any major feature (Dashboard, Runtime Gate, Scheduler), follow this sequence:

```
1. ADR        → Architecture Decision Record (WHY)
2. SPEC-D01   → Functional Specification (WHAT)
3. SPEC-D02   → UX Specification (HOW it looks)
4. CHANGESET  → What files change, what doesn't
5. PLAN       → Work packages with atomic tasks
6. PM REVIEW  → Cross-validate all docs against each other
7. IMPLEMENT  → Keep → Extend → Integrate
8. VERIFY     → Build + visual + runtime check
```

## Why This Works

Without frozen docs, every implementation attempt gets undone by the next requirement change. The session spent ~80% on documentation and ~20% on implementation — this is correct.

## Rules

- No implementation until PM REVIEW = PASS
- Every implementation task must trace back to ADR/SPEC/CHANGESET
- No undocumented changes allowed
- PM Review cross-validates ALL documents as one set
- Implementation strategy: KEEP → EXTEND → INTEGRATE (never REWRITE without PM approval)

## Anti-Patterns

- Starting implementation before docs are frozen → iterative redesign spiral
- Skipping CHANGESET → undocumented file modifications
- Skipping PM Review → documentation drift
- Merging Pipeline and Runtime Gate into one card → violates one-panel-one-question principle
