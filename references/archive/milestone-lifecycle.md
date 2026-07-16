# Milestone Lifecycle — Complete Pattern

Every milestone follows this exact sequence. No steps may be skipped.

## Sequence

```
Investigation → Planning → Implementation → Verification → Runtime OAT → Defect Fix → Re-Verification → Closeout → Regression Audit → Post-Audit Review
```

## Phase Details

### 1. Investigation
- Evidence-first, no implementation
- Review all inputs (baselines, reports, repo state)
- Produce: `<LETTER>-INVESTIGATION.md`

### 2. Planning
- Work Packages with acceptance criteria
- No implementation
- Produce: `<LETTER>-PLAN.md`, `<LETTER>-PLANNING-REPORT.md`

### 3. Implementation
- Execute WPs in order
- Self-validate after each WP
- Produce: `<LETTER>-IMPLEMENTATION-REPORT.md`

### 4. Verification
- Independent gate (NOT self-validation)
- Runtime evidence required, not code inspection
- Produce: `<LETTER>-VERIFICATION-REPORT.md`

### 5. Runtime OAT
- Real engineering task through full pipeline
- All defect fixes validated during live execution
- Dashboard state must match runtime state
- Produce: `<LETTER>-RUNTIME-OAT-FINAL-REPORT.md`

### 6. Defect Fix (if needed)
- Investigation → Fix → Local Validation
- DO NOT perform Verification or OAT during defect fix
- Produce: `DF-NNN-IMPLEMENTATION.md`

### 7. Re-Verification (if defects found)
- Independent gate on defect fixes only
- Runtime evidence for each fix
- Produce: `DF-NNN-REVERIFICATION.md`

### 8. Closeout
- PM Final Review → Doc Sync → Repo Validation → Baseline Summary → Commit
- Produce: `<LETTER>-CLOSEOUT-REPORT.md`, `PM-FINAL-REVIEW-<LETTER>.md`, `DOCUMENTATION-SYNC-<LETTER>.md`, `BASELINE-<LETTER>.md`

### 9. Regression Audit (after milestone)
- Repository-wide quality gate
- No implementation, no fixes
- Classify findings: CRITICAL/HIGH/MEDIUM/LOW/INFO
- Produce: audit reports

### 10. Post-Audit Review (if findings)
- Validate whether findings are genuine defects or false positives
- No implementation, no fixes
- Produce: `POST-AUDIT-REVIEW.md`

## Pitfalls

- **Self-check ≠ Verification.** Implementation self-validation is NOT Official Verification.
- **Endpoint testing ≠ Runtime OAT.** curl API calls are Dashboard OAT only. Real Runtime OAT requires full pipeline execution.
- **Direct worker spawn ≠ Pipeline OAT.** Must use pipeline-orchestrator.sh, not spawn-worker.sh directly.
- **Defect fix scope.** During DF fix: implementation only, no verification, no OAT.
- **Closeout scope.** Documentation sync, commit, baseline. No implementation.
