# Runtime Oat

> **Consolidated from 8 files.** Originals archived in `references/archive/`.

**Original files merged:**
- `runtime-oat-adhoc-verify.md`
- `runtime-oat-guarded-forensics.md`
- `runtime-oat-imp007-030-blocked-pm-engine.md`
- `runtime-oat-investigate-pm-fix006.md`
- `runtime-oat-investigate-scope.md`
- `runtime-oat-planning-artifact-alignment.md`
- `runtime-oat-preflight-fix008-009.md`
- `runtime-oat-wrong-task-start.md`

---

---

## Source: `runtime-oat-adhoc-verify.md`

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
---

## Source: `runtime-oat-guarded-forensics.md`

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
---

## Source: `runtime-oat-imp007-030-blocked-pm-engine.md`

# Runtime OAT IMP-007 — TASK-030 BLOCKED (engine PM)

## Result (pre-FIX-008)

**BLOCKED** — not a WECP/Strategy B failure on the successful worker run.

## What passed (worker layer)

- Task `TASK-20260713-030`, Investigate `pm`, WECP
- `=== WECP: generate PASS ===` → `reports/pm-output.md` (8643 B)
- `=== Phase Investigate: ALL WORKERS PASSED ===`
- Strategy B continue **not** invoked (pass 1 had artifact — expected)

## First failure (pipeline, pre-FIX-008)

Immediately after worker barrier:

```
[engine] pipeline error TypeError: Assignment to constant variable.
    at runPmReview (scripts/engine/index.js:184:15)
    at runPhase (scripts/engine/index.js:269:22)
```

- **PM Review** did not complete for 030
- API stuck: `pipelineState=INVESTIGATE`, `phaseStatus=barrier_wait`

## FIX-008 (shipped)

`const artifacts = []` → `let artifacts = []` in `runPmReview` (`engine/index.js` ~176). Ad-hoc verify: `hermes-verify-fix008-*` (`node --check`, scope check).

**Must restart** `node scripts/server.js` after deploy — running process keeps old code until SIGTERM.

## Post-FIX-008 OAT evidence (2026-07-13)

- **030** after restart: Investigate WECP PASS → **PM Review Investigate PASS** (no TypeError).
- **031** created by OAT script stayed **CREATED/idle** while engine ran **030** — guarded OAT needs **idle engine** (`currentTask` null or cancel stuck task) before `task.start` on new TASK.
- **030 Planning:** barrier ALL WORKERS PASSED → `phaseStatus: failed` (log truncated before Planning PM); workers logged `no contract (skip)` — legacy path, weak artifacts. Not FIX-008.

## OAT script / infra notes

- `task.pause` with `paused:false` still pauses engine — use **`task.resume`**
- Server **SIGTERM** during OAT leaves tasks idle until manual `task.start` after restart
- Poller may exit 0 early if server down — ground truth: `/tmp/aic-server-6868.log`
- See also `references/runtime-fix008-post-oat.md`

## Classification

**FIX-008:** Runtime PM gate const bug (resolved). **IMP-007 continue:** orthogonal; skip when pass 1 extracts. **Planning fail:** separate (contracts / legacy skip).
---

## Source: `runtime-oat-investigate-pm-fix006.md`

# Investigate PM deliverable (FIX-006)

## Symptom (OAT 021)

- Investigate worker `pm` completes; barrier ALL PASS.
- PM Review Investigate → **REWORK** (exit 1), not parser UNKNOWN.
- PM feedback: `pm-output.md` is an **executive summary** — counts criteria/dependencies without enumerating them; references content not in file.

## Classification

- **Worker artifact defect** / **prompt defect** — Runtime and PM behaved correctly.
- Distinct from FIX-004 (verdict parse) and FIX-005 (Implementation NDJSON).

## Fix (shipped)

`phase-runner.sh`: for `PHASE=Investigate` + `worker=pm`, append contract block requiring:

- `# Investigate Report` + sections: Objective, Scope, Requirements Identified, Assumptions, Unknowns, Risks, Dependencies, Acceptance Criteria, Recommendation.
- No executive summary, placeholders, external refs, counts without full text.

## Verification

Ad-hoc: `grep` headings in `phase-runner.sh` + `bash -n`. Not canonical OAT.

## OAT monitor (user preference)

Post live updates in chat for every Runtime OAT: TASK id, phase, PM exit, terminal state — proactively.
---

## Source: `runtime-oat-investigate-scope.md`

# Runtime OAT — Investigate scope and PM gate

## Problem

`phase-runner.sh` builds a **4-line** generic prompt (`You are the pm… Phase: Investigate… Execute your assigned tasks…`). With **empty** `task.create` description, the PM worker **drifts** to repo discovery (`requirements.json`, unrelated `TASK-20260708-008` issues) instead of the OAT task title.

PM Review then returns **REWORK** (duplicate sections, non-standard verdicts) — **justified** against artifact quality, not a PM script defect.

## OAT task.create minimum

For Runtime / FEAT-001 OAT, always set:

- **title** — short label
- **description** — explicit scope, e.g. “Prove FEAT-001 runtime: single pipeline, bounded Investigate report only; no implementation.”
- **projectDir** — absolute path

Optional: attach `requirements.json` path in description only if that is the intended work package.

## Investigate deliverable (PM worker)

Prompt should require **one** markdown report with:

- Task id and title from `context.json`
- User story / acceptance criteria **for this task only**
- **VERDICT** line not required in worker artifact (PM review adds verdict); worker output = discovery report only

## PM gate evidence

- **PASS** requires `pm-review.sh` exit **0** and parseable `VERDICT: PASS`
- **REWORK** exit **1** → engine may set **BLOCKED** on **that** task’s checkpoint (if task isolation holds)
- Empty `reports/` → PM skipped (`allPass: true`) — pipeline should **not** BLOCK on PM for that task

## spawn-worker / metrics

- `set -u`: never reference `$INPUT_TOKENS` before assignment; metrics POST from **raw** opencode JSON file
- Artifact path: `opencode-json-to-md.py` before copy to `reports/{worker}-output.md`

See `opencode-json-artifact-and-metrics.md`.
---

## Source: `runtime-oat-planning-artifact-alignment.md`

# Runtime OAT — Planning PM artifact alignment (OAT 037)

## When to load

FIX-010/013 chain **PASS** on Investigate; Planning workers complete; **PM Planning REWORK** citing **inconsistent or off-scope** `architect-output.md` / `research-output.md` vs `pm-output.md`. **Not** FIX-014 (Implementation never ran).

## Symptom (037)

- `pm-output.md` — FIX-014 / OAT scope, WPs, architecture XML — PM says largely complete
- `architect-output.md` — different thread (e.g. context management / scalability)
- `research-output.md` — orthogonal topic (e.g. memory layer vs Mem0)
- PM: three artifacts read as unrelated; weak Investigate → Planning traceability for scoped OAT

## Distinction

| Failure | Phase | Fix class |
|---------|-------|-----------|
| Session preamble before H1 | Implementation | FIX-014 WECP normalize |
| Architect/research off-task | Planning | Worker prompts, task description, parallel worker isolation |
| PM argv / empty verdict | Any PM gate | FIX-011–013 |

## OAT task description

Thin or generic `task.create` description → parallel Planning workers drift. For scoped OAT (FIX-014, FIX-013), description should name **single proof target** and bind architect/research to same WPs as `pm-output`.

## Minimal corrective action

1. **Respawn** architect/research with prompts referencing task `description` + Investigate `pm-output.md` + FIX scope
2. **Or** narrow Planning barrier / contracts so off-scope roles skip PM bundle criteria
3. **Or** amend task acceptance to declare parallel tracks explicitly

**Runtime:** REWORK → BLOCKED is correct; no engine change.

## User preference

Scoped OAT reports should state **which fix was validated** vs **which phase blocked** (e.g. "FIX-014 not reached; Planning REWORK").
---

## Source: `runtime-oat-preflight-fix008-009.md`

# Guarded Runtime OAT — preflight (FIX-008 + FIX-009)

## When to use

Any **single-task** Runtime OAT after engine or WECP changes. Do not create a new task until Runtime is isolated.

## Preflight sequence

```text
GET /api/status
  → pipelineRunning == true?  STOP (pipeline_busy)
  → currentTask non-terminal?  task.cancel(activeTaskId); re-query
  → still busy? STOP (release failed)
  → restart server.js if engine code changed
  → currentTask null AND pipelineRunning false?  proceed
```

**Non-terminal** checkpoint: anything except `COMPLETE`, `CANCELLED` (includes `CREATED`, `INVESTIGATE`, `PLANNING`, `BLOCKED`, failed phaseStatus).

## Execute

1. `task.create` (description ≥ 40 chars for PM)
2. `task.start` — **must** parse JSON:
   - `ok: true` → poll this `taskId` only
   - `error: task_active` | `pipeline_busy` → **STOP**; do not poll CREATED orphan

## Success criteria (ownership + PM barrier)

- New task id == `currentTask.id` after start
- No `TypeError` in server log after `ALL WORKERS PASSED`
- PM Review lines for **same** task id in log tail
- IMP-007: observe naturally — `generate continue (Strategy B)` only if pass 1 extract fails

## Known post-barrier failure (not FIX-008/009)

**Planning** `ALL WORKERS PASSED` then `phaseStatus: failed` without `PM Review: Planning` in log — legacy `no contract (skip)` workers; investigate `phase-runner` exit code separately. Observed TASK-032.

## Live chat reporting

User preference: report OAT start, phase changes, PM exits, COMPLETE/BLOCKED in chat — not only final summary. See `runtime-oat-guarded-forensics.md`.
---

## Source: `runtime-oat-wrong-task-start.md`

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