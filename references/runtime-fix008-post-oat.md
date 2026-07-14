# FIX-008 — runPmReview const fix & post-OAT notes

## Defect

`runPmReview()` built `artifacts` from `reports/*.md`, then reassigned:

`artifacts = filterPmArtifacts(skillDir, phase, artifacts)`

with `const artifacts = []` → **TypeError** after `ALL WORKERS PASSED` (029, 030 pre-fix).

## Fix (one line)

`let artifacts = []` in `scripts/engine/index.js` inside `runPmReview` only. PM PASS/REWORK/BLOCKED logic unchanged.

## Verification (ad-hoc, not suite)

`/tmp/hermes-verify-fix008-*`: `node --check`, `let` in `runPmReview`, no `const artifacts` in that function body.

## Runtime OAT prerequisites

1. **Restart** API after engine patch (kill old `node .../server.js`, start fresh).
2. **Unpause:** `POST /api/runtime/intent` `{"intent":"task.resume"}` — not `task.pause` + `paused:false` (pause intent always sets paused).
3. **Single active pipeline:** `task.create` + `task.start` on new TASK fails to run if another task holds engine (`031` idle while `030` active).

## Observed post-FIX-008 (TASK-030)

| Step | Result |
|------|--------|
| Investigate WECP generate | PASS |
| Continue (Strategy B) | Skipped (pass 1 had markdown) |
| PM Review Investigate | PASS exit 0 |
| Planning workers | `no contract (skip)` — legacy |
| Planning barrier | ALL WORKERS PASSED |
| Planning terminal | `phaseStatus: failed` (PM/barrier follow-up — investigate log tail) |

## IMP-007 continue (natural observation)

Do not force continue in OAT. Record: if pass 1 `generate PASS`, stderr must **not** contain `=== WECP: generate continue (Strategy B) ===`.

## Cost / metrics (FAQ)

Task **done** does not gate cost. `POST /api/metrics` from legacy `spawn-worker.sh` only (no `taskId`); WECP path often posts nothing. `summary.cost` = sum of all `metrics.json` entries. See `references/runtime-cost-metrics.md`.