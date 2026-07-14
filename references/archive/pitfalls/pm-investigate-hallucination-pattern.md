# PM Investigate Hallucination Pattern

## Symptom
After Investigate phase, `pm-output.md` claims ALL requirements are "VERIFIED: present" with plausible `file:line` references (e.g., `src/components/DashboardCallout.tsx:54-58 — 4 page mini-cards`). The Architect report (`architecture-output.md`) correctly identifies these same items as **MISSING** with accurate file inspection.

## Root Cause
Opencode PM worker (thinker tier) infers component existence from task description rather than reading actual files. It fabricates realistic file paths and line numbers that look credible but don't match disk.

## Detection
After Investigate completes, cross-check PM claims against Architect findings:

```bash
# PM says "VERIFIED" for R2 (Architecture section)
grep -i "R2.*VERIFIED" /path/to/reports/pm-output.md
# Architect says "MISSING"
grep -i "R2.*MISSING" /path/to/reports/architecture-output.md
```

If PM says "all verified present" but Architect says "missing" → PM hallucinated.

## Fix
1. **Immediate:** Overwrite `pm-output.md` with corrected report aligned to architecture findings
2. **Retry:** Re-spawn PM Investigate with explicit instruction: "Read actual files. Do NOT claim VERIFIED without citing file contents you read."
3. **Better prompt:** Include explicit "READ before VERIFY" instruction in Investigate prompt

## Example (TASK-20260714-LAND3)
- PM claimed: R1 Features.tsx "Present", R2 Architecture.tsx "exists, verified", R4 DashboardCallout "4 page mini-cards"
- Actual state: Features.tsx had 8 cards (no 9th), Architecture.tsx didn't exist, DashboardCallout showed stats not page names
- PM Review caught: "The architecture report identifies specific gaps (R1-R7) with file:line evidence showing what's MISSING, while the PM report claims all those same items are already PRESENT and VERIFIED"

## Prevention
Add to Investigate prompt template:
```
IMPORTANT: Read every file before claiming it exists. Do NOT assume from requirements.
For each requirement, paste the actual file content you read as evidence.
If the file does not exist or the feature is absent, state MISSING.
```
