# Runtime OAT — Planning PM artifact alignment (OAT 037)

## When to load

FIX-010/013 chain **PASS** on Investigate; Planning workers complete; **PM Planning REWORK** citing **inconsistent or off-scope** `architect-output.md` / `research-output.md` vs `pm-output.md`. **Not** FIX-014 (Implementation never ran).

## Symptom (037)

- `pm-output.md` — FIX-014 / OAT scope, WPs, architecture XML — PM says largely complete
- `architect-output.md` — different thread (e.g. context management / scalability)
- `research-output.md` — orthogonal topic (e.g. memory layer vs Mem0)
- PM: three artifacts read as unrelated; weak Investigate → Planning traceability for scoped OAT

## Distinction

| Failure | Phase | Fix class |
|---------|-------|-----------|
| Session preamble before H1 | Implementation | FIX-014 WECP normalize |
| Architect/research off-task | Planning | Worker prompts, task description, parallel worker isolation |
| PM argv / empty verdict | Any PM gate | FIX-011–013 |

## OAT task description

Thin or generic `task.create` description → parallel Planning workers drift. For scoped OAT (FIX-014, FIX-013), description should name **single proof target** and bind architect/research to same WPs as `pm-output`.

## Minimal corrective action

1. **Respawn** architect/research with prompts referencing task `description` + Investigate `pm-output.md` + FIX scope
2. **Or** narrow Planning barrier / contracts so off-scope roles skip PM bundle criteria
3. **Or** amend task acceptance to declare parallel tracks explicitly

**Runtime:** REWORK → BLOCKED is correct; no engine change.

## User preference

Scoped OAT reports should state **which fix was validated** vs **which phase blocked** (e.g. "FIX-014 not reached; Planning REWORK").