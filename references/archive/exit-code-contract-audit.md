# Exit Code Contract Audit

## Caller 1: `scripts/rework-handler.sh` (Calling `pm-review.sh`)
- **Exit 0:** Evaluates to `PASS`. Exits 0 and triggers API update to PASS.
- **Exit 1:** Evaluates to `REWORK`. Loops (`continue`) to spawn workers again.
- **Exit 2:** Evaluates to `BLOCKED`. Exits 1, halting the repair loop.
- **Exit 3:** Evaluates to `UNKNOWN`. Loops (`continue`), treating it effectively identically to `REWORK`.
- **Exit 4:** Not explicitly handled; falls through to `*)` which evaluates to `UNKNOWN` and loops (`continue`).

## Caller 2: `scripts/engine/index.js` (Calling `pm-review.sh` via API/Engine)
- **Exit 0:** `allPass = true`. Evaluates to `PASS`.
- **Exit 1:** Evaluates to `REWORK` (`code === 2 ? 'BLOCKED' : 'REWORK'`).
- **Exit 2:** Evaluates to `BLOCKED`.
- **Exit 3:** Evaluates to `REWORK`.
- **Exit 4:** Evaluates to `REWORK`.

## Caller 3: `scripts/phase-runner.sh` (Calling `spawn-worker.sh`)
- **Exit 0:** Wait succeeds. Worker marked successful.
- **Exit 1 (or any non-zero):** Wait fails. Worker added to `FAILED_WORKERS`. The script eventually exits 1, causing the engine to mark the phase `failed`.
- **Exit 2, 3, 4:** Handled exactly the same as Exit 1 (any non-zero is a failure).

## Caller 4: `scripts/engine/index.js` (Calling `phase-runner.sh`)
- **Exit 0:** Phase barrier success, `ok: true`.
- **Exit 1-4:** Phase barrier failure, `phaseStatus = 'failed'`, halts execution, emits `worker.failed`.

## Conclusion on Exit 4
**Exit 4 is NOT defined consistently.**
- `pm-review.sh` documents `4` as "Error (timeout, missing artifacts)" in its header.
- `rework-handler.sh` catches `4` via the `*)` wildcard and interprets it as `UNKNOWN` (triggering a retry loop).
- `engine/index.js` interprets `4` as `REWORK`, incrementing the `rework.attempt` counter.

Because Exit 4 triggers inconsistent and undesirable behavior (rework loops instead of pipeline aborts) in upstream callers, **implementing timeout -> Exit 4 in `pm-review.sh` violates the consistency rule.** 
Therefore, timeout handling will remain mapped to its current natural exit code (Exit 3 in `pm-review.sh` due to parsing failure), and I will not force it to Exit 4. 
