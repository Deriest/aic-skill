# IMP-020 — Planning PM session dump (TASK-20260713-047)

## Symptom

- `pipelineState: PLANNING`, `phaseStatus: failed`, `pipelineRunning: false`
- Barrier: `architect` + `research` **complete**, **`pm` missing**
- `pm-output.md` exists (large, e.g. 24KB) but **not markdown**

## Root cause (primary: Worker Runtime)

1. `spawn-worker.sh` / opencode ran successfully for Planning **pm**.
2. Artifact written to `reports/pm-output.md`.
3. Content is **raw NDJSON** (`{"type":"step_start","sessionID":...}`) — session event stream, not report.
4. `phase-runner.sh` after `wait`: `validate-phase-artifact.py` → `is_session_dump()` → **FAIL**.
5. `FAILED_WORKERS+=(pm)` → exit 1 → engine returns early → **no** `markWorkerComplete` for pm.

**Not:** barrier bug, checkpoint bug, FIX-021, or cross-phase repair.

## Compare architect / research (same task)

| Worker   | Artifact   | Validator |
|----------|------------|-----------|
| architect| markdown   | PASS      |
| research | markdown   | PASS      |
| pm       | NDJSON dump| FAIL      |

## Evidence checklist

- `head -c 200 reports/pm-output.md` — JSON line vs `## Task Authority`
- `stat` timestamps — pm often finishes **after** architect/research
- `engine.json` — `phaseBarrier.completed` without `pm`
- No `cross-phase re-entry` in log for this failure mode

## Classification

**Worker Runtime** (transient opencode output shape). Validator and engine behaved correctly.

## Smoke retry (001)

Planning **pm** produced valid markdown → IMP-020 path **not reproduced** on retry; later **Implementation frontend** barrier fail is a **different** worker issue (Worker Reliability milestone).

## Minimal corrective action (engineering, separate milestone)

- Harden worker layer: ensure WECP / `opencode-json-to-md.py` / completion contract always emit markdown to `reports/*-output.md`.
- Do **not** weaken `validate-phase-artifact.py` to accept session dumps.
- Optional: stronger prompt line in `phase-runner.sh` for pm — markdown only.

## Related

- `validate-phase-artifact.py` — `SESSION_MARKERS`, `forbidSessionDump`
- `references/opencode-json-artifact-and-metrics.md`
- `references/worker-invocation-completion-contract-fix006.md`