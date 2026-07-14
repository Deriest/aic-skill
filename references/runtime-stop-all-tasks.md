# Stop all runtime tasks (user command)

## When user says stop semua task / stop all tasks

Do **not** `pkill node` on port 6868 unless they ask to kill the server. Prefer engine intents + stray process cleanup.

## Sequence (verified 2026-07-13 IMP-003 OAT)

1. **Kill OAT pollers** (optional): `pkill -f '/tmp/hermes-oat-imp003.sh'` or `process.kill` on known `proc_*` session ids.
2. **Kill stray workers** (if any): `pkill -f 'spawn-worker.sh|phase-runner.sh|worker-execution-pipeline.py|opencode run'` — verify with `ps` first.
3. **Pause engine:** `POST /api/runtime/intent` `{"intent":"task.pause"}` → `ok: true`, `engine.paused: true`.
4. **Cancel current task:** `POST /api/runtime/intent` `{"intent":"task.cancel","taskId":"<currentTask.id>"}` — omit `taskId` to cancel `state.currentTask`.
5. **Verify:** `GET /api/status` → `currentTask: null`, `paused: true`.

Use `source scripts/api-auth.sh` and `curl_api` — never raw curl without key when auth enabled.

## Pitfall: `task.pause` intent ignores `paused` field

**Bug:** The engine's `task.pause` handler always sets `state.engine.paused = true` regardless of the payload. Sending `{"intent":"task.pause","paused":false}` does **not** unpause the engine.

**Fix:** Use `{"intent":"task.resume"}` to unpause — it always sets `paused=false`.

**Evidence:** `engine/index.js` L541-549 — `case 'task.pause'` always assigns `true`; `task.resume` (fallthrough) assigns `false`. No conditional on `body.paused`.

**Impact:** OAT scripts that attempt `task.pause` with `paused:false` will leave the engine paused. Task 029 stalled ~5min until manual `task.resume`.

**Correct unpause sequence:**
```bash
curl_api -sf -X POST "$API/api/runtime/intent" -H 'Content-Type: application/json' \
  -d '{"intent":"task.resume"}'
```

## Limits

- `task.cancel` clears **current** task snapshot and checkpoints to `CANCELLED`; it does **not** delete historical `.aic/tasks/TASK-*` folders.
- Stale **active leases** in persisted `state.json` may remain until next reconcile; cancel + pause stops new pipeline work.
- Overlapping OAT drivers on the same task cause confusing poll logs — kill pollers before starting a new OAT.

## Related

- Guarded OAT preconditions: `references/runtime-oat-guarded-forensics.md`
- Cross-task BLOCKED: `references/runtime-checkpoint-task-isolation.md`