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
