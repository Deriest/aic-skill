# FIX-005 — Implementation worker artifact contract (Runtime OAT 020)

## When to load

Runtime OAT **BLOCKED** at **Implementation PM REWORK** with evidence that `backend-output.md` / `frontend-output.md` are **raw NDJSON** (`tool_use`, `sessionID`) or meta-stubs ("report saved at …") instead of engineering markdown.

**Not** a Runtime / FSM / PM logic defect when PM correctly returns REWORK exit 1.

## Required files (runtime path)

| Worker | Path | Required headings |
|--------|------|-------------------|
| backend | `reports/backend-output.md` | `# Backend Implementation`, `## Objective`, `## Files Modified`, `## Changes`, `## Technical Notes`, `## Verification`, `## Result` |
| frontend | `reports/frontend-output.md` | `# Frontend Implementation`, `## Objective`, `## Files Modified`, `## Changes`, `## UI Notes`, `## Verification`, `## Result` |

Forbidden in `reports/*.md`: raw JSON/NDJSON streams, assistant session dumps.

## Enforcement (repo)

1. **`scripts/validate-implementation-artifact.py`** — section + session-dump checks
2. **`scripts/phase-runner.sh`** — Implementation prompts append exact heading template; post-`wait` re-validate artifact
3. **`scripts/spawn-worker.sh`** — after `opencode-json-to-md.py`, validate; fail → `EXIT_CODE=1`, remove bad artifact
4. **`scripts/worker-validation.sh`** — same validator for backend/frontend
5. **`scripts/opencode-json-to-md.py`** — if no `type:text` extracted, **exit 1** (no fallback `cp` raw to reports)

## TASK-20260713-020 trace (valid BLOCKED)

| Step | Result |
|------|--------|
| Investigate PM | PASS exit 0 (FIX-004 parser) |
| Planning PM | PASS exit 0 |
| Implementation workers | barrier ALL PASS; artifacts ~120KB/96KB JSON dumps |
| Implementation PM | **REWORK** exit 1 — substantive, justified |
| Terminal | **BLOCKED** |

**Classification:** worker artifact defect + prompt defect. **Runtime behaved correctly.**

## Ad-hoc verify

`scripts/validate-implementation-artifact.py` + `/tmp/hermes-verify-fix005.sh` pattern (good md PASS, 020 dump REJECT). Not suite green.

## After FIX-005

Ready for **new** guarded Runtime OAT (new TASK). Do not rerun 020 without user ask.

## IMP-012 (OAT 036) — preamble vs NDJSON

WECP **generate PASS** while PM **REWORK** for session lines before required H1 — load `references/imp012-implementation-session-preamble.md` (not FIX-005 JSON dumps).

## Chat monitoring (user preference)

Post **live OAT progress in chat**: poll #, fase, barrier, PM exit, server log lines — dashboard alone is insufficient. User: *report kesini yang complete atau yang baru mau mulai*.