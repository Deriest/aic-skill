# IMP-024 Worker Layer (post Runtime Stability)

Runtime Stability **CLOSED** (`45b04e8`, `3e98b02`).

| Milestone | Commit | Scope |
|-----------|--------|--------|
| IMP-024-A | `0916f9f` | NDJSON extraction boundary, no cp fallback |
| IMP-024-B | `7c36a44` | Session extract, legacy Strategy B, lease JSON payload |
| IMP-024-C | pending | Trivial classifier, noop regen, impl template |

## Focused smoke vs Runtime OAT

- **Focused smoke:** one boundary; cancel task after evidence (`task.cancel`).
- **Runtime OAT:** full pipeline; guarded preflight.

Strategy B absent in logs when pass-1 extract succeeds = expected.

Planning PM REWORK ≠ session-milestone FAIL.

See `references/imp024-c-trivial-task-reliability.md`, `references/worker-reliability-baseline-imp024.md`.