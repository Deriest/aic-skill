# IMP-016 — Implementation WECP MISSING_SECTION (OAT 040)

## Symptom

- Planning PM **PASS**; Implementation never reaches PM Review.
- Log: `WECP: generate FAIL: ['MISSING_SECTION', ...]` (often ×7 for backend/frontend).
- `reports/backend-output.md` / `frontend-output.md` **absent** — WECP only copies artifact on validator **PASS**; failed runs unlink temp MD.

## Chain

```
implementation.json requiredSections
  → phase-runner CONTRACT_BLOCK (generic)
  → opencode JSON → opencode-json-to-md.py (type:text only)
  → FIX-014 normalize (no-op if H1 missing)
  → validate-phase-artifact.py (exact heading line match)
```

First violation: **extracted markdown** lacks exact headings (not validator bug, not FIX-014 stripping).

## Repair loop behavior (pre-FIX-017)

- `maxRepairAttempts`: 2 (default in `worker-compliance.json`).
- Repair prompt was **patch-only**; identical `MISSING_SECTION` across generate + repair#1 + repair#2 → **do not** recommend raising repair count alone.

## Classification

Primary: **Worker Prompt** — crafter ignores skeleton.  
Secondary: **WECP repair** — patch-only when entire skeleton missing.

## Fix shipped

**FIX-017** — see `references/runtime-fix017-implementation-skeleton-lock.md`.

## OAT evidence

- **TASK-20260713-040**: frontend `FAILED_AFTER_REPAIR`; backend same pattern in log.