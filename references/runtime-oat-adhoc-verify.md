# Runtime OAT — ad-hoc verification (no canonical suite)

When Hermes reports **stale verification** after `engine/index.js` / `phase-runner.sh` edits, run a **focused** check — not full CAT A–J unless user asks.

## What to prove (FEAT-001 task-scope fix)

| Check | Expect |
|-------|--------|
| `node --check` engine | exit 0 |
| `bash -n` phase-runner | exit 0 |
| `task.create` short description | HTTP 400, `error: description_required` |
| `task.create` + `task.start` | `taskId` returned |
| Second `task.start` while pipeline running | `error: pipeline_busy` |

## Preferred runner: Python one-shot

Hermes `terminal()` on Linux **rejects** foreground `&` for server start. Use **background=true** for the server, then **python3** subprocess for curls — or run bundled script:

```bash
bash scripts/hermes-verify-task-scope-runtime.sh
```

## pipeline_busy timing

Poll `GET /api/status` until `engine.pipelineRunning === true` **before** second `task.start`. A fixed `sleep 0.2` alone can flake; poll up to ~2s.

## OAT driver

Full Runtime OAT: ephemeral `/tmp/hermes-oat-feat001-full.sh` or project copy — must include **long description** in `task.create` JSON, restart server on **6868**, poll until `COMPLETE` / `BLOCKED` / `TIMEOUT`. Do not claim suite green from ad-hoc pass=6 alone.

## User output shape (forensic / fix tickets)

When user forbids markdown reports: return only **Implementation Summary**, **Files Modified**, **Verification Result**, **Runtime OAT Result**, **Ready to Commit** — no extra prose.