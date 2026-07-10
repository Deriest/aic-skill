# Regression Patch Pattern

## When to Use

When Runtime OAT or Verification discovers regressions in a previously closed milestone.

## Structure

Regression Patches are **strictly scoped** — fix ONLY the regressions, nothing else.

### Naming
- `RP-NNN` (e.g., RP-001, RP-002)
- One RP per regression batch

### Phases
1. **Investigation** — Identify root cause, affected files, fix plan
2. **Implementation** — Implement fixes within declared scope only
3. **Verification** — Verify fixes with ad-hoc scripts

### Deliverables
- `RP-NNN-ROOT-CAUSE.md` — Root cause analysis
- `RP-NNN-IMPLEMENTATION-REPORT.md` — What was changed
- `RP-NNN-VERIFICATION-REPORT.md` — Evidence of fix

## Strict Rules

- Fix ONLY the regressions listed
- Do NOT add features
- Do NOT redesign architecture
- Do NOT modify milestone planning
- Do NOT touch unrelated code
- Do NOT rename/move files
- Modify minimum number of files

## Completion

```
Regression Patch RP-NNN = COMPLETE
Ready to resume Milestone <M> Runtime OAT
```

## Example: RP-001 (Milestone G)

Discovered during Milestone G Runtime OAT:
- Dashboard blocked by auth middleware
- Worker status updates silently failing
- Multiple server instances

Root cause: Milestone F auth feature blocked internal runtime communication.

Fix: `api-auth.sh` helper + scope auth to `/api/*` only + error logging.

Files changed: 7 (api-auth.sh + 5 scripts + server.js)
