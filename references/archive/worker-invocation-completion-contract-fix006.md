# Worker Invocation Completion Contract (FIX-006)

## Problem

`opencode run <prompt> -m <model> --auto --format json` may end with **exit 1** and a JSON session that has **tool_use** / `step_finish reason=tool-calls` but **no** `type:text` assistant parts. `opencode-json-to-md.py` correctly rejects these (`no assistant text in session; do not submit raw JSON`).

**Not** Runtime, WECP, validator, or PM Review defects — failure is **before** structural validation when generate extraction fails.

**Evidence (028):** Server log: `WECP: opencode exit=1` → extractor message → `generate extraction failed`. Retained sessions (`wecp-out-*.txt`): 40× `tool_use`, 1× short text (61 chars); all `step_finish` = `tool-calls`.

## Root cause (classification)

**Primary:** `--auto` + prompt without mandatory **final assistant markdown** → provider session ends in tool loop.

**Secondary:** `TIMEOUT` for `pm` (180 in `spawn-worker.sh`) was **not exported** to WECP child → WECP defaulted `gen_timeout=1800` from env default (parity gap, not proven sole cause of 028).

**Legacy vs WECP (same opencode argv):** Identical flags and Node runner pattern. Differences: phase contract block in prompt, WECP strict extract (no `cp` raw JSON fallback), optional missing completion contract, `TIMEOUT` export gap.

## Shipped fix (worker layer only)

| Piece | Location |
|-------|----------|
| Shared completion text | `scripts/worker-completion-contract.sh` |
| Inject all phase-runner workers | `phase-runner.sh` → `COMPLETION_BLOCK` after contract block |
| Sub-workers | `spawn-sub.sh` appends if block absent |
| TIMEOUT parity | `spawn-worker.sh` → `export TIMEOUT` before `worker-execution-pipeline.py` |

### Completion contract (required statements)

- Task not complete until final assistant message exists
- Final message = complete markdown report (deliverable)
- Tool execution alone does not satisfy contract
- Do not end session after tools only
- After full report in assistant text, stop; no further tool calls

## OAT 029 results (FIX-006 Runtime OAT)

**Result: FAIL** — Completion Contract correctly injected but still insufficient.

**Evidence:**
- Prompt `/tmp/aic-phase-Investigate-pm.txt`: mtime=16:39:30, size=1606 bytes (pre-FIX=1288), `grep -c "Worker Invocation Completion Contract"` = **2** — contract present
- `spawn-worker.sh`: `export TIMEOUT` present before WECP python3 call
- opencode invoked: `opencode run /tmp/aic-phase-Investigate-pm.txt -m aic/Opus --auto --format json` (PID 201398)
- WECP temp `/tmp/wecp-md-cnb7a0j3.md` = **0 bytes** — no assistant text extracted
- Result: Investigate failed (poll#19)

**Conclusion:** The Completion Contract is advisory (prompt-level) and `--auto` does not enforce it at CLI level. The model still enters tool-call loops and terminates without final text. See `opencode-session-termination-imp006.md` (classification **C**).

**Next steps (not yet implemented):**
1. WECP-level retry with strengthened prompt prefix on empty-text failure
2. Test without `--auto` to see if model produces text when not auto-approving tools
3. CLI-level `--require-text-before-exit` (opencode feature request)

## OAT script pitfall: `task.pause` vs `task.resume`

**Bug:** `task.pause` intent handler in engine always sets `paused=true` regardless of payload field `paused:false`. The `task.resume` intent correctly sets `paused=false`.

**Impact on OAT:** Script `/tmp/hermes-oat-imp006.sh` sent `{"intent":"task.pause","paused":false}` which left engine paused. Task 029 stalled for ~5min until manual `task.resume` via API.

**Fix in OAT scripts:** Use `{"intent":"task.resume"}` not `{"intent":"task.pause","paused":false}`.

**Engine code evidence:** `engine/index.js` L541-549:
```javascript
case 'task.pause': {
    state.engine.paused = true;   // always true, ignores body.paused
    ...
    break;
case 'task.resume': // (falls through)
    state.engine.paused = false;
```

## Verification (targeted, not Runtime OAT)

Ad-hoc `hermes-verify-fix006-*.sh`: `bash -n` on four scripts, grep phrases, `export TIMEOUT` before WECP, assembled prompt contains contract. **Do not** claim Runtime OAT PASS from this alone.

## Related

- `wecp-architecture-and-pitfalls.md` — timeout, capture_output, md_file cleanup
- `opencode-json-artifact-and-metrics.md` — extract vs raw JSON
- `runtime-oat-investigate-pm-fix006.md` — **different** issue (PM REWORK on executive summary / section quality after artifact exists)
- `runtime-stop-all-tasks.md` — stop/pause/cancel patterns
