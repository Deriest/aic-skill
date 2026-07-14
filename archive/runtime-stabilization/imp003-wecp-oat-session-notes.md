# IMP-003 session notes — WECP OAT fixes (2026-07-13)

Supplement to `wecp-architecture-and-pitfalls.md` when patching that file is blocked.

## export TIMEOUT before WECP

```bash
# spawn-worker.sh — before python3 worker-execution-pipeline.py
export TIMEOUT
```

Legacy Node path gets `$TIMEOUT` as argv; WECP reads `os.environ.get("TIMEOUT")`.

## Task stop (user: stop semua task)

1. `task.pause` → `task.cancel` via `/api/runtime/intent`
2. Verify `GET /api/status`: `currentTask: null`, `engine.paused: true`
3. Kill `/tmp/hermes-oat-*.sh` pollers; optional pkill stray workers

Full runbook: `runtime-stop-all-tasks.md`.

## OAT task lineage (IMP-003)

| Task | Note |
|------|------|
| 023–025 | Silent opencode / 120s kill / wrong API |
| 027 | MISSING_SECTION then FileNotFoundError on repair md |
| 028 | Long generate → exit=1, no assistant text |

Runtime OAT **not PASS** at session end; targeted verify 12/12 passed.