# Intake Routing (EPIC-201) — Dispatcher Implementation (WP-202)

**Planning authority:** `references/epic-201-wp201-intake-routing-architecture.md`

## Four modes (frozen)

| Mode | Pipeline | Workers |
|------|----------|---------|
| Conversation | Never | Never |
| Quick | After completeness PASS | Via existing `task.create` / `task.start` only |
| Discovery | After PRD + operator approval | Not until approved Build path |
| From PRD | **Build** only after gap + approval | Review/Improve/Architecture/Estimate: **no** `task.start` |

## Requirement completeness

Run (optional debug):

```bash
python3 scripts/intake-evaluate.py --text "user message"
python3 scripts/intake-evaluate.py --case discovery
```

**PASS** / **FAIL** only — no confidence %.

## Discovery

- Questions: min 3, target 5–7, max 10
- **Validator** sets `missing_for_planning`; **LLM** words one question from `llm_question_input` / `--discovery-payload` (see `templates/intake-discovery-question-prompt.md`)
- Output: `PRD_<ProjectName>.md` (use `templates/PRD_TEMPLATE.md`)
- Stop at 10 → Missing Information List + requirement status + recommended next action

## From PRD — Intent resolution (§1.6)

| User | Action |
|------|--------|
| PRD only | ONE question: Review / Improve / Architecture / Estimate / Build |
| Review / Improve / Architecture / Estimate | Execute; **no** pipeline |
| Build | Gap checklist → operator approval → `task.start` |

## Operator communication (RH-003)

Report: status, next action, missing fields — not internal mode names unless diagnostic requested.

## Pipeline start rule

Dispatcher calls `task.create` / `task.start` **only** when:

- Quick + completeness PASS, or
- From PRD intent **build** + gap PASS + explicit operator approval, or
- Discovery finished PRD + explicit operator approval for build

## Legacy

`dispatcher-discovery.md` confidence % **not** used for intake routing.