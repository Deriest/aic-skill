# Runtime OAT — wrong task.start (043 vs 044)

## When to use

Operator/Dispatcher ran OAT but **validated the wrong fix bundle** because the pipeline executed a **different** `TASK-*` than the one just created.

## Evidence (2026-07-14)

| Task | Title | Started? | Objective |
|------|-------|----------|-----------|
| TASK-20260713-044 | OAT-FIX018-FIX019 | **No** (created only) | FIX-018 Closeout + FIX-019 repair |
| TASK-20260713-043 | SyncTest | **Yes** | FEAT-001 Investigate-only scope |

Symptom: user asked for FIX-018/019 end-to-end; run reached Implementation PM REWORK on **043**; **Closeout never executed** → FIX-018 OAT **FAIL** by definition.

## Root cause class

**Execution error**, not prompt regression:

1. `task.create` → `taskId: TASK-…-044`
2. `task.start` passed **`TASK-…-043`** (leftover / typo / copy-paste)
3. Poll and reports tied to **043** `context.json`

## Mandatory checks after start

```text
create.taskId == start.taskId == currentTask.id
context.json title/description match OAT brief (e.g. OAT-FIX018-FIX019)
```

If mismatch: **cancel** active task (`task.cancel`), do **not** claim FIX-018/019 PASS/FAIL from the wrong id.

## Cancel API

```bash
curl_api -X POST http://127.0.0.1:6868/api/runtime/intent \
  -H 'Content-Type: application/json' \
  -d '{"intent":"task.cancel","taskId":"TASK-20260713-042"}'
```

`/api/tasks/TASK-*/cancel` → **404** on this server; use **runtime intent**.

## FIX-019 partial signal on wrong task

Planning log may still show `planning-post-gen-gate.py` FAIL line — proves gate **ran**, not that OAT objective was met.

## Related

- `references/runtime-oat-preflight-fix008-009.md`
- `references/runtime-fix018-closeout-manifest.md`
- `references/runtime-fix019-pm-repair-respawn.md`