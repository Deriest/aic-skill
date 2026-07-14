# FIX-017 — Lock Implementation Workers to implementation.json

## Problem (IMP-016)

Backend/frontend crafters emit narrative/planning text without exact contract headings → WECP `MISSING_SECTION` ×7 through all repair attempts.

## Shipped changes

| File | Change |
|------|--------|
| `scripts/phase-runner.sh` | `IMPLEMENTATION_SKELETON_BLOCK` for `Implementation` + `backend` \| `frontend` — mandatory H1, exact heading list, forbidden planning/diary prose |
| `scripts/worker-execution-pipeline.py` | If repair errors are **only** `MISSING_SECTION` → **full skeleton** regenerate prompt (not patch-only) |

## Unchanged

Runtime, PM, validator, repair limits, Planning/Investigate phases.

## Verify (ad-hoc)

```bash
# /tmp/hermes-verify-fix017-*.py — synthetic artifact with all sections → validate PASS
# build_repair_prompt: all MISSING_SECTION → contains "full skeleton", no CURRENT ARTIFACT
```

## OAT

Restart `server.js` after deploy; new task; expect WECP generate PASS or repair#1 full-skeleton recovery.

## Related

- `.aic/phase-contracts/implementation.json`
- `references/imp016-wecp-implementation-missing-section.md`
- `references/wecp-architecture-and-pitfalls.md`