# FIX-018 — Closeout manifest rollup (shipped)

## Problem (OAT-041 / IMP-017)

Closeout is **pm-only** synthesis with **no** `closeout.json` WECP contract. Worker inferred inventory → wrong rollup (qa absent, planning-output.md / TASK-040, IMP-015 “N/A”) while disk had `qa-output.md`, no `planning-output.md`, and `engine.json` rework. Closeout PM REWORK until IMP-015 cap → BLOCKED.

## Fix

- `scripts/closeout-context-block.py` — manifest `reports/*.md`, Task Authority, engine snapshot, rework / IMP-015 exercised, rollup source map, COMPLETE rule when Verification `pmReview` PASS.
- `scripts/phase-runner.sh` — `CLOSEOUT_CONTEXT_BLOCK` before `TASK_SCOPE` for Closeout + `AIC_TASK_ID`.

## OAT success criteria (FIX-018)

Reach **Closeout** with Verification PM PASS; Closeout pm must cite **only manifest files** and correct TASK id; PM PASS → COMPLETE.

## Pitfall

**Planning research drift** (042) can block pipeline **before** Closeout — FIX-018 not exercised. Do not claim FIX-018 PASS until Closeout PM runs with injected block.

## Verify (ad-hoc)

```bash
python3 scripts/closeout-context-block.py <SKILL_DIR> <TASK_ID> <context.json>
# expect: Manifest lists qa-output.md; IMP-015 exercised when rework present
grep FIX-018 scripts/closeout-context-block.py
grep CLOSEOUT_CONTEXT_BLOCK scripts/phase-runner.sh
```

Restart `server.js` before Runtime OAT.

## Related

- `references/imp017-closeout-artifact-resolution.md`
- `references/runtime-imp015-pm-repair-loop.md`
- `references/runtime-fix017-implementation-skeleton-lock.md` (041 Implementation path)