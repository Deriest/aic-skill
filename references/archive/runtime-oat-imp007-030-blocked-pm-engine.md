# Runtime OAT IMP-007 — TASK-030 BLOCKED (engine PM)

## Result (pre-FIX-008)

**BLOCKED** — not a WECP/Strategy B failure on the successful worker run.

## What passed (worker layer)

- Task `TASK-20260713-030`, Investigate `pm`, WECP
- `=== WECP: generate PASS ===` → `reports/pm-output.md` (8643 B)
- `=== Phase Investigate: ALL WORKERS PASSED ===`
- Strategy B continue **not** invoked (pass 1 had artifact — expected)

## First failure (pipeline, pre-FIX-008)

Immediately after worker barrier:

```
[engine] pipeline error TypeError: Assignment to constant variable.
    at runPmReview (scripts/engine/index.js:184:15)
    at runPhase (scripts/engine/index.js:269:22)
```

- **PM Review** did not complete for 030
- API stuck: `pipelineState=INVESTIGATE`, `phaseStatus=barrier_wait`

## FIX-008 (shipped)

`const artifacts = []` → `let artifacts = []` in `runPmReview` (`engine/index.js` ~176). Ad-hoc verify: `hermes-verify-fix008-*` (`node --check`, scope check).

**Must restart** `node scripts/server.js` after deploy — running process keeps old code until SIGTERM.

## Post-FIX-008 OAT evidence (2026-07-13)

- **030** after restart: Investigate WECP PASS → **PM Review Investigate PASS** (no TypeError).
- **031** created by OAT script stayed **CREATED/idle** while engine ran **030** — guarded OAT needs **idle engine** (`currentTask` null or cancel stuck task) before `task.start` on new TASK.
- **030 Planning:** barrier ALL WORKERS PASSED → `phaseStatus: failed` (log truncated before Planning PM); workers logged `no contract (skip)` — legacy path, weak artifacts. Not FIX-008.

## OAT script / infra notes

- `task.pause` with `paused:false` still pauses engine — use **`task.resume`**
- Server **SIGTERM** during OAT leaves tasks idle until manual `task.start` after restart
- Poller may exit 0 early if server down — ground truth: `/tmp/aic-server-6868.log`
- See also `references/runtime-fix008-post-oat.md`

## Classification

**FIX-008:** Runtime PM gate const bug (resolved). **IMP-007 continue:** orthogonal; skip when pass 1 extracts. **Planning fail:** separate (contracts / legacy skip).