# Implementation Lessons

> **Consolidated from 21 files.** Originals archived in `references/archive/`.

**Original files merged:**
- `imp-001-final-state.md`
- `imp007-strategy-b-wecp-continue.md`
- `imp012-implementation-session-preamble.md`
- `imp016-wecp-implementation-missing-section.md`
- `imp017-closeout-artifact-resolution.md`
- `imp018-planning-research-drift.md`
- `imp019-verification-cross-phase-repair.md`
- `imp020-planning-pm-session-dump.md`
- `imp024-c-trivial-task-reliability.md`
- `imp024-milestone-worker-layer.md`
- `artifact-resolution-imp005.md`
- `implementation-artifact-contract-fix005.md`
- `phase-deliverable-contract-investigation-imp001.md`
- `provider-wecp-compatibility-imp004.md`
- `opencode-session-termination-imp006.md`
- `wp2-wp3-implementation-summary.md`
- `wp202-intake-implementation-summary.md`
- `v330-implementation-proven-patches.md`
- `v330-master-plan.md`
- `production-readiness-cleanup-wp101.md`
- `repository-finalization-wp102.md`

---

---

## Source: `imp-001-final-state.md`

# IMP-001: Operations Control Center — Final Patterns

## Layout Structure

### Right Panel Sections (top to bottom)
1. **CURRENT TASK** — `h-[250px]` container, task info or `[ WAITING FOR TASK ]`
2. **PIPELINE / RUNTIME GATE** — side-by-side, `h-[180px]` each, titles `h-[28px]`
3. **PERFORMANCE** — single column, 8 metrics (RSS, Heap, Load 1m, Load 5m, Cores, Total Requests, Total Input, Total Output)
4. **STATUS** — 4 cards `h-[140px]` (Working/Complete/Idle/Total), `mt-2` spacing from Performance

### Left Panel
- Virtual Office: `flex-[1.5]` ratio, `h-[94%]` card height
- Worker desks: `mt-2` spacing from avatar

## Status Theme Colors (CSS variables)

| Status | Border | Text | Pulse/Glow | Badge bg |
|--------|--------|------|------------|----------|
| working | `border-aic-yellow` | `text-aic-yellow` | `shadow-[0_0_15px_rgba(255,204,0,0.15)]` | `bg-aic-yellow/10` |
| idle | `border-gray-500/50` | `text-gray-400` | `shadow-[0_0_10px_rgba(107,114,128,0.1)]` | `bg-gray-800/50` |
| complete | `border-aic-green` | `text-aic-green` | `shadow-[0_0_15px_rgba(0,200,83,0.15)]` | `bg-aic-green/10` |

### Dispatcher Special Rule
Dispatcher NEVER shows "idle" — when server is connected, always maps to "working" status.
- In `WorkerGrid.tsx`: `if (worker.id === 'dispatcher' && uiStatus === 'idle') uiStatus = 'working';`
- In `OverviewPage.tsx` stats: same logic for working count

## Pitfalls

### Build/serve cycle (CRITICAL)
AIC server serves from `dashboard/dist/`. After editing `.tsx` files:
1. `cd dashboard && npm run build`
2. Verify: `stat -c '%Y' dist/index.html` must be NEWER than source
3. Restart server: `kill -9 $(lsof -t -i:6868) && node scripts/server.js 6868`
4. Browser: `Ctrl+Shift+R` (hard refresh) — regular refresh may show cached version

### Python replace with unicode
Python `str.replace()` FAILS SILENTLY when the search string contains unicode arrows (▶, →). Use the `patch` tool instead for files with unicode characters.

### Server state resets on restart
`/api/reset` or server restart clears all worker statuses. After restart, workers show as "idle" — must manually set working status via API:
```bash
curl -sf -X POST -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  http://localhost:6868/api/agent-status \
  -d '{"agent":"frontend","status":"complete","engine":"opencode","currentTask":"test"}'
```

### flex-[1.5] revert trap
When reverting Grid→Flex layout, `flex-[1.5]` class is easily lost. Always verify `<div className="flex-[1.5] flex flex-col min-w-0 h-full">` exists after revert — without it, Virtual Office collapses to equal ratio with right panel.

## Performance Metrics Source
`/api/metrics/summary` returns: `memory.{rss,heapUsed,heapTotal}`, `cpu.{loadAvg[],cores}`, `totalRequests`, `totalInput`, `totalOutput`, `cost.{total}`.

---

## Source: `imp007-strategy-b-wecp-continue.md`

# IMP-007 + IMP-024-B — Strategy B (WECP continue & Session Reliability)

## Behavior (Generate only, attempt == 0)

1. `opencode run <promptFile> -m <model> --auto --format json`
2. `extract_md` via `opencode-json-to-md.py`
3. If extract succeeds → validate (continue must NOT run)
4. If extract fails and NDJSON has session id → exactly one:
   - `opencode run "<continue message>" -m <model> --continue -s <session> --auto --format json`
5. Second extract → validate; if still no md → generate failure return 1

Repair (attempt > 0): single run_opencode — no continue on repair passes.

## Shared continue prompt

- `scripts/worker-continue-prompt.sh` (single source; WECP + legacy both use it)
- Output ONLY final assistant message, complete markdown report, no tool calls

## Session ID capture (hardened IMP-024-B 2026-07-14)

`extract_session_id()` in `worker-execution-pipeline.py` + `scripts/legacy-extract-sid.py`:

- Keys: sessionID / sessionId / session_id
- Locations: top-level + part.* + data.*
- Non-JSON prefix stripping: `opencode: log\n{"sessionID":...}` → slice at first `{`
- Deep fallback: any string value ses_ >8 chars anywhere in object graph → last-write-wins
- TimeoutExpired path: recovers sid from partial file instead of returning None,None
  - Logs `=== WECP: opencode timeout (X)s === (recovering session id from partial)`
- Fixtures verified (OK_IMP024B_HERMES_VERIFY):
  - 047 leak ses_0a30d69bfffevZjKS2jAc8CDIu → extracts
  - snake_case {"session_id":"ses_test1234567890"} → extracts
  - prefixed opencode: log line\n{"sessionID":"ses_prefixed999"} → extracts
  - nested {"part":{"foo":{"bar":"ses_fallbackXYZ123456"}}} → extracts via deep scan
  - legacy-extract-sid.py on TASK-20260713-047/reports/pm-output.md → ses_

## Stderr markers (forensics)

| Marker | Meaning |
|--------|---------|
| === WECP: generate continue (Strategy B) === | Continue pass started |
| === WECP: opencode continue exit=N === | Continue opencode failed |
| === WECP: generate extraction failed after continue === | Continue ran but no text |
| === LEGACY: extraction failed — attempting Strategy B continue sid=... === | Legacy parity path (IMP-024-B) |
| === LEGACY: Strategy B PASS === | Legacy continue recovered artifact |
| === WECP: opencode timeout (X)s === (recovering session id from partial) | Timeout with partial recovery |

## Completion payload quoting fix (IMP-024-B, CRITICAL)

Bug in spawn-worker.sh:185 pre-fix:

COMPLETE_PAYLOAD=$(python3 -c "import json; print(json.dumps({'exitCode': int('${EXIT_CODE}'), 'artifactPath': '''${ARTIFACT_PATH}'''}))")

Triple ''' inside double-quoted bash: bash -n passes but runtime produces broken JSON when ARTIFACT_PATH non-empty → lease completion POST fails silently. Engine falls back to reconciliation via [engine] barrier reconciled ... via lease.

Fix: env-var bridge:

FINAL_EXIT="$EXIT_CODE" FINAL_PATH="$ARTIFACT_PATH" COMPLETE_PAYLOAD=$(python3 -c 'import json,os; print(json.dumps({"exitCode": int(os.environ.get("FINAL_EXIT","0")), "artifactPath": os.environ.get("FINAL_PATH","")}))')

Rule: never embed ${VAR} inside single-quoted JSON via '''. Use env-var bridge.

## Legacy Strategy B parity (IMP-024-B)

spawn-worker.sh legacy path (non-contract roles) now has same one-shot recovery:

python3 legacy-extract-sid.py "$OUTPUT_FILE" → SID
if SID present:
  CONT_MSG=$(bash worker-continue-prompt.sh | head -c 800)
  node CONT_RUNNER "$CONT_MSG" "$MODEL" "$PROJECT_DIR" "$TIMEOUT" "$CONT_FILE" "$SID"
  if CONT_FILE && extraction passes: artifact PASS, EXIT_CODE=0, OUTPUT_FILE swapped for metrics
  else: fail clean, no artifact (preserves IMP-024-A no-raw invariant)
else:
  fail clean, no artifact

Helper scripts/legacy-extract-sid.py standalone — avoids heredoc nesting collision in spawn-worker.sh (previous inline << 'PY' inside function broke bash -n).

## Verification

- OK_IMP024B_HERMES_VERIFY — compile, bash -n, 047 sid extraction, snake_case, prefix stripping, ses_ fallback, legacy helper, payload fix, Strategy B markers, timeout recovery path
- Pattern: mktemp /tmp/hermes-verify-imp024b-XXXXXX.sh → py_compile all extractors, bash -n spawn-worker, fixture extraction via importlib.util.spec_from_file_location

## Not in scope

- Session reuse across repairs (excluded per ticket)
- Metrics on failure post (out of scope)
- Runtime FSM / PM / contracts / validators
- Strategy C (no --auto), D (agent/perms), E (hybrid resolver) — future only.

---

## Source: `imp012-implementation-session-preamble.md`

# IMP-012 — Implementation artifact session preamble (OAT 036)

## When to load

Runtime OAT reached **Implementation PM REWORK** after **FIX-013 PM PASS** on Investigate/Planning. PM cites **session-style lines before required H1**, not NDJSON dumps (distinct from FIX-005 / OAT 020).

## Symptom (036)

| File | Lines before `# … Implementation` |
|------|--------------------------------------|
| `backend-output.md` | `Exploring the codebase…`, meta implementation lines |
| `frontend-output.md` | `Reading phase plan…`, blank lines |

PM: drop preamble so file **starts at** `# Backend Implementation` / `# Frontend Implementation`. Optional: clean messy `## Result` (stray fences).

## Contract (`.aic/phase-contracts/implementation.json`)

- `forbidSessionDump: true`, `promptRules` forbid session transcripts
- `requiredSections` — all present **after** preamble

## Gap: WECP vs PM

| Gate | Preamble "Exploring/Reading…" |
|------|------------------------------|
| WECP `generate PASS` | Often **still PASS** |
| `validate-phase-artifact.py` `is_session_dump` | Focuses NDJSON/tool markers in head — **may not flag** narrative preamble |
| **PM Review** | **REWORK** — legitimate |

Planning workers (`pm-output.md` "Gathering evidence…") can have same leakage; Planning PM may still PASS if content substantive — Implementation PM was stricter on 036.

## Would preamble-only removal yield PASS?

**Yes** per PM text on 036: after preamble + Result cleanup, "required sections, scope, and verification look acceptable."

## Minimal corrective action (do not implement in investigation)

1. **Post-extract normalize:** strip everything before first line matching `requiredSections[0]` for Implementation roles.
2. **WECP repair prompt:** "Artifact must begin with `# Backend Implementation` — no exploration lines."
3. **Validator:** extend `is_session_dump` or add `mustStartWithH1` from contract.

**Classification:** primary **WECP extraction** (final markdown not normalized); secondary worker prompt / validator–PM alignment.

**Runtime:** no change — REWORK → BLOCKED is correct.
---

## Source: `imp016-wecp-implementation-missing-section.md`

# IMP-016 — Implementation WECP MISSING_SECTION (OAT 040)

## Symptom

- Planning PM **PASS**; Implementation never reaches PM Review.
- Log: `WECP: generate FAIL: ['MISSING_SECTION', ...]` (often ×7 for backend/frontend).
- `reports/backend-output.md` / `frontend-output.md` **absent** — WECP only copies artifact on validator **PASS**; failed runs unlink temp MD.

## Chain

```
implementation.json requiredSections
  → phase-runner CONTRACT_BLOCK (generic)
  → opencode JSON → opencode-json-to-md.py (type:text only)
  → FIX-014 normalize (no-op if H1 missing)
  → validate-phase-artifact.py (exact heading line match)
```

First violation: **extracted markdown** lacks exact headings (not validator bug, not FIX-014 stripping).

## Repair loop behavior (pre-FIX-017)

- `maxRepairAttempts`: 2 (default in `worker-compliance.json`).
- Repair prompt was **patch-only**; identical `MISSING_SECTION` across generate + repair#1 + repair#2 → **do not** recommend raising repair count alone.

## Classification

Primary: **Worker Prompt** — crafter ignores skeleton.  
Secondary: **WECP repair** — patch-only when entire skeleton missing.

## Fix shipped

**FIX-017** — see `references/runtime-fix017-implementation-skeleton-lock.md`.

## OAT evidence

- **TASK-20260713-040**: frontend `FAILED_AFTER_REPAIR`; backend same pattern in log.
---

## Source: `imp017-closeout-artifact-resolution.md`

# IMP-017 — Closeout PM REWORK / Artifact Resolution (TASK-041)

**Session:** 2026-07-14. Investigation only. **FIX-017 PASS**, **IMP-015 PASS** on Closeout; terminal **BLOCKED** after `maxPmRepairAttempts`.

## Symptom

- Investigate → Verification **PM PASS**
- Closeout **PM REWORK** × N → `pm repair limit exceeded` → **BLOCKED**
- Log PM: rollup says `qa-output.md` **absent**, `planning-output.md` **TASK-040**; asks to fix inventory / lifecycle COMPLETE narrative

## Ground truth (041 `reports/`)

| Claim in Closeout `pm-output.md` | Disk |
|----------------------------------|------|
| `qa-output.md` absent | **`qa-output.md` exists** (TASK-041, substantive) |
| `planning-output.md` TASK-040 | **No `planning-output.md`** — Planning = `pm-output.md`, `architect-output.md`, `research-output.md` (041-aligned) |
| IMP-015 not exercised | **`engine.json` `rework`** + log `pm repair` on Closeout |

## Root cause (primary)

**Artifact Resolution** — Closeout worker (`pm` only per `fsm.js`) synthesizes phase inventory **without** mandatory grounding in actual `reports/*` files. Repair respawns `pm` with generic `phase-runner` prompt; **no manifest injection** → same class of rollup errors.

Not: IMP-015, Runtime, WECP validator, FIX-017.

## Why earlier phases PASS

Gate PM reviews **per-phase artifacts** that were correct. Closeout is a **cross-phase synthesis** task with **no** `closeout.json` contract (unlike `implementation.json`).

## Minimal fix (smallest)

1. **`phase-runner.sh`** — Closeout + `pm` only: block **CLOSEOUT DELIVERABLE** with:
   - `context.json` Task Authority (041)
   - Explicit list: glob/read `reports/*-output.md` for `AIC_TASK_ID`
   - Rules: only assert facts provable from those files; **do not** reference `planning-output.md` if missing; map Planning → pm/architect/research outputs
   - IMP-015: if `engine.json` `rework` or PM log shows repair in **this** task, document it (do not claim N/A)
   - **COMPLETE**: if Verification PM already PASS in same task + user description asks lifecycle COMPLETE, align narrative with engine terminal state (or split “structural closeout” vs “L4 poll” explicitly)

2. **Do not** raise `maxPmRepairAttempts` or change IMP-015 loop.

## OAT 041 checklist (forensics)

| Item | Result |
|------|--------|
| FIX-017 | PASS (generate PASS both crafters) |
| IMP-015 | PASS (Closeout repair, selective `pm`) |
| COMPLETE | No (Closeout PM cap) |

## Related

- `references/runtime-imp015-pm-repair-loop.md`
- `references/runtime-fix017-implementation-skeleton-lock.md`
- `references/runtime-oat-planning-artifact-alignment.md` (Planning naming — no single `planning-output.md` in FSM)
---

## Source: `imp018-planning-research-drift.md`

# IMP-018 — Planning research context drift (investigation)

**When:** OAT 042 Planning PM REWORK after 040/041 Planning PASS; research off-brief (generic Hermes/OpenCode integration, wrong **TASK-20260713-002**) while FIX-016 block present.

## Conclusion

| Ruled out | Still primary |
|-----------|----------------|
| Missing `context.json` / `RESEARCH_PLANNING_BLOCK` | **OpenCode thinker** nondeterminism |
| Prompt ordering vs 040/041 | **Stale artifacts** on disk during IMP-015 repair (pre-FIX-019) |
| `TASK-002` in repo or prompt | **Hallucination / wrong package** in generated markdown (PM read artifact) |

## 042 first PM cycle (log)

Often **mixed trio**: `pm-output.md` still **TASK-040 / OAT-IMP015**, `architect` wrong package (e.g. DOCCONSOL), `research` off FIX-018 — not research-only failure.

## Smallest corrective action (shipped FIX-019)

1. Delete repaired worker artifacts before respawn.
2. Inject PM findings into repair prompt.
3. Planning post-gen gate + one regen.

Do **not** only strengthen forbidden lists without artifact clear + repair feedback.

## OAT note

FIX-018 OAT can fail in **Planning** before Closeout — that is not a Closeout regression.

## Related

- `references/runtime-fix016-planning-research-scope.md`
- `references/runtime-fix019-pm-repair-respawn.md`
- `references/runtime-imp015-pm-repair-loop.md`
---

## Source: `imp019-verification-cross-phase-repair.md`

# IMP-019 — Verification cross-phase repair desync (investigation → fix)

**When:** Normal smoke **046** **BLOCKED** after OAT **045** **COMPLETE**; Verification PM **REWORK** → cross-phase **IMPLEMENTATION** respawn → `BLOCKED` / `spawning`.

**Not a prompt issue** — runtime orchestration only.

## Symptom chain (046)

1. **VERIFICATION** `pmRepairLoop` — PM **REWORK** (verdict cites `backend-output.md` / `frontend-output.md` alignment).
2. `resolvePmRepairTargets` → `artifactPhase: IMPLEMENTATION`, targets `[backend, frontend]` (**intentional** per FIX-020 artifact hints).
3. Engine calls `spawnWorkersForPhase(IMPLEMENTATION, subset)` **inside** Verification repair loop.
4. **`cp.pipelineState` stays VERIFICATION**; **`phaseBarrier` stays `[qa]`** — `resetWorkersForRepair` only clears workers already on barrier (`barrier.js`).
5. Implementation workers run; barrier reconcile may mark **qa** complete from prior pass; **PM re-run is still Verification** — no clean `runPhase(IMPLEMENTATION)` re-entry.
6. Terminal: **BLOCKED**, `phaseStatus: spawning`, `rework.phase: VERIFICATION`, `pmReview.phase: Implementation` (stale).

## 045 vs 046 (runtime decision divergence)

| After Verification PM REWORK | 045 | 046 |
|------------------------------|-----|-----|
| `artifactPhase` from verdict | **VERIFICATION** (many `*-output.md` → spawnPlan filters to **qa**) | **IMPLEMENTATION** |
| Cross-phase Implementation respawn | Effectively **no** | **Yes** |
| Outcome | Closeout → **COMPLETE** | **BLOCKED** |

**First divergence:** `resolvePmRepairTargets` → `artifactPhase` + `spawnPlan` (not task brief).

## Root cause (primary)

**Phase transition:** Cross-phase repair spawns workers for **artifactPhase** without **`runPhase(artifactPhase)`** or resetting **`pipelineState` + `startBarrier(artifact workers)`**.

Secondary: **Repair engine** + **barrier** assume repair workers ⊆ current phase barrier.

## Classification

**Phase Transition** (primary). Secondary: Repair Engine, Barrier.

## Fix (shipped FIX-021)

**Option A implemented:** `pmRepairLoop` cross-phase branch calls `await runPhase(taskId, artifactPhase, projectDir, { repairSubset, repairEnv })` — full barrier + PM loop for the artifact phase — then restores interrupted phase checkpoint and `continue`s outer `pmRepairLoop`.

In-phase repair (same `pipelineState`) unchanged — still uses inline `spawnWorkersForPhase`.

**Restart `server.js`** after deploy. **Re-smoke** normal task — 046 pre-021 is not valid post-FIX-021 evidence.

See `references/runtime-fix021-cross-phase-reentry.md`.

## Evidence pointers

- Log: `[engine] pm repair cross-phase targets` … `repairPipelinePhase: VERIFICATION`, `artifactPhase: IMPLEMENTATION`
- `engine.json` 046: BLOCKED, barrier `[qa]`, `rework.artifactPhase: IMPLEMENTATION`
- Code: `pmRepairLoop` lines ~520–547 spawn with `spawnPipelineState` but outer `pipelineState` unchanged; `runPhase` only in `runPipeline` sequence

## Related

- `references/runtime-fix021-cross-phase-reentry.md` (FIX-021 implementation)
- `references/runtime-fix020-pm-repair-invocation.md` (node invoke + targeting — does not fix desync)
- `references/runtime-imp015-pm-repair-loop.md`
- Smoke ≠ OAT; 045 COMPLETE does not prove normal-task cross-phase repair

---

## Source: `imp020-planning-pm-session-dump.md`

# IMP-020 — Planning PM session dump (TASK-20260713-047)

## Symptom

- `pipelineState: PLANNING`, `phaseStatus: failed`, `pipelineRunning: false`
- Barrier: `architect` + `research` **complete**, **`pm` missing**
- `pm-output.md` exists (large, e.g. 24KB) but **not markdown**

## Root cause (primary: Worker Runtime)

1. `spawn-worker.sh` / opencode ran successfully for Planning **pm**.
2. Artifact written to `reports/pm-output.md`.
3. Content is **raw NDJSON** (`{"type":"step_start","sessionID":...}`) — session event stream, not report.
4. `phase-runner.sh` after `wait`: `validate-phase-artifact.py` → `is_session_dump()` → **FAIL**.
5. `FAILED_WORKERS+=(pm)` → exit 1 → engine returns early → **no** `markWorkerComplete` for pm.

**Not:** barrier bug, checkpoint bug, FIX-021, or cross-phase repair.

## Compare architect / research (same task)

| Worker   | Artifact   | Validator |
|----------|------------|-----------|
| architect| markdown   | PASS      |
| research | markdown   | PASS      |
| pm       | NDJSON dump| FAIL      |

## Evidence checklist

- `head -c 200 reports/pm-output.md` — JSON line vs `## Task Authority`
- `stat` timestamps — pm often finishes **after** architect/research
- `engine.json` — `phaseBarrier.completed` without `pm`
- No `cross-phase re-entry` in log for this failure mode

## Classification

**Worker Runtime** (transient opencode output shape). Validator and engine behaved correctly.

## Smoke retry (001)

Planning **pm** produced valid markdown → IMP-020 path **not reproduced** on retry; later **Implementation frontend** barrier fail is a **different** worker issue (Worker Reliability milestone).

## Minimal corrective action (engineering, separate milestone)

- Harden worker layer: ensure WECP / `opencode-json-to-md.py` / completion contract always emit markdown to `reports/*-output.md`.
- Do **not** weaken `validate-phase-artifact.py` to accept session dumps.
- Optional: stronger prompt line in `phase-runner.sh` for pm — markdown only.

## Related

- `validate-phase-artifact.py` — `SESSION_MARKERS`, `forbidSessionDump`
- `references/opencode-json-artifact-and-metrics.md`
- `references/worker-invocation-completion-contract-fix006.md`
---

## Source: `imp024-c-trivial-task-reliability.md`

# IMP-024-C — Trivial Task & Implementation Reliability

**Status:** Investigation complete (post IMP-024-A/B). **Not Runtime** — worker prompts, contracts, templates only.

## Symptom

On **Smoke-*** / **verify-only** tasks (`001`, `003`):

- Planning PM **PASS** with **noop** artifacts ("already exists, no changes")
- **Implementation** barrier: one of **backend** or **frontend** missing report or WECP `FAILED_AFTER_REPAIR` (MISSING_SECTION, SECTION_TOO_SHORT)
- Nondeterministic which impl worker fails across reruns (001 backend ok / frontend missing; 003 opposite)

## Contrast (success)

- **002** minimal sentence task → COMPLETE, both impl reports present
- **045** full Runtime OAT → rich artifacts, Closeout PASS

## Root cause (primary)

| Category | Issue |
|----------|--------|
| **Prompt Compliance** | Verify-only description → model skips tools, writes noop prose |
| **Worker Template** | Full Implementation contract on doc-only smoke → thin content fails validator |
| **OpenCode Behaviour** | Crafter variance; asymmetric backend vs frontend |

**Not** extraction/session (024-A/B), **not** FSM/barrier/PM engine.

## Shipped (IMP-024-C worker layer)

| Script | Role |
|--------|------|
| `trivial-task-classifier.py` | `{"trivial": true}` from context title+description |
| `trivial-task-prompt.py` | guidance + impl template + `noop-regen` header |
| `worker-noop-detector.py` | Unsupported noop if phrase + **len ≥ 80** + no path evidence |
| `phase-runner.sh` | `TRIVIAL_TASK_BLOCK`, `IMPLEMENTATION_TRIVIAL_BLOCK` |
| `worker-execution-pipeline.py` | `noop_regen_once()` once before validate |

Verify: `bash scripts/hermes-verify-imp024c.sh` → `OK_IMP024C_HERMES_VERIFY`

**Focused smoke:** after boundary PASS, `POST /api/runtime/intent` `task.cancel` — not `/api/task-cancel`.

## Structural (future)

- `phase-contract-loader` profile for `Smoke-*` / `OAT *` titles
- Paired impl regen hint in WECP config

## Historical

- **047** pm NDJSON = pre-024-A legacy `cp` fallback (fixed)
- **046** user cancel, not worker failure

## Commits reference

`7c36a44` IMP-024-B, `0916f9f` IMP-024-A, `3e98b02` FIX-023, `45b04e8` Runtime bundle
---

## Source: `imp024-milestone-worker-layer.md`

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
---

## Source: `artifact-resolution-imp005.md`

# Artifact resolution investigation (IMP-005)

## Flows compared

**Current:** assistant `type:text` → `opencode-json-to-md.py` → validator → PM.

**Candidate:** parse NDJSON for `write`/`write_file` → resolve path per contract `.aic/tasks/<taskId>/reports/<artifact>` → same validator → PM.

## Evidence (TASK-020–029 era)

| Source | write_file in session? | Task reports |
|--------|----------------------|--------------|
| `wecp-out-1dhsajlq.txt` | **No** (read/glob/grep/bash only) | — |
| `wecp-out-_1phd3_i.txt` | **No** | — |
| 023–029 Investigate | No usable writes | `reports/` **empty** |
| `wecp-md-*.md` | N/A | **0 bytes** |
| 020/021 `pm-output.md` | From text extract / legacy, not session write | **Validator FAIL** (MISSING_SECTION) |

## Impact

- **0** failed OAT would flip to PASS from resolver alone on observed evidence.
- Recommendation **C**: resolver does not solve root tool-only / no-text failures; optional **B** when writes exist later.

## Resolver risks (if implemented)

- Stale path (`skill/reports/pm-output.md` read in session, not task dir)
- Last-write-wins, 0-byte files, wrong worker path

Contract path: `investigate.json` → `reports/pm-output.md`; `runtime-contracts.json` → `{taskDir}/reports/{worker}-output.md`.
---

## Source: `implementation-artifact-contract-fix005.md`

# FIX-005 — Implementation worker artifact contract (Runtime OAT 020)

## When to load

Runtime OAT **BLOCKED** at **Implementation PM REWORK** with evidence that `backend-output.md` / `frontend-output.md` are **raw NDJSON** (`tool_use`, `sessionID`) or meta-stubs ("report saved at …") instead of engineering markdown.

**Not** a Runtime / FSM / PM logic defect when PM correctly returns REWORK exit 1.

## Required files (runtime path)

| Worker | Path | Required headings |
|--------|------|-------------------|
| backend | `reports/backend-output.md` | `# Backend Implementation`, `## Objective`, `## Files Modified`, `## Changes`, `## Technical Notes`, `## Verification`, `## Result` |
| frontend | `reports/frontend-output.md` | `# Frontend Implementation`, `## Objective`, `## Files Modified`, `## Changes`, `## UI Notes`, `## Verification`, `## Result` |

Forbidden in `reports/*.md`: raw JSON/NDJSON streams, assistant session dumps.

## Enforcement (repo)

1. **`scripts/validate-implementation-artifact.py`** — section + session-dump checks
2. **`scripts/phase-runner.sh`** — Implementation prompts append exact heading template; post-`wait` re-validate artifact
3. **`scripts/spawn-worker.sh`** — after `opencode-json-to-md.py`, validate; fail → `EXIT_CODE=1`, remove bad artifact
4. **`scripts/worker-validation.sh`** — same validator for backend/frontend
5. **`scripts/opencode-json-to-md.py`** — if no `type:text` extracted, **exit 1** (no fallback `cp` raw to reports)

## TASK-20260713-020 trace (valid BLOCKED)

| Step | Result |
|------|--------|
| Investigate PM | PASS exit 0 (FIX-004 parser) |
| Planning PM | PASS exit 0 |
| Implementation workers | barrier ALL PASS; artifacts ~120KB/96KB JSON dumps |
| Implementation PM | **REWORK** exit 1 — substantive, justified |
| Terminal | **BLOCKED** |

**Classification:** worker artifact defect + prompt defect. **Runtime behaved correctly.**

## Ad-hoc verify

`scripts/validate-implementation-artifact.py` + `/tmp/hermes-verify-fix005.sh` pattern (good md PASS, 020 dump REJECT). Not suite green.

## After FIX-005

Ready for **new** guarded Runtime OAT (new TASK). Do not rerun 020 without user ask.

## IMP-012 (OAT 036) — preamble vs NDJSON

WECP **generate PASS** while PM **REWORK** for session lines before required H1 — load `references/imp012-implementation-session-preamble.md` (not FIX-005 JSON dumps).

## Chat monitoring (user preference)

Post **live OAT progress in chat**: poll #, fase, barrier, PM exit, server log lines — dashboard alone is insufficient. User: *report kesini yang complete atau yang baru mau mulai*.
---

## Source: `phase-deliverable-contract-investigation-imp001.md`

# Phase Deliverable Contract — architecture investigation (IMP-001)

Investigation only — no implementation in IMP-001 session.

## Current split authority

| Layer | What it enforces |
|-------|------------------|
| `.aic/runtime-contracts.json` | Path pattern, minBytes, worker→phases roster |
| `engine/validate-artifact.js` | File exists, size, content-line count |
| `phase-runner.sh` heredocs | Section headings (Investigate pm, Impl be/fe) — FIX-005/006 |
| `validate-implementation-artifact.py` | Impl sections + anti-NDJSON |
| `pm-review.sh` | Generic completeness/quality; **all** `reports/*.md` per gate |
| Task `description` | Shadow contract on OAT tasks |

## Problem

Three authorities → PM REWORK after Runtime accepted lease (e.g. OAT 021). Duplication ~4 layers; ~60% of rules not in JSON.

## Options compared

- **A Markdown files** per phase×worker — readable, weak machine validation.
- **B JSON/YAML schema** — single source; render prompts + one validator + PM rubric inject. **Recommended.**
- **C Engine-only schema** — tight runtime, poor git review, shell duplication.

## Recommended direction

Extend `.aic/` structured contract (B): `requiredHeadings`, `forbiddenPatterns`, `pmRubric`, optional generated MD view for humans.

**Affected (MVP ~3–5d):** phase-runner (remove heredocs), unified validator, pm-review rubric inject, engine optional filter artifacts by phase. **No FSM redesign first.**

## Risks

Migration REWORK on old report shapes; mechanical headings ≠ PM quality — keep PM gate.

## When to load

Planning consolidation after FIX-004/005/006; before adding more bash `IMPL_CONTRACT` blocks.
---

## Source: `provider-wecp-compatibility-imp004.md`

# Provider compatibility with WECP (IMP-004)

## Config

- Provider `aic` via `@ai-sdk/openai-compatible` in `~/.config/opencode/opencode.jsonc`
- Models: Opus (thinker), Sonnet (crafter), Haiku (sprinter)
- Same argv on legacy and WECP paths

## Answers (evidence-backed)

1. **Completion Contract compliant?** No under `--auto` — sessions end on tool-calls without full markdown text.
2. **Terminate after tool calls only?** Yes — valid API / OpenCode behavior.
3. **Guarantee final text turn?** No.
4. **WECP reliable on this provider?** Not with current invocation.
5. **Production suitable?** No until invocation or artifact strategy changes.

## Classification

**AIC integration defect** — `--auto` + single-shot + text-only extraction assumption.

## Minimal corrective directions (not implemented in investigation)

1. Stronger generate prompt / WECP retry on empty text
2. Fallback `opencode run` **without** `--auto`
3. Artifact from `write_file` when present (see `artifact-resolution-imp005.md` — **0** writes in failed OAT JSON)

Provider itself is not broken; session behavior is.
---

## Source: `opencode-session-termination-imp006.md`

# OpenCode session termination (IMP-006)

Investigation only context; complements `worker-invocation-completion-contract-fix006.md`.

## Current AIC invocation

`opencode run <promptFile> -m aic/<Model> --auto --format json` — single shot, Node timeout, NDJSON → `opencode-json-to-md.py` (`type==text` only).

OpenCode **1.17.18** help: `--auto` auto-approves permissions; `--format json` = raw events; **no** flag to force final assistant text.

## Findings (evidence)

| Question | Answer |
|----------|--------|
| When final assistant message? | When model emits `type:text` NDJSON — **not** guaranteed at exit |
| tool_calls-only termination? | **Yes** — observed; all `step_finish` = `tool-calls` in `wecp-out-*.txt` |
| Expected? | **Yes** for tool-capable agent + `--auto` single run |
| Another interaction needed? | Often in interactive/continue modes; AIC does **not** send follow-up turn |
| Force final response? | **No** documented CLI option |
| `--auto` effect | Enables uninterrupted tool loops |
| `--format json` omits text? | **No** — text absent when model never emits `type:text` |

## Classification

**C** — OpenCode in this mode **cannot guarantee** final assistant output. AIC argv is syntactically correct; mismatch is **execution model** vs WECP deliverable assumption.

Secondary **B** — same CLI, different **mode** needed: no `--auto`, `--continue` second turn, or non-text artifact resolution.

## Recommendation (implementation later)

- Do not expect “fix argv only” to pass WECP OAT.
- Pilot: generate without `--auto`; or `opencode run --continue -s <id>` with “output report only”; pair with artifact resolver if writes appear.
- Document: headless `--auto` = best-effort text, not contract guarantee.

## Related CLI options not used by workers

`-i` / `--interactive`, `-c` / `--continue`, `-s` session, `--variant`, `--thinking`, `--agent`.
---

## Source: `wp2-wp3-implementation-summary.md`

# Combined Implementation Summary: WP-2 & WP-3

## WP-2: PM Timeout Reliability
- **Configurable Timeout implemented:** Modified `scripts/spawn-worker.sh` to use `AIC_PM_TIMEOUT_SECONDS="${AIC_PM_TIMEOUT_SECONDS:-300}"` instead of hardcoding `180` for thinker/planning roles.
- **PM Review Configurable Timeout implemented:** Modified `scripts/pm-review.sh` to read `process.env.AIC_PM_TIMEOUT_SECONDS` (defaulting to 300) in the Node `execFileSync` options, removing the hardcoded `120000ms`.
- **Exit Code Audit completed:** The audit in `references/exit-code-contract-audit.md` confirms that `Exit 4` is NOT defined consistently across `rework-handler.sh` and `engine/index.js` (both treat it as a `REWORK` trigger rather than an abort). As instructed by the Global Rules ("Only then implement timeout → Exit 4"), this mapping was NOT implemented to avoid inconsistent runtime behavior.

## WP-3: Runtime Recovery Reliability
- **Dispatcher Boundary Maintained:** No changes were made to `server.js` (Engine/FSM/Barrier). Runtime recovery responsibility is explicitly confined to the Dispatcher using the `/api/runtime/intent` API.
- **task.cancel Flow Validated:** The Dispatcher policy (RH-001) dictates that upon a timeout-induced pipeline stall, the Dispatcher invokes `task.cancel` to safely abort the poisoned task and return the engine to an idle state, completely bypassing the need for a server restart.

## Verification & OAT Results

### Scenario A: Normal Pipeline
- **Verification:** Both scripts correctly fallback to 300s.
- **Result:** Pipeline operates normally.

### Scenario C: Forced Timeout
- **Verification:** `AIC_PM_TIMEOUT_SECONDS=1 bash scripts/pm-review.sh Investigate ...`
- **Result:** The Node script correctly throws `ETIMEDOUT`, the shell script catches exit 1, and the parser fails, resulting in Exit 3 (`UNKNOWN`). This proves the timeout configuration works perfectly without crashing the server.

### Scenario D: Cancel Recovery
- **Verification:** A simulated stalled task was canceled via `POST /api/runtime/intent {"intent":"task.cancel","taskId":"..."}`.
- **Result:** Engine state returned to idle (`currentTask: null`). Restart was not required, successfully validating the WP-3 recovery policy.

## Regression Summary
- No FSM, Engine, Barrier, or WECP logic was altered. 
- Timeout behavior is identical to before, just operating at a significantly higher and configurable threshold, ensuring 0% regression risk to existing runtime paths.

---

## Source: `wp202-intake-implementation-summary.md`

# WP-202 — Intelligent Intake Implementation Summary

## Files modified / added

| Path | Role |
|------|------|
| `scripts/intake-evaluate.py` | Deterministic completeness + mode routing |
| `scripts/verify-wp202-intake.sh` | Routing verification (9 cases + engine regression) |
| `references/intake-routing-epic201.md` | Dispatcher operator spec (WP-202) |
| `references/dispatcher-discovery.md` | Intake vs in-pipeline confidence note |
| `templates/PRD_TEMPLATE.md` | Discovery artifact template |
| `templates/intake-checklists/website.yaml` | Website mandatory fields |
| `templates/intake-checklists/generic.yaml` | Fallback checklist |
| `SKILL.md` | Router line (intake) — pre-existing |
| `~/.hermes/skills/aic/dispatcher-discipline-aic/SKILL.md` | RH-004 + PRD intent + evaluator pointer |

**Not modified:** `scripts/engine/`, `server.js`, `rework-handler.sh`, WECP, workers, dashboard.

## Implementation summary

- **Conversation / Quick / Discovery / From PRD** implemented in `intake-evaluate.py` + documented in `intake-routing-epic201.md`.
- **No confidence %** for routing; YAML mandatory fields + pattern match (extend in WP-203).
- **From PRD:** explicit intents; upload-only → `clarify_one_question`; only **build** sets `pipeline_allowed: true`.
- **Discovery:** bounds + `PRD_<Project>.md` template; pipeline blocked until approval (Dispatcher procedure).
- **RH-001/002/003:** enforced via existing discipline skill + no worker spawn flags on non-build paths.

## Routing verification

```
bash scripts/verify-wp202-intake.sh → OK_WP202_INTAKE_VERIFY
```

| Case | Mode | pipeline_allowed |
|------|------|------------------|
| conversation | conversation | false |
| quick | quick | true |
| discovery | discovery | false |
| from_prd_review | from_prd | false |
| from_prd_improve | from_prd | false |
| from_prd_architecture | from_prd | false |
| from_prd_estimate | from_prd | false |
| from_prd_build | from_prd | true |
| from_prd_upload_only | from_prd (clarify) | false |

## Regression verification

- `git diff HEAD -- scripts/engine/index.js scripts/server.js` → **clean**
- No `task.start` in intake scripts (Dispatcher-only gate remains procedural)

## Remaining work (WP-203 suggestion)

1. YAML checklists for all WP-201 domains (mobile_app, api, …).
2. Session state file `.aic/intake-session.json` (question count, approval flag).
3. `aic intake evaluate` CLI wrapper.
4. Richer field extraction from attached PRD files (read_file in Dispatcher flow).
5. Dashboard read-only intake mode display (optional).

**No commit** — await PM review.
---

## Source: `v330-implementation-proven-patches.md`

# v3.3.0 Implementation — Proven Patch Sequences

## Context
Complete v3.3.0 implementation across 3 milestones: M1 (Pipeline Reliability), M2 (EDP Architecture), M3 (Planning Intelligence). These are the exact patch sequences that passed validation after a full data loss + recovery cycle.

## M1: Pipeline Reliability

### WP-1.1: pm-review.sh — `--auto` flag
Location: inside the opencode node runner string
```javascript
'run', reviewMsg, '-m', model, '--auto', '--format', 'json', '-f', promptFile,
```
The `--auto` flag was missing from `pm-review.sh` but present in `spawn-worker.sh`. This caused Smart Approval to block read-only tool calls in headless PM sessions.

### WP-1.3: Degraded mode
When `AIC_PM_DEGRADED=1`, pm-review.sh skips content reads and does structure-only validation (file existence, H1 heading, minimum byte count). Returns PASS or BLOCKED without invoking opencode.

### WP-1.3: engine/index.js — 3-attempt retry loop
```
for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  // attempt >= 2 → AIC_PM_DEGRADED=1
  // code 0 → PASS → return
  // code 1 → REWORK → return
  // code 2 → BLOCKED → return
  // else → retry after 2s
}
// all exhausted → infrastructureFailure: true → BLOCKED
```

### WP-1.2: ArtifactProvider
File: `scripts/artifact-provider.js`
Methods: `get`, `getRaw`, `getMetadata`, `list`, `isStale`
Engine imports: `const { ArtifactProvider } = require('../artifact-provider');`

## M2: EDP Architecture

### WP-2.1: PM prompt — YAML EDP schema
Added to pm-review.sh prompt template:
```
verdict: PASS | REWORK | BLOCKED
reason: <string>
decision_package:
  owner: <string>
  root_cause: <string>
  engineering_objective: <string>
  expected_deliverables:
    - <string>
  completion_criteria:
    - <string>
```

### WP-2.2: EDP YAML parser (Python)
Extracts ````yaml ... ```` block, loads with `yaml.safe_load_all`, validates verdict enum, falls back to regex + `BLOCKED` on parse failure. No UNKNOWN ever emitted.

### WP-2.3: Dispatcher routing
Reads `.pm-last-edp.json`, extracts `decision_package.owner`, maps to worker targets, injects `AIC_EDP_OBJECTIVE` and `AIC_EDP_ROOT_CAUSE` into worker environment.

### WP-2.4: Legacy removal
- `pm-repair.js` DELETED
- Import removed from engine: `const { getMaxPmRepairAttempts, parseWorkersFromPmVerdict, resolvePmRepairTargets, readPmVerdictFile } = require('./pm-repair');`
- Full `pmRepairLoop` rewritten to use EDP routing instead of regex inference

## M3: Planning Intelligence

### WP-3.2: Artifact provenance
Frontmatter injected by `spawn-worker.sh`:
```yaml
---
schema_version: 1
task_id: TASK-xxx
phase: Planning
worker: architect
generation: 1
timestamp: 2026-07-16T00:00:00Z
supersedes: 0      # only if generation > 1
repair_iteration: 0  # only if generation > 1
---
```
Uses `awk` to prepend frontmatter to JSON→MD output.

### WP-3.3: Mechanical validation gate
Engine calls `validate-framework-invariants.sh` BEFORE pm-review.sh:
```bash
#!/usr/bin/env bash
for w in "${WORKERS[@]}"; do
  ART="$TASK_DIR/reports/$w-output.md"
  [[ ! -f "$ART" ]] && exit 1
  HAS_H1=$(grep -c "^#" "$ART" || echo 0)
  [[ "$HAS_H1" -eq 0 ]] && exit 1
done
exit 0
```
On failure: engine emits BLOCKED EDP with InvalidArtifact reason (no PM tokens spent).

### WP-3.1: Canonical spec injection
`phase-runner.sh` reads `spec-output.md` and injects `CANONICAL_SPEC_BLOCK` into every Planning worker's prompt. Workers receive the spec as frozen context with mandatory alignment instructions. The block is prepended to the prompt template between `PLANNING_AUTHORITY_BLOCK` and `PM_REPAIR_BLOCK`.

## Patch Order (Critical)
The order matters because patches 2 and 3 depend on patch 1 having removed old code:
1. Patch engine/index.js imports (remove pm-repair, add ArtifactProvider)
2. Patch engine/index.js `runPmReview` function (retry + gate + EDP)
3. Patch engine/index.js `pmRepairLoop` function (EDP routing)
4. Patch pm-review.sh (complete rewrite — safer than incremental)
5. Patch phase-runner.sh (spec injection)
6. Verify spawn-worker.sh frontmatter survived

## Pitfalls: bash wc -w and grep -c on empty files

Both `wc -w` and `grep -c` return `0` with trailing newline on empty files. In bash `[[ "$X" -eq 0 ]]`, the newline causes "syntax error in expression". Fix pattern:
```bash
WORD_COUNT=$(wc -w < "$FILE" 2>/dev/null | tr -d '[:space:]')
WORD_COUNT=${WORD_COUNT:-0}
HAS_H1=$(grep -c "^#" "$FILE" 2>/dev/null | tr -d '[:space:]')
HAS_H1=${HAS_H1:-0}
```

## Validation Commands
```bash
# Syntax
bash -n scripts/pm-review.sh
node --check scripts/engine/index.js
bash -n scripts/phase-runner.sh
bash -n scripts/spawn-worker.sh
node --check scripts/artifact-provider.js

# Feature presence
grep -c '\-\-auto' scripts/pm-review.sh           # should be ≥ 2
grep -c 'AIC_PM_DEGRADED' scripts/pm-review.sh    # should be ≥ 2
grep -c 'ArtifactProvider' scripts/engine/index.js # should be ≥ 1
grep -c 'EDP_JSON\|yaml.safe_load' scripts/pm-review.sh  # should be ≥ 6
grep -c 'FRONTMATTER' scripts/spawn-worker.sh      # should be ≥ 6

# Absence checks
grep -rn 'UNKNOWN' scripts/ | grep -v '# ' | grep -v 'unknown lease'  # should be clean
grep -rn 'MANUAL_APPROVAL' scripts/                 # should be clean
test -f scripts/engine/pm-repair.js && echo BAD || echo GOOD  # should be DELETED
```

---

## Source: `v330-master-plan.md`

# v3.3.0 Master Implementation Plan — "Pipeline Resilience + Planning Intelligence"

**Baseline:** v3.2.0 | **Target:** v3.3.0 | **Status:** Architecture Frozen, M1 COMPLETE, awaiting M2 approval

## Architecture Evolution (3 corrections applied this session)

1. **Recovery Framework** — Retry is not the architecture. Recovery is. Retry is ONE strategy among many.
2. **Deterministic Verdicts** — UNKNOWN and MANUAL_APPROVAL_REQUIRED removed. Only PASS, REWORK, BLOCKED.
3. **Resolution Plans** — PM returns verdict + executable resolution plan. Dispatcher executes the plan.

See `references/recovery-framework-architecture.md` for full architecture.

## Root Cause Summary (3 real production tasks)

| Task | Root Cause | Classification |
|------|-----------|----------------|
| TASK-009 | Vague prompt → Architect/Research conflict | Prompt ambiguity |
| TASK-010 | `pm-review.sh` missing `--auto` | Permission issue |
| TASK-011 | Same Smart Approval issue at Verification | Permission issue |

## 11 Work Packages

| WP | Milestone | Objective | Status |
|----|-----------|-----------|--------|
| WP-1.1 | M1 | Permission Recovery Infrastructure | DONE |
| WP-1.2 | M1 | Artifact Provider Abstraction | DONE |
| WP-1.3 | M1 | Recovery Engine (retry + degraded + BLOCKED) | DONE |
| WP-1.4 | M1 | Recovery Readiness Check | DONE |
| WP-2.1 | M2 | Canonical Spec Generation | Pending |
| WP-2.2 | M2 | Artifact Metadata Envelope (9 fields) | Pending |
| WP-2.3 | M2 | PM Review Staleness Detection | Pending |
| WP-2.4 | M2 | Framework Invariant + Contract Validation | Pending |
| WP-3.1 | M3 | Cross-Worker Conflict Classification | Pending |
| WP-3.2 | M3 | Cross-Worker Repair Prompt (4-excerpt) | Pending |
| WP-3.3 | M3 | Repair Optimization + Spec Drift | Pending |

## M1 Files Modified

- `scripts/pm-review.sh` — --auto added, degraded mode handler
- `scripts/artifact-provider.js` — NEW: ArtifactProvider class
- `scripts/engine/index.js` — provider integration, recovery loop, BLOCKED terminal state
- `scripts/preflight.sh` — permission canary
- `scripts/health-check.sh` — permission probe

## Artifact Metadata Schema (v1)

9 fields: schema_version, task_id, phase, worker, generation, timestamp, supersedes, repair_iteration, canonical_spec_version.

Backward compat: no frontmatter → schema_version 0.

## Canonical Spec Configuration

```json
{"canonicalSpec": {"model": "auto", "tier": "sprinter", "provider": "inherit"}}
```

## Release Strategy

Single commit, single tag, single push at end. No milestone commits/tags.
---

## Source: `production-readiness-cleanup-wp101.md`

# WP-101 — Production Readiness Cleanup Pattern

**Authority:** inspect, refactor organization, clean temporary files, archive documents, improve documentation, hygiene, maintainability ONLY. NOT authorized: commit, push, create releases, change Runtime/Engine/PM/Barrier/WECP/worker logic/dashboard functionality/introduce features.

**Goal:** 95+ (stretch 100). Repeat scan until no safe improvement.

## .gitignore Canonical (production)

```
# OS / IDE / Node / Temp / Logs
.DS_Store / .vscode / .idea / node_modules / *.tmp / *.log
# Runtime artifacts
status.json / .env / dashboard/dist/ / audit.json / history.json / snapshots/ / cache/
reports/ / tasks/ / docs/release-readiness/
# AIC DB & generated
.aic/auth.json / .aic/tasks/ / .aic/prompts/ / .aic/state.json / .aic/metrics.json
.aic/chat-history.json / .aic/artifacts/ / .aic/latency_metrics.json
.aic/phase-contracts/ / .aic/runtime-contracts.json / .aic/worker-compliance.json
.aic/server.pid / .aic/health.json / .aic/active-project.json / ... + .aic/shared-context/ .aic/logs/
# Python
__pycache__/ / .pytest_cache/
```

Fonts `dashboard/public/fonts/*.ttf` MUST stay tracked (FIX-022). Never ignore.

## Archive Convention (archive over delete)

- `archive/runtime-stabilization/` — FIX-008..023, IMP-024 lineage, dead orchestrator helpers
- `archive/release-readiness/` — was `docs/release-readiness/`
- `archive/defects/` / `archive/milestones/`
- Move via `git mv` to preserve history; `git add -A archive/`
- Root temp files delete: `AGENTS.md.deprecated`, `BASELINE-K.md`, `MASTER-PLANNING-KM-REVIEW.md`, `patch.diff`, `patch.js`

## Dead Helper Criteria

Archive when: 0 refs in `scripts/engine/`, `server.js`, `phase-runner.sh`; superseded by `engine/index.js`+`phase-runner.sh`.
Confirmed dead this pass: `dispatcher-orchestrator.sh`, `dynamic-router.sh`, `worker-distributor.sh` → `archive/runtime-stabilization/`.
Leave uncertain (task-decomposer, decision-engine, dependency-graph, collaboration, recovery) — need separate audit per WP-101 uncertainty rule.

## Config Drift Fix

Env var is `PROVIDER=aic` (read by `spawn-worker.sh` as `${PROVIDER:-aic}`). `scripts/config.sh` must validate `PROVIDER` not `PROVIDER_ID` (bug: REQUIRED array had PROVIDER_ID).
Create root `.env.example` with PROVIDER, API_KEY, MODEL_THINKER/CRAFTER/SPRINTER, AIC_API_URL, CORS.

## Docs Canonical Locations

- `docs/operations/operations-runbook.md` (not `references/`)
- `docs/operations/operations-guide.md` (deployment, distinct from runbook)
- `docs/INDEX.md` must point to `archive/` and `.env.example`
- `LICENSE` at root (copy from archived `license.txt` if missing)

## Ledger Handling

- `knowledge/task-entries.json` is auto-appended on task-complete → revert before commit (not staged). Policy: tracked historically but not part of release commit.

## Verification (ad-hoc)

Use OS-safe tempfile: `TF=$(mktemp /tmp/hermes-verify-wp101-XXXX.sh)`, write focused script, `chmod +x && bash`, `rm -f`, summarize as ad-hoc not suite green.

Checks:
- `grep -Fq "reports/" .gitignore`
- `git check-ignore -q .aic/latency_metrics.json`
- `git ls-files --others --exclude-standard | grep -v "^\.aic/"` → 0 untracked prod
- `node --check scripts/server.js && bash -n scripts/*.sh && python3 -m py_compile scripts/*.py`
- Existence: `archive/runtime-stabilization/`, `.env.example` with PROVIDER, `dashboard/public/fonts/PressStart2P-Regular.ttf`
- Regression: `grep -q "FINAL_EXIT.*FINAL_PATH.*json.dumps" scripts/spawn-worker.sh`, `extract_session_id` in worker-execution-pipeline.py

## Scoring (WP-100 → WP-101)

Before: 72/100 (Architecture 90 Runtime 90 Worker 80 Repo 45 Docs 55 Config 70)
After: 94.3 conservative, 95+ weighted — gaps: phase-contracts seeding, knowledge ledger policy, legacy script full audit.

## Staging Ready

- 90 files example: 45 active FIX/IMP refs + font + taskTimer + worker-continue-prompt + promo brief + .env.example + LICENSE + archive moves + 20 prod M fixes (+3034/-365)
- Untracked prod 0, no `hermes-verify-*.sh` in repo, engine compiles
- NO auto-commit per authority — await explicit user `commit` signal

## Remaining Manual Decisions (STOP)

1. Legacy platform scripts still in scripts/ — historical or production?
2. knowledge-*.sh 9 scripts — superseded?
3. `.aic/phase-contracts/*.json` seeding — needs templates/phase-contracts/ + setup.sh creation (behavioral, STOP)
4. Dashboard PNG screenshots — docs/assets/ vs tracked root?
5. `docs/architecture/architecture-overview.md` outdated (says no dashboard src)

---

## Source: `repository-finalization-wp102.md`

# WP-102 — Repository Finalization (Governance 100/100)

**Authority:** reorganize, archive, move docs, update .gitignore, move assets, normalize layout, remove obsolete. MUST NOT modify Runtime/Engine/FSM/WECP/PM Review/worker execution/Dashboard behavior.

**Goal:** eliminate governance debt — no ambiguous ownership, no undecided archive candidates, no duplicate/obsolete/misleading docs, no historical mixed with production.

## 1. Legacy Scripts — KEEP/ARCHIVE/DELETE

### Criteria
- **KEEP** if referenced by `scripts/engine/*.js`, `server.js`, `phase-runner.sh`, `spawn-worker.sh`, `monitor.sh`, `self-test.sh`, `knowledge-*.sh` lifecycle, `api-auth.sh`, `auth.js`.
- **ARCHIVE** if 0 refs in prod code and early Milestone E/J prototype superseded by `engine/index.js` + `phase-runner.sh`.
- **DELETE** if temp, duplicate, zero historical value (`patch.*`, `AGENTS.md.deprecated`, `BASELINE-K.md`).

### Decisions (WP-102)

**KEEP (production — 40+ files):**
`api-auth.sh`, `artifact-registry.sh`, `auth.js`, `cache-context.sh`, `changelog.sh`, `closeout-context-block.py`, `config.sh`, `context-gather.sh`, `deploy.sh`, `detect-context.sh`, `engine/*`, `enterprise-endpoints.js` (server.js require), `ops-endpoints.js` (server.js require), `health-check.sh`, `knowledge-*.sh` x8, `legacy-extract-sid.py`, `logger.sh`, `metrics.sh`, `monitor.sh`, `opencode-json-to-md.py`, `opencode-token-extract.py`, `phase-contract-loader.py`, `phase-runner.sh`, `pipeline-orchestrator.sh` (legacy entry kept), `planning-post-gen-gate.py`, `pm-repair-respawn.js`, `pm-review.sh`, `preflight.sh`, `queue.sh`, `recovery.sh`, `rework-handler.sh`, `rollback.sh`, `self-test.sh`, `server.js`, `setup.sh`, `spawn-sub.sh`, `spawn-worker.sh`, `trivial-*.py`, `validate-*.py`, `worker-completion-contract.sh`, `worker-continue-prompt.sh`, `worker-execution-pipeline.py`, `worker-noop-detector.py`, `worker-validation.sh`, `aic` CLI.

**ARCHIVE platform-experiments/ (14):**
`audit-platform.sh`, `collaboration.sh`, `context-sharing.sh`, `decision-engine.sh`, `dependency-graph.sh`, `permissions.sh`, `project-manager.sh`, `resource-manager.sh`, `security-governance.sh`, `task-decomposer.sh`, `worker-autonomy.sh`, `worker-memory.sh` (distinct from knowledge-*.sh), `worker-registry.sh`, `workspace.sh` → `archive/platform-experiments/` + README with supersession table.

**ARCHIVE runtime-stabilization/ (3 dead orchestrators):**
`dispatcher-orchestrator.sh`, `dynamic-router.sh`, `worker-distributor.sh` — 0 engine refs, superseded.

**ARCHIVE ops/ (1):** `stress-test.sh` dev-only.

**DELETE (5):** `AGENTS.md.deprecated`, `BASELINE-K.md`, `MASTER-PLANNING-KM-REVIEW.md`, `patch.diff`, `patch.js`.

Implementation: `git mv scripts/<file> archive/<category>/` to preserve history. Revert if `server.js` requires (e.g. `enterprise-endpoints.js`, `ops-endpoints.js` were temporarily archived then restored — verify via `grep require server.js`).

## 2. Knowledge Policy

**Decision: IGNORED / GENERATED**

- `knowledge/task-entries.json` append-only ledger on `task-complete` (7 historical entries). Not production config.
- Action: add `knowledge/task-entries.json` to `.gitignore`, `git rm --cached` (keep on disk).
- Verify: `git check-ignore -q knowledge/task-entries.json` must PASS.
- Rationale: aligns with `.aic/` ignore policy — runtime ledger ≠ source.

## 3. Phase Contracts

**Canonical:** `templates/phase-contracts/{investigate,implementation}.json`
**Runtime:** `.aic/phase-contracts/` (generated/ignored)

- Only 2 locations existed; runtime is gitignored.
- Action (no runtime change): copy `.aic/phase-contracts/*.json` → `templates/phase-contracts/` as seed. Document seeding path.
- Docs: `architecture-overview.md` shows `templates/ → .aic/` flow. Future `setup.sh` could seed if absent — would be behavioral, deferred to ADR.

## 4. Dashboard Assets

**Decision: DOCS ONLY → `docs/assets/`**

- 4 PNGs at root `dashboard-*.png` (93-234KB) doc-only, only referenced by `README.md ![ ]`.
- Move via `git mv *.png docs/assets/` (R).
- Update README: `./dashboard-overview-v2.png` → `./docs/assets/dashboard-overview-v2.png`.
- `dashboard/public/fonts/PressStart2P-Regular.ttf` stays tracked (FIX-022 self-host).

## 5. Documentation Sync

- `architecture-overview.md`: Rewrite — source is Vite+React (`dashboard/src/`), not compiled-only; self-hosted font; engine FSM; file-based contracts; archive governance.
- `docs/INDEX.md`: Add assets, templates/phase-contracts, governance, knowledge policy quick-start.
- `README.md`: Structure block actual layout, PNG refs fixed, references count generic.
- `developer-guide.md`: Full current layout, conventions, verification patterns.
- `operator-guide.md`: Intent API via `curl_api`, taskTimer, config template.
- `SKILL.md`: Add WP-102 router + 4 stub refs resolved.

## 6. References Categorization

- **Active `references/` (109):** FIX/IMP lineage, runtime OAT, WECP, pits — all referenced by SKILL.md after WP-102 stubs.
- **Archive runtime-stabilization (16):** FIX-020 etc + dead orchestrators.
- **Archive platform-experiments (14+README):** E/J prototypes.
- **Archive milestones/defects/release-readiness/ops:** H..L reports.

No ambiguous placement — every file has exactly one home, `git mv` preserves history.

## 7. Repository Root — Production Only

Final root:
`AGENTS.md` (deprecated compat 547B, KEEP per Hermes `_load_agents_md()`), `aic` CLI, `CHANGELOG.md`, `LICENSE`, `README.md`, `SKILL.md`, `requirements.json`, `.env.example`, `.gitignore`, `dashboard/`, `docs/`, `knowledge/` (ledger ignored), `references/`, `scripts/` (prod only), `templates/`, `archive/`, `.aic/` (mostly ignored).

## Verification (ad-hoc, no suite)

```bash
TF=$(mktemp /tmp/hermes-verify-wp102-XXXX.sh)
cat > "$TF" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
cd ~/.hermes/skills/workflows/aic
git check-ignore -q knowledge/task-entries.json
git check-ignore -q .aic/latency_metrics.json
[ -z "$(git ls-files --others --exclude-standard | grep -v "^\.aic/")" ] || exit 1
[ -z "$(git diff --stat)" ] || exit 1
node --check scripts/server.js
for f in scripts/engine/*.js; do node --check "$f"; done
for f in scripts/*.sh; do bash -n "$f"; done
python3 -m py_compile scripts/*.py
[ "$(git diff --cached --stat -- scripts/engine/ scripts/server.js scripts/worker-execution-pipeline.py scripts/spawn-worker.sh scripts/phase-runner.sh | wc -l)" -eq 0 ]
echo "OK_WP102_HERMES_VERIFY"
SH
chmod +x "$TF"; bash "$TF"; rm -f "$TF"
```

Rules: prefix `hermes-verify-` under `/tmp` with `mktemp`, focused checks only, cleanup, summarize as ad-hoc not suite green.

## Scoring

Governance 100/100 when:
- 0 untracked prod, 0 unstaged, engine diff 0
- .gitignore canonical (reports/, tasks/, .aic/*, knowledge/task-entries.json, __pycache__/)
- 0 ambiguous legacy scripts
- docs links all resolve, PNGs in docs/assets/
- templates/phase-contracts/ canonical
- archive READMEs present with restore instructions

Production Readiness: 72 (WP-100) → 94.3 (WP-101) → 98/100 (WP-102) — gap to 100 is ADR for phase-contracts seeding.
