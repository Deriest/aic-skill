# Phase Deliverable Contract — IMP-002 Pilot (shipped)

## Single source of truth

- `.aic/phase-contracts/investigate.json` — role `pm` → `pm-output.md`
- `.aic/phase-contracts/implementation.json` — `backend`, `frontend`
- **No prompt prose in JSON** — only `requiredSections`, `validation`, `acceptanceCriteria`, `promptRules`

## Consumers (same contract)

| Component | Mechanism |
|-----------|-----------|
| `phase-contract-loader.py` | `prompt-block`, `pm-rubric`, `artifact-files`, `load` |
| `phase-runner.sh` | `prompt-block` replaces FIX-005/006 heredocs for pilot phases |
| `validate-phase-artifact.py` | Unified structural validation |
| `spawn-worker.sh` | Fail lease only if role exists in phase contract |
| `pm-review.sh` | Prepends `pm-rubric` before artifact bodies |
| `engine/index.js` | `filterPmArtifacts` — PM sees contract-listed filenames only (pilot phases) |

**Restart `server.js` after engine changes** — old process won't load `filterPmArtifacts`.

## OAT runner pitfalls

- **Health:** `GET /health` (public). **`/api/health` → 404** → false INVALID.
- **Task:** `POST /api/task-start` with `title`, `description` (≥40 chars, explicit scope), `projectDir`.
- **Poll:** `GET /api/status` — `engine.pipelineState`, `currentTask.status`; `failed`/`BLOCKED` may not mirror in top-level fields; also read `.aic/tasks/<id>/engine.json` + server log.
- **Do NOT** rerun identical `/tmp/hermes-verify-*` scripts when user said verification complete — stale workspace flag ≠ missing evidence.

## Forensics taxonomy (first defect only)

When Runtime OAT BLOCKED, classify:

1. **Contract** — schema wrong / missing sections in JSON
2. **Prompt** — renderer didn't inject contract (empty `prompt-block`)
3. **Worker** — output doesn't meet contract (PM REWORK substantively correct)
4. **PM Review** — parser UNKNOWN (FIX-004) or rubric ignored
5. **Runtime** — FSM/barrier wrong despite good artifacts

**OAT 021 / 022 pattern:** Runtime + PM + contract rubric **correct**; **Worker** failed substantive Investigate report (executive summary) or post-REWORK spawn failed `validate-phase-artifact.py` (artifact deleted, empty `reports/`).

## Minimal OAT poll script shape

```bash
API=http://127.0.0.1:6868
curl_api "$API/health" | grep -q '"ok":true'
# task-start → poll /api/status every 60s until COMPLETE or failed/BLOCKED in checkpoint
```

Log: `/tmp/aic-server-6868.log` — `PM Review`, `Phase`, `artifact contract`, `REWORK`.

## Known limitations (pilot)

- Planning / Verification / Closeout — no phase-contract JSON yet
- `runtime-contracts.json` not split; engine `finishLease` still global minBytes
- Rework path: PM REWORK then re-spawn must still pass contract validator before barrier

## Supersedes

- FIX-006 heredoc in `phase-runner.sh` for Investigate pm → **data in investigate.json**
- FIX-005 duplicate section lists → **implementation.json** + unified validator

See `references/phase-deliverable-contract-investigation-imp001.md` for full architecture plan.