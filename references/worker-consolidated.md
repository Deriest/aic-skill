# Worker Consolidated

> **Consolidated from 4 files.** Originals archived in `references/archive/`.

**Original files merged:**
- `worker-artifact-missing-on-success.md`
- `worker-invocation-completion-contract-fix006.md`
- `worker-registry.md`
- `worker-reliability-baseline-imp024.md`

---

---

## Source: `worker-artifact-missing-on-success.md`

# QA / Closeout: spawn exit 0 but artifact missing

**Observed 2026-07-13 (TASK-AIC-WEB-001):** `spawn-worker.sh qa` and `documentation` both exited 0; `docs/verification-report.md` and `docs/closeout-summary.md` were **not** on disk.

## Dispatcher rule

- **Worker exit 0 ≠ deliverable exists.** After QA/Closeout, `test -f docs/verification-report.md` (or path in prompt).
- **Haiku (sprinter)** often exits 0 without writing the file — use **`crafter`** for QA/Closeout file deliverables.
- If missing: **rerun** (see `references/qa-rerun-until-pass.md`).
- If file exists with **`VERDICT: REWORK`**: remediate evidence, rerun until **`VERDICT: PASS`**.
- Dispatcher may run build/Lighthouse to unblock REWORK — not a substitute for final worker `VERDICT: PASS` when user requires strict SOP.

## Prompt hardening

```text
MANDATORY OUTPUT FILE: /path/to/docs/verification-report.md
If this file does not exist when you finish, the task is incomplete.
```

## Cross-refs

- `references/qa-rerun-until-pass.md`
- `dispatcher-discipline-aic` — QA Validation Policy (vision/terminal evidence)
- `references/dispatcher-promo-website-pipeline.md`
---

## Source: `worker-invocation-completion-contract-fix006.md`

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

---

## Source: `worker-registry.md`

# Worker Registry (Deprecated)

Historical — worker capability registry prototype. Archived to `archive/platform-experiments/worker-registry.sh`. Engine now uses `scripts/engine/` FSM + `spawn-worker.sh`.

---

## Source: `worker-reliability-baseline-imp024.md`

# IMP-024 — Worker Reliability Baseline Investigation

Post Runtime Stability (45b04e8 + 3e98b02 frozen). Engine FSM / PM Review / Barrier / WECP orchestration NOT to be modified for this investigation.

## Historical Failures (post-stability)

| ID | Title | Phase fail | Barrier snapshot | Reports | Shape |
|----|-------|------------|------------------|---------|-------|
| 046 | Smoke-Doc-Index | VERIFICATION → REWORK → CANCELLED interrupted | qa complete, barrier active | pm 7.8KB md, arch/research/qa valid | pm valid md |
| 047 | Smoke-Readme-Cleanup | Planning Planning | arch+research complete, pm missing | pm 24KB raw NDJSON leak | **extraction leak** |
| 001 | Smoke-Config-Check | IMPLEMENTATION failed | backend complete, frontend missing | all 1-2KB trivial | prompt compliance no-op |
| 002 | OAT FIX-023 Metrics Test | COMPLETE ✅ | — | 6 reports 0.5-2.2KB | control — metrics ok |
| 003 | OAT IMP-024-A Extraction | IMPLEMENTATION failed | frontend complete, backend missing | 4 reports, 0 NDJSON leak | extraction boundary PASS |

## Failure Classification

| # | Worker | Class | Repro? | Evidence |
|---|--------|-------|--------|----------|
| 1 | pm / Planning (047) | Artifact extraction | Yes (once) | pm-output.md starts `{"type":"step_start"` — NDJSON not markdown |
| 2 | pm / Planning (047) | OpenCode output / Session handling | Transient | extract_md failed, session id scan missed, WECP no metrics post |
| 3 | frontend / Implementation (001, 003) | Artifact generation / Prompt compliance | Intermittent | backend same barrier succeeds, frontend exits without artifact |
| 4 | pm/arch/research (001) | Prompt compliance | Intermittent | Task trivial "verify exists" → model writes "already exists no changes" without tools |
| 5 | qa / Verification (046) | Retry behavior / Barrier timeout | Once | qa complete then CANCELLED interrupted during REWORK respawn loop |
| 6 | all legacy | Session handling | Intermittent | extract_session_id only scans last OK part; non-JSON prefix breaks continue |

## Classes

- OpenCode output
- Prompt compliance
- Artifact generation
- Artifact extraction
- Provider instability
- Timeout
- Session handling
- Retry behavior
- Unknown

Mapping:

- 047 leak → Artifact extraction (P1)
- 001/003 frontend missing → Artifact generation + Prompt compliance (P2)
- 001 no-op → Prompt compliance (P3)
- 047 session id missing → Session handling + Retry behavior (P4)
- 046 interrupted → Retry behavior cosmetic (P5)
- Length variance → Provider instability (P6)

## Can Runtime fix?

| Class | Runtime fix? | Must Worker/OpenCode fix? |
|-------|--------------|---------------------------|
| Artifact extraction | Yes — harden extractor + fail cleanly (IMP-024-A shipped) | No |
| Session handling | Partial — broaden sessionID scan, retain json_paths | No |
| Artifact generation | No — prompt template / trivial-task classifier | Yes (worker layer) |
| Prompt compliance | No — contract awareness when task trivial | Yes |
| Provider instability | No | Yes (model variance) |
| Retry behavior | No — barrier cosmetic | No |

## Priority Ranking (impact first)

| Pri | Problem | Impact |
|-----|---------|--------|
| P1 | NDJSON not extracted → raw dumped as report | Blocks barrier, leaks internal format |
| P2 | Frontend sporadic non-generation in trivial tasks | Implementation fails |
| P3 | No-op artifacts for trivial doc tasks | Hollow artifacts pass but valueless |
| P4 | Session id missing → Strategy B skip | Transient failures not recovered |
| P5 | VERIFICATION REWORK cancel leaves barrier active with failed={} | Misleading idle |
| P6 | Provider/context variance length | Nondeterminism |

## Recommended Milestones

| Milestone | Scope |
|-----------|-------|
| IMP-024-A Worker Output Determinism | Harden opencode-json-to-md + WECP extraction (shipped 0916f9f) |
| IMP-024-B Session & Retry Hardening | extract_session_id scan all keys, json_paths cumulation, raw fallback artifact text |
| IMP-024-C Frontend Reliability | Investigate frontend prompt for trivial tasks |
| IMP-024-D Trivial-task templates | Allow "no changes" but contract-compliant artifact |

Order: A → B → C → D.

## Shipped Fixes

- IMP-024-A (0916f9f): `opencode-json-to-md.py` + `spawn-worker.sh` no `|| cp OUTPUT` — raw NDJSON leak closed
- IMP-024-B (2026-07-14): `extract_session_id` hardened (sessionID/sessionId/session_id + part/data + ses_ fallback + prefix stripping), timeout partial recovery, legacy Strategy B parity via `legacy-extract-sid.py`, payload quoting fix `FINAL_EXIT/FINAL_PATH` env bridge

## Verification Pattern

Smoke per milestone: one normal task via `/api/task-start`, poll `/api/status`, then scan `reports/*.md`:

- No report starts with `{"type":`
- Implementation artifact starts with `#` heading
- `bash -n spawn-worker.sh` + `py_compile` extractors
- Ad-hoc: valid NDJSON passes, 047-style leak rejected
