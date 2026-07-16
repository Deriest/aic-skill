# Planning: Designer required for website / promo UI tasks

**User (2026-07-13):** *"kita ga pakai designer ? kan ini website"*

## When mandatory

Spawn **Luna (Designer)** in **Planning** when the deliverable is user-facing UI:

- Marketing one-page / landing for aic-skill
- Any **website**, dashboard skin, or static publishable front door
- Work packages assign **Luna** to Plan tasks (design tokens, dashboard mock) — if Luna was never spawned, Planning is **incomplete**

A **design-brief** in `.aic/prompts/` (Dispatcher-written constraints) is **not** a substitute for `docs/design-spec.md` (or `ux-spec.md`) from Luna.

## Correct Planning sequence (promo / website)

1. **Architect** → `docs/architecture-spec.md`
2. **Designer** → `docs/design-spec.md` (tokens, section layout, typography, dashboard mock rules, responsive breakpoints)
3. **PM Review** on **both** artifacts (and `discovery-report.md` / `work-package.md` from Investigate)
4. **Implementation** → Frontend (Leo) reads arch + **design spec** + design-brief

Do **not** spawn Frontend after Architect-only Planning when user asked for dashboard-matched visuals.

## If Frontend already running without design spec

1. Ask user: **strict** (kill Frontend → spawn Luna → PM Review → re-spawn Frontend) vs **pragmatic** (finish Leo → Luna/QA visual rework)
2. Default when user challenged missing designer: **strict** unless they choose pragmatic

## PM Review artifact list

```bash
pm-review.sh Planning /project \
  docs/architecture-spec.md \
  docs/design-spec.md
```

## Cross-refs

- `references/promo-landing-site-pattern.md`
- `references/dispatcher-lifecycle.md`
- `dispatcher-discipline-aic` → `references/pipeline-strictness.md`