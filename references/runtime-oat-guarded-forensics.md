# Guarded Runtime OAT — forensics & INVALID vs BLOCKED

## When to use guarded re-run

Previous OAT **INVALID** when: server died mid-poll, driver exited after 1–2 polls, no terminal `COMPLETE|BLOCKED|CANCELLED|TIMEOUT`. **Not** the same as **BLOCKED** (valid FAIL).

## Preconditions (user mandate)

1. Server **6868** `/health` OK — restart `node scripts/server.js` (background) after **engine** patches; **no** broad `pkill node` / `pkill -f`.
2. `currentTask == null`, no leases — `task.cancel` stale tasks. **New OAT TASK** must not stay CREATED/idle while engine runs another (e.g. 031 vs 030).
3. **New TASK-*** — never resume partial verify tasks.
4. Driver polls until terminal; health each loop → `INVALID` if server drops.
5. Unpause: **`task.resume`**, not `task.pause` + `paused:false`.

## Evidence locations (019 pattern)

| Artifact | Path |
|----------|------|
| OAT poll log | `/tmp/hermes-oat-*.log` |
| Phase + PM | `/tmp/aic-server-6868.log` |
| Task reports | `.aic/tasks/TASK-*/reports/*-output.md` |
| Checkpoint PM | `.aic/tasks/TASK-*/engine.json` → `pmReview` |

## Trace checklist

1. Investigate: workers + barrier + PM exit 0?
2. Next phase only after PM pass?
3. BLOCKED: first `pm-review.sh` exit ≠ 0 or `phase-runner` exit ≠ 0?
4. Cross-task: empty `reports/` + BLOCKED → `runtime-checkpoint-task-isolation.md`.
5. Post worker PASS: any `TypeError` in `runPmReview`? → FIX-008 `let artifacts`; see `runtime-fix008-post-oat.md`.

## TASK-20260713-019 summary (valid BLOCKED, false gate)

- Investigate PM **PASS** (exit 0); artifact header had stale **014** id — PM still passed.
- Planning: 3 workers, barrier OK; PM raw **PASS**; parser **UNKNOWN** exit **3** → BLOCKED.
- **Classification:** PM review defect (verdict format). **Runtime behaved correctly.** FIX-004.

## TASK-20260713-020 summary (valid BLOCKED, true gate)

- Investigate + Planning PM **PASS** (exit 0) after FIX-004.
- Implementation: backend/frontend leases complete; `reports/*-output.md` = NDJSON session dumps.
- PM Implementation **REWORK** exit **1** (substantive) → **BLOCKED**.
- **Classification:** worker artifact defect. **Runtime behaved correctly.** FIX-005.

## Chat monitoring (mandatory)

Proactively post in chat: **new OAT TASK**, each **poll#/phase**, **PM exit**, **terminal** — user monitors here; dashboard alone is insufficient.

## Forensic-only user request

No code, no rerun: return **Execution Timeline**, **Root Cause**, **Evidence**, **Classification**, **Minimal Corrective Action**, **Ready to Rerun OAT** — no markdown report files.

## Ad-hoc verify after sync fix

`scripts/hermes-verify-task-scope-runtime.sh` or python one-shot on **18888** — poll `engine.pipelineRunning` before `pipeline_busy` test. Not suite green.

## IMP-003 WECP OAT (023–028, 2026-07-13)

- **Driver API:** `POST /api/runtime/intent` with `task.create` / `task.start` — not `/api/task.create` (404).
- **Forensics:** Poller `failed` is coarse; read **`/tmp/aic-server-6868.log`** for WECP lines (`generate FAIL`, `repair#`, `opencode exit=1`, `no assistant text`).
- **Stop all:** `task.pause` + `task.cancel` → `currentTask: null`, `paused: true`; kill OAT pollers separately. See `references/runtime-stop-all-tasks.md`.
- **WECP cascade:** phase case, no `capture_output` on Node runner, `gen_timeout` from `TIMEOUT` (export before WECP), keep `md_file` for repair — `references/wecp-architecture-and-pitfalls.md`.