# Investigate PM deliverable (FIX-006)

## Symptom (OAT 021)

- Investigate worker `pm` completes; barrier ALL PASS.
- PM Review Investigate → **REWORK** (exit 1), not parser UNKNOWN.
- PM feedback: `pm-output.md` is an **executive summary** — counts criteria/dependencies without enumerating them; references content not in file.

## Classification

- **Worker artifact defect** / **prompt defect** — Runtime and PM behaved correctly.
- Distinct from FIX-004 (verdict parse) and FIX-005 (Implementation NDJSON).

## Fix (shipped)

`phase-runner.sh`: for `PHASE=Investigate` + `worker=pm`, append contract block requiring:

- `# Investigate Report` + sections: Objective, Scope, Requirements Identified, Assumptions, Unknowns, Risks, Dependencies, Acceptance Criteria, Recommendation.
- No executive summary, placeholders, external refs, counts without full text.

## Verification

Ad-hoc: `grep` headings in `phase-runner.sh` + `bash -n`. Not canonical OAT.

## OAT monitor (user preference)

Post live updates in chat for every Runtime OAT: TASK id, phase, PM exit, terminal state — proactively.