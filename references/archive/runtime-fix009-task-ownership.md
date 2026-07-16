# FIX-009 — Runtime task ownership guard (`task.start`)

## Defect (OAT 030 / 031)

- **030** retained `currentTask` (non-terminal: PLANNING / failed).
- **031** `task.create` succeeded → **CREATED / idle** forever.
- Engine continued **030**; OAT poller showed only `task=031` while no pipeline ran on 031.

`task.start` only checked `pipelineRunning`, not whether another task still owned the Runtime.

## Fix (`scripts/engine/index.js`)

**Order in `task.start`:**

1. `pipelineRunning` → `pipeline_busy` (unchanged)
2. If `state.currentTask?.id` exists and `!== body.taskId`:
   - Load owner checkpoint; if `pipelineState` is **not** `COMPLETE` or `CANCELLED` → **`task_active`**
3. Else normal start

**Response shape:**

```json
{
  "ok": false,
  "error": "task_active",
  "message": "Another task still owns the Runtime until it is COMPLETE or CANCELLED.",
  "activeTaskId": "TASK-...",
  "activePhase": "...",
  "pipelineState": "..."
}
```

`task.create` **unchanged** — idle tasks may still be created; only **execution** is guarded.

**BLOCKED / FAILED** still own Runtime until explicit `task.cancel` or completion paths clear ownership.

## OAT preflight (mandatory)

Before `task.create` + `task.start` on a **new** OAT task:

1. `GET /api/status` → `engine.pipelineRunning`, `currentTask`
2. If `pipelineRunning` → **stop**; report `pipeline_busy`; do not create OAT task
3. If `currentTask` non-terminal → `POST` `{"intent":"task.cancel","taskId":"<id>"}` (supported release)
4. Confirm `currentTask == null` and `pipelineRunning == false`
5. **Restart** `node scripts/server.js` after engine patches (FIX-008/009)
6. `task.create` then `task.start` — **assert** `ok:true`; if `task_active` or `pipeline_busy`, **stop** (do not poll idle CREATED task)

## Verification (ad-hoc)

`/tmp/hermes-verify-fix009-*`: `node --check`, `task_active` error shape, `pipeline_busy` before `ownerId` in `task.start`.

## Proven OAT (032, post FIX-008+009)

| Check | Result |
|-------|--------|
| Preflight after cancel 030 | idle |
| `task.start` 032 | `ok:true` |
| FIX-009 | no competing CREATED owner |
| Investigate PM | PASS, no TypeError |
| IMP-007 continue | skipped (pass 1 WECP PASS) |

## Related

- `runtime-fix008-post-oat.md` — PM `let artifacts`
- `runtime-checkpoint-task-isolation.md` — cross-task checkpoint sync (different class)
- `runtime-oat-preflight-fix008-009.md` — combined guarded OAT script pattern