# Runtime Stability milestone closeout (FIX-008 → FIX-021)

## Shipped (local commit example)

- **Commit:** `Runtime Stability Bundle (FIX-008 → FIX-021)` — e.g. hash `45b04e8`
- **OAT acceptance:** `TASK-20260713-045` → **COMPLETE** (FIX-018/019/020 chain on OAT task)
- **FIX-021:** cross-phase `runPhase(artifactPhase)` re-entry — ad-hoc `OK_FIX021_*`

## Stage ONLY (git)

**Include:**

- `scripts/engine/**`, `server.js`, `ops-endpoints.js`
- WECP: `worker-execution-pipeline.py`, `spawn-worker.sh`, `worker-completion-contract.sh`, `opencode-json-to-md.py`, `pipeline-orchestrator.sh`
- PM/repair: `pm-review.sh`, `pm-repair-respawn.js`
- Planning: `phase-runner.sh`, `planning-post-gen-gate.py`, `phase-contract-loader.py`
- Closeout: `closeout-context-block.py`
- Validators: `validate-phase-artifact.py`, `validate-implementation-artifact.py`
- Docs: `references/runtime-fix008*.md` … `runtime-fix021*.md`

**Exclude:**

- `.aic/**`, `tasks/**`, `reports/**`, `scripts/__pycache__/**`
- `dashboard/**`, promo/website refs, `templates/promo-*`
- Ad-hoc `/tmp/hermes-verify-*` (evidence only, not committed)
- Unrelated IMP/OAT session notes unless explicitly in scope

## Validation claims (honest)

| Claim | Basis |
|-------|--------|
| FIX-018 Closeout E2E | OAT **045** reached Closeout PM PASS |
| FIX-019 Planning repair | Implemented; **partially** exercised on 045 (Planning often PASS first try) |
| FIX-020 | Node `spawnNode` + `resolvePmRepairTargets`; no `use strict` bash on `.js` |
| FIX-021 | Implemented + ad-hoc verify; **not** proven by 045 alone if only in-phase repair ran |

## Known limitation (next milestone)

**Worker Reliability** — nondeterministic opencode/session artifacts:

- **047:** Planning pm → NDJSON in `pm-output.md` (IMP-020)
- **001:** Implementation frontend barrier incomplete

Smoke **2× FAIL** on different workers ≠ rollback Runtime Stability bundle if OAT **045 COMPLETE**.

## User workflow

- *reportnya* → compact table (OAT / smoke / commit / next), not essay
- *stop* → halt smoke/OAT; do not auto-rerun
- Commit only on explicit ticket; **no push** unless asked

## Stale verify banner

`{"ok":true,"port":18802,"uptime":79844}` is **not** proof of latest engine edit. Use fresh `/tmp/hermes-verify-fix0XX-*` output.