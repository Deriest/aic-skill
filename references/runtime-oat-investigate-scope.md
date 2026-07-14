# Runtime OAT — Investigate scope and PM gate

## Problem

`phase-runner.sh` builds a **4-line** generic prompt (`You are the pm… Phase: Investigate… Execute your assigned tasks…`). With **empty** `task.create` description, the PM worker **drifts** to repo discovery (`requirements.json`, unrelated `TASK-20260708-008` issues) instead of the OAT task title.

PM Review then returns **REWORK** (duplicate sections, non-standard verdicts) — **justified** against artifact quality, not a PM script defect.

## OAT task.create minimum

For Runtime / FEAT-001 OAT, always set:

- **title** — short label
- **description** — explicit scope, e.g. “Prove FEAT-001 runtime: single pipeline, bounded Investigate report only; no implementation.”
- **projectDir** — absolute path

Optional: attach `requirements.json` path in description only if that is the intended work package.

## Investigate deliverable (PM worker)

Prompt should require **one** markdown report with:

- Task id and title from `context.json`
- User story / acceptance criteria **for this task only**
- **VERDICT** line not required in worker artifact (PM review adds verdict); worker output = discovery report only

## PM gate evidence

- **PASS** requires `pm-review.sh` exit **0** and parseable `VERDICT: PASS`
- **REWORK** exit **1** → engine may set **BLOCKED** on **that** task’s checkpoint (if task isolation holds)
- Empty `reports/` → PM skipped (`allPass: true`) — pipeline should **not** BLOCK on PM for that task

## spawn-worker / metrics

- `set -u`: never reference `$INPUT_TOKENS` before assignment; metrics POST from **raw** opencode JSON file
- Artifact path: `opencode-json-to-md.py` before copy to `reports/{worker}-output.md`

See `opencode-json-artifact-and-metrics.md`.