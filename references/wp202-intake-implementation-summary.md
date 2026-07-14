# WP-202 — Intelligent Intake Implementation Summary

## Files modified / added

| Path | Role |
|------|------|
| `scripts/intake-evaluate.py` | Deterministic completeness + mode routing |
| `scripts/verify-wp202-intake.sh` | Routing verification (9 cases + engine regression) |
| `references/intake-routing-epic201.md` | Dispatcher operator spec (WP-202) |
| `references/dispatcher-discovery.md` | Intake vs in-pipeline confidence note |
| `templates/PRD_TEMPLATE.md` | Discovery artifact template |
| `templates/intake-checklists/website.yaml` | Website mandatory fields |
| `templates/intake-checklists/generic.yaml` | Fallback checklist |
| `SKILL.md` | Router line (intake) — pre-existing |
| `~/.hermes/skills/aic/dispatcher-discipline-aic/SKILL.md` | RH-004 + PRD intent + evaluator pointer |

**Not modified:** `scripts/engine/`, `server.js`, `rework-handler.sh`, WECP, workers, dashboard.

## Implementation summary

- **Conversation / Quick / Discovery / From PRD** implemented in `intake-evaluate.py` + documented in `intake-routing-epic201.md`.
- **No confidence %** for routing; YAML mandatory fields + pattern match (extend in WP-203).
- **From PRD:** explicit intents; upload-only → `clarify_one_question`; only **build** sets `pipeline_allowed: true`.
- **Discovery:** bounds + `PRD_<Project>.md` template; pipeline blocked until approval (Dispatcher procedure).
- **RH-001/002/003:** enforced via existing discipline skill + no worker spawn flags on non-build paths.

## Routing verification

```
bash scripts/verify-wp202-intake.sh → OK_WP202_INTAKE_VERIFY
```

| Case | Mode | pipeline_allowed |
|------|------|------------------|
| conversation | conversation | false |
| quick | quick | true |
| discovery | discovery | false |
| from_prd_review | from_prd | false |
| from_prd_improve | from_prd | false |
| from_prd_architecture | from_prd | false |
| from_prd_estimate | from_prd | false |
| from_prd_build | from_prd | true |
| from_prd_upload_only | from_prd (clarify) | false |

## Regression verification

- `git diff HEAD -- scripts/engine/index.js scripts/server.js` → **clean**
- No `task.start` in intake scripts (Dispatcher-only gate remains procedural)

## Remaining work (WP-203 suggestion)

1. YAML checklists for all WP-201 domains (mobile_app, api, …).
2. Session state file `.aic/intake-session.json` (question count, approval flag).
3. `aic intake evaluate` CLI wrapper.
4. Richer field extraction from attached PRD files (read_file in Dispatcher flow).
5. Dashboard read-only intake mode display (optional).

**No commit** — await PM review.