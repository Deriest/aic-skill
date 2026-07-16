# Runtime Fixes

> **Consolidated from 13 files.** Originals archived in `references/archive/`.

**Original files merged:**
- `runtime-fix008-post-oat.md`
- `runtime-fix009-task-ownership.md`
- `runtime-fix010-barrier-reconciliation.md`
- `runtime-fix011-pm-review-isolation.md`
- `runtime-fix012-pm-prompt-transport.md`
- `runtime-fix014-wecp-h1-normalize.md`
- `runtime-fix015-planning-task-authority.md`
- `runtime-fix016-planning-research-scope.md`
- `runtime-fix017-implementation-skeleton-lock.md`
- `runtime-fix018-closeout-manifest.md`
- `runtime-fix019-pm-repair-respawn.md`
- `runtime-fix021-cross-phase-reentry.md`
- `runtime-imp015-pm-repair-loop.md`

---

---

## Source: `runtime-fix008-post-oat.md`

# FIX-008 — runPmReview const fix & post-OAT notes

## Defect

`runPmReview()` built `artifacts` from `reports/*.md`, then reassigned:

`artifacts = filterPmArtifacts(skillDir, phase, artifacts)`

with `const artifacts = []` → **TypeError** after `ALL WORKERS PASSED` (029, 030 pre-fix).

## Fix (one line)

`let artifacts = []` in `scripts/engine/index.js` inside `runPmReview` only. PM PASS/REWORK/BLOCKED logic unchanged.

## Verification (ad-hoc, not suite)

`/tmp/hermes-verify-fix008-*`: `node --check`, `let` in `runPmReview`, no `const artifacts` in that function body.

## Runtime OAT prerequisites

1. **Restart** API after engine patch (kill old `node .../server.js`, start fresh).
2. **Unpause:** `POST /api/runtime/intent` `{"intent":"task.resume"}` — not `task.pause` + `paused:false` (pause intent always sets paused).
3. **Single active pipeline:** `task.create` + `task.start` on new TASK fails to run if another task holds engine (`031` idle while `030` active).

## Observed post-FIX-008 (TASK-030)

| Step | Result |
|------|--------|
| Investigate WECP generate | PASS |
| Continue (Strategy B) | Skipped (pass 1 had markdown) |
| PM Review Investigate | PASS exit 0 |
| Planning workers | `no contract (skip)` — legacy |
| Planning barrier | ALL WORKERS PASSED |
| Planning terminal | `phaseStatus: failed` (PM/barrier follow-up — investigate log tail) |

## IMP-007 continue (natural observation)

Do not force continue in OAT. Record: if pass 1 `generate PASS`, stderr must **not** contain `=== WECP: generate continue (Strategy B) ===`.

## Cost / metrics (FAQ)

Task **done** does not gate cost. `POST /api/metrics` from legacy `spawn-worker.sh` only (no `taskId`); WECP path often posts nothing. `summary.cost` = sum of all `metrics.json` entries. See `references/runtime-cost-metrics.md`.
---

## Source: `runtime-fix009-task-ownership.md`

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
---

## Source: `runtime-fix010-barrier-reconciliation.md`

# FIX-010 — Runtime barrier reconciliation (Planning failed after ALL WORKERS PASSED)

## Symptom (TASK-20260713-032)

```
Planning workers (pm, architect, research)
  → phase-runner: ALL WORKERS PASSED, exit 0
  → runPhase: phaseStatus = failed, pipelineState = PLANNING
  → PM Review: Planning — NOT in server log
```

Investigate PM can PASS (FIX-008). Ownership can be correct (FIX-009). Failure is **engine barrier checkpoint**, not WECP.

## Root cause

- `finishLease` → `markWorkerComplete` on checkpoint should record each worker in `phaseBarrier.completed`.
- Under parallel Planning, checkpoint can be **incomplete** (e.g. `pm` missing from `completed` while `research` + `architect` present) even when `reports/pm-output.md` exists and shell barrier passed.
- `runPhase` called `barrierSatisfied()` **without** reconciling disk/lease evidence → silent `failed` at `index.js` ~L272–277 (pre-FIX-010).

## Shipped fix (FIX-010)

After `phase-runner` exit **0**, before `barrierSatisfied()`:

1. `readCheckpoint` (fresh barrier from disk).
2. `reconcilePhaseBarrier(taskId, cp)` — for each worker in `phaseBarrier.workers` not in `failed`:
   - skip if already `complete`;
   - else mark complete if lease `status === 'complete'` **or** `validateArtifactFile` on `reports/<worker>-output.md`.
3. If still not satisfied → `logBarrierIncomplete` (JSON: missing workers, artifact paths, lease states) → `phaseStatus = failed`.

Log on success: `[engine] barrier reconciled` with `{ worker, via: lease|artifact }`.

## OAT expectation post-FIX-010

- Planning → log `barrier reconciled` (often `pm` via `artifact`) → `PM Review: Planning` → PASS/REWORK.
- **Restart** `node scripts/server.js` after engine patch.

## Related

- IMP-008 investigation: classification **Barrier** (not Planning worker defect alone).
- No `planning.json` → `validate-phase-artifact.py` prints `no contract (skip)` for Planning roles; reconcile uses **default** `runtime-contracts.json` min bytes/lines, not phase contract.
- Distinct from FIX-008 (`let artifacts` in `runPmReview`) and FIX-009 (`task_active`).

## Forensic checklist (no code)

1. Read `.aic/tasks/<TASK>/engine.json` → `phaseBarrier.completed` vs `workers`.
2. List `reports/*-output.md` sizes.
3. Grep server log: `ALL WORKERS PASSED` then `barrier reconciled` or `barrier incomplete after reconciliation`.
4. If PM Planning absent and no reconcile log → pre-FIX-010 engine or server not restarted.
---

## Source: `runtime-fix011-pm-review-isolation.md`

# FIX-011 — PM Review invocation isolation

## Problem (033)

`pm-review.sh` invoked `opencode run ... --auto`. PM model implemented engineering work (e.g. CORS patches) instead of returning `VERDICT:`. Parser correctly → UNKNOWN exit 3 → BLOCKED. Not a parser bug (FIX-004).

## Shipped fix

- Prompt: review only; no implement / edit / tools.
- First non-empty line must be exactly `VERDICT: PASS|REWORK|BLOCKED`.
- PM invocation: **omit `--auto`** (workers still use `--auto` via `spawn-worker.sh`).

## Verification

Ad-hoc: `grep review only pm-review.sh`; `! grep --auto pm-review.sh`; `bash -n pm-review.sh`.

## OAT

No engine restart required for shell-only change. Expect parseable verdict on Investigate PM gate.

## Follow-on (034)

Removing `--auto` alone did not deliver prompt content: positional path still triggered `read(promptFile)` with no text output. **FIX-012** attaches prompt via `opencode run -f` — see `references/runtime-fix012-pm-prompt-transport.md`.
---

## Source: `runtime-fix012-pm-prompt-transport.md`

# FIX-012 — PM prompt transport via OpenCode `-f` (IMP-010)

## Problem (034, post–FIX-011)

`pm-review.sh` invoked:

```text
opencode run "$PROMPT_FILE" -m … --format json
```

OpenCode CLI treats the **positional** as `message` (literal text), **not** “load this file as prompt.” The model sees a path string and calls `read(promptFile)`. Without `--auto`, read is rejected → NDJSON has **no `type:text`** → `opencode-json-to-md.py` empty → parser UNKNOWN exit 3.

Artifacts and verdict instructions were **already inside** the generated prompt file; the model never received them as user content.

## Shipped fix (FIX-012)

Only `scripts/pm-review.sh` Node runner — **argv order (IMP-011 / 035):**

```javascript
// CORRECT: short message first positional after run
opencode run <reviewMsg> -m <model> --format json -f <promptFile>

// WRONG: message after -f → OpenCode treats it as file path → empty stdout
opencode run -m <model> --format json -f <promptFile> <reviewMsg>
```

- **`-f`**: CLI-supported file attachment (full generated PM prompt).
- **First positional after `run`**: short review-only reminder (first line `VERDICT: …`; no implementation).
- FIX-011 review-only body in prompt file **unchanged**; parser / `opencode-json-to-md.py` **unchanged**.

## Worker vs PM (do not conflate)

| Path | Pattern | Why it “works” for workers |
|------|---------|----------------------------|
| WECP / `spawn-worker.sh` | `run <path> … --auto` | `--auto` approves `read(path)` so prompt file content is loaded via tools |
| PM (FIX-011+) | `run <msg> -m … --format json -f <file>` without `--auto` | Content attached; message after `-f` is parsed as path (035) |

## Verification (ad-hoc)

```bash
P=scripts/pm-review.sh
bash -n "$P"
grep -q "'-f', promptFile" "$P"
grep -q 'Review the attached prompt' "$P"
! grep -q "run', promptFile, '-m'" "$P"
```

## OAT expectation

Investigate PM: log shows `Invoking PM via opencode`; raw verdict should include assistant **text** with `VERDICT:` line — not tool-only NDJSON. Then Planning can exercise FIX-010 `barrier reconciled`.

## Related

- IMP-009: model implemented instead of verdict (033, with `--auto`).
- IMP-010: positional path transport (034).
- IMP-011: argv order + empty raw + stderr suppression — `references/runtime-pm-opencode-invocation-imp011.md`.
- FIX-011: review-only prompt + no `--auto` on PM (still required with FIX-012).
---

## Source: `runtime-fix014-wecp-h1-normalize.md`

# FIX-014 — WECP H1 preamble strip

**When:** Implementation PM REWORK for session lines before `# Backend Implementation` / `# Frontend Implementation` while WECP generate PASS (IMP-012, OAT 036).

**Fix:** `worker-execution-pipeline.py` — after `extract_md`, before `validate`: `normalize_artifact_to_contract_h1` using `requiredSections[0]` from phase contract. Preserves YAML frontmatter + blank lines before H1; no change below H1.

**Not:** PM argv, parser, `implementation.json`.

**Verify:** ad-hoc import + 036 artifact samples; OAT needs Implementation phase reached.
---

## Source: `runtime-fix015-planning-task-authority.md`

# FIX-015 — Planning workers bound to context.json

**When:** Planning PM REWORK for inconsistent pm/architect/research (IMP-013, OAT 037). `context.json` is authoritative; Planning pm invented different epic.

**Fix:** `phase-runner.sh` — when `PHASE=Planning`, inject `PLANNING_AUTHORITY_BLOCK` before `TASK_SCOPE` for pm, architect, research. Requires verbatim `## Task Authority (verbatim)` with title + description; forbids rename/roadmap/epic outside task.

**Not:** Runtime, WECP, PM transport.

**OAT:** New task after server up; Planning PM must align before FIX-014 E2E.
---

## Source: `runtime-fix016-planning-research-scope.md`

# FIX-016 — Planning research worker task scope

**When:** OAT 038 — pm + architect pass FIX-015 Task Authority; **research** still produces off-topic report (e.g. AIC Router SOTA) without `# Planning Research` / `## Task Authority`.

**Root cause:** Shared `PLANNING_AUTHORITY_BLOCK` was present in prompt; research model ignored it (parallel spawn, default “research the repo” behavior).

**Fix:** `phase-runner.sh` — only when `PHASE=Planning` and `worker=research`, append `RESEARCH_PLANNING_BLOCK` after `TASK_SCOPE`:
- Mandatory opener: `# Planning Research` → `## Task Authority` with verbatim title/description from `context.json`
- Explicit forbidden list: Router SOTA, LangGraph/dynamic-router, memory/orchestrator epics unrelated to task description
- Same authority as pm/architect; **no** change to pm/architect prompts

**Not:** Runtime, WECP, PM, contracts.

**Verify:** ad-hoc `grep RESEARCH_PLANNING_BLOCK` + simulated prompt assembly; OAT needs Planning PM PASS on all three artifacts.

**Chained OAT fixes (Planning → Implementation):** FIX-015 (all Planning workers) → FIX-016 (research reinforcement) → FIX-014 (Implementation H1 normalize).
---

## Source: `runtime-fix017-implementation-skeleton-lock.md`

# FIX-017 — Lock Implementation Workers to implementation.json

## Problem (IMP-016)

Backend/frontend crafters emit narrative/planning text without exact contract headings → WECP `MISSING_SECTION` ×7 through all repair attempts.

## Shipped changes

| File | Change |
|------|--------|
| `scripts/phase-runner.sh` | `IMPLEMENTATION_SKELETON_BLOCK` for `Implementation` + `backend` \| `frontend` — mandatory H1, exact heading list, forbidden planning/diary prose |
| `scripts/worker-execution-pipeline.py` | If repair errors are **only** `MISSING_SECTION` → **full skeleton** regenerate prompt (not patch-only) |

## Unchanged

Runtime, PM, validator, repair limits, Planning/Investigate phases.

## Verify (ad-hoc)

```bash
# /tmp/hermes-verify-fix017-*.py — synthetic artifact with all sections → validate PASS
# build_repair_prompt: all MISSING_SECTION → contains "full skeleton", no CURRENT ARTIFACT
```

## OAT

Restart `server.js` after deploy; new task; expect WECP generate PASS or repair#1 full-skeleton recovery.

## Related

- `.aic/phase-contracts/implementation.json`
- `references/imp016-wecp-implementation-missing-section.md`
- `references/wecp-architecture-and-pitfalls.md`
---

## Source: `runtime-fix018-closeout-manifest.md`

# FIX-018 — Closeout manifest rollup (shipped)

## Problem (OAT-041 / IMP-017)

Closeout is **pm-only** synthesis with **no** `closeout.json` WECP contract. Worker inferred inventory → wrong rollup (qa absent, planning-output.md / TASK-040, IMP-015 “N/A”) while disk had `qa-output.md`, no `planning-output.md`, and `engine.json` rework. Closeout PM REWORK until IMP-015 cap → BLOCKED.

## Fix

- `scripts/closeout-context-block.py` — manifest `reports/*.md`, Task Authority, engine snapshot, rework / IMP-015 exercised, rollup source map, COMPLETE rule when Verification `pmReview` PASS.
- `scripts/phase-runner.sh` — `CLOSEOUT_CONTEXT_BLOCK` before `TASK_SCOPE` for Closeout + `AIC_TASK_ID`.

## OAT success criteria (FIX-018)

Reach **Closeout** with Verification PM PASS; Closeout pm must cite **only manifest files** and correct TASK id; PM PASS → COMPLETE.

## Pitfall

**Planning research drift** (042) can block pipeline **before** Closeout — FIX-018 not exercised. Do not claim FIX-018 PASS until Closeout PM runs with injected block.

## Verify (ad-hoc)

```bash
python3 scripts/closeout-context-block.py <SKILL_DIR> <TASK_ID> <context.json>
# expect: Manifest lists qa-output.md; IMP-015 exercised when rework present
grep FIX-018 scripts/closeout-context-block.py
grep CLOSEOUT_CONTEXT_BLOCK scripts/phase-runner.sh
```

Restart `server.js` before Runtime OAT.

## Related

- `references/imp017-closeout-artifact-resolution.md`
- `references/runtime-imp015-pm-repair-loop.md`
- `references/runtime-fix017-implementation-skeleton-lock.md` (041 Implementation path)
---

## Source: `runtime-fix019-pm-repair-respawn.md`

# FIX-019 — Deterministic PM repair respawn

**When:** IMP-018 — Planning PM REWORK repeats because respawn used the **same prompt**, **stale `reports/*-output.md`**, and no PM failure context (OAT 042).

**Not changed:** IMP-015 limits/checkpoint/barrier, FSM, WECP, PM parser, FIX-015–018 planning blocks.

## Shipped behavior

Before repair respawn (`engine/index.js`):

1. `node scripts/pm-repair-respawn.js delete-artifacts <skillDir> <taskId> <workersCsv>`
2. Env to `phase-runner.sh`: `AIC_PM_REPAIR`, `AIC_PM_VERDICT_FILE`, `AIC_PM_REPAIR_WORKERS`, `AIC_CONTEXT_FILE`

**Repair block** (`pm-repair-respawn.js repair-block`): previous REWORK, worker-specific lines from `.pm-last-verdict.txt` (`extractWorkerFailuresFromVerdict` in `engine/pm-repair.js`), current task id/title/description, correct-only instructions.

**Prompt path:** `/tmp/aic-phase-${AIC_TASK_ID}-${PHASE}-${worker}.txt` (task-scoped).

**Post-gen gate** (`spawn-worker.sh`): when `AIC_PM_REPAIR=1` and `AIC_PIPELINE_PHASE=PLANNING`, for `pm|architect|research` run `planning-post-gen-gate.py`; on FAIL → **one** regen with same prompt (no PM).

## Gate checks (vs `context.json`)

| Worker | Checks |
|--------|--------|
| research | `# Planning Research`, Task Authority, task id |
| architect | Task Authority, title |
| pm | task id, no stale `TASK-*` refs |

## Verify

```bash
# /tmp/hermes-verify-fix019-*.sh — delete-artifacts, repair-block, gate PASS/FAIL
```

## Related

- `references/imp018-planning-research-drift.md`
- `references/runtime-imp015-pm-repair-loop.md`
---

## Source: `runtime-fix021-cross-phase-reentry.md`

# FIX-021 — Cross-phase PM repair phase re-entry (shipped)

**When:** Smoke **046** **BLOCKED** after OAT **045** **COMPLETE**; Verification PM **REWORK** → `artifactPhase: IMPLEMENTATION` → inline spawn left `pipelineState: VERIFICATION`, barrier `[qa]` → **BLOCKED/spawning**.

**Supersedes:** inline `spawnWorkersForPhase(artifactPhase)` inside outer `pmRepairLoop` only (pre-FIX-021).

## Required behavior (shipped)

When `spawnPipelineState !== pipelineState` and `repairSpawnPlan.length`:

1. Persist repair checkpoint (`rework`, `pm_repair`, delete-artifacts via **node** `pm-repair-respawn.js`).
2. Log `[engine] pm repair cross-phase re-entry` with `interruptedPhase`, `artifactPhase`, `targets`, `attempt`.
3. **`await runPhase(taskId, artifactPhase, projectDir, { repairSubset, repairEnv })`** — full barrier + **Implementation** (or Planning) **PM** loop for that phase.
4. On success: restore interrupted phase — `cp.pipelineState = pipelineState`, `startBarrier(plan workers)`, `continue` outer `pmRepairLoop` (Verification PM again).
5. On failure: **BLOCKED**.

**In-phase repair unchanged:** same-phase spawn inside `pmRepairLoop` loop.

## `runPhase` options

- `repairSubset` — spawn only repaired workers; barrier = those workers only.
- `repairEnv` — `AIC_PM_REPAIR`, `AIC_PM_VERDICT_FILE`, `AIC_PM_REPAIR_WORKERS`, `AIC_CONTEXT_FILE`.

## Not changed

IMP-015 / `maxPmRepairAttempts`, FSM phase order, WECP, PM Review, FIX-018/019/020 targeting + node delete.

## Verify (ad-hoc)

```bash
/tmp/hermes-verify-fix021-*.sh
# → OK_FIX021_FRESH / OK_FIX021_HERMES_VERIFY
```

**Restart `server.js`** after `engine/index.js` deploy before smoke/OAT.

## Operator expectations

| Run | Cross-phase IMPLEMENTATION from Verification | Expected post-FIX-021 |
|-----|-----------------------------------------------|------------------------|
| 045 OAT | Often `artifactPhase: VERIFICATION` → spawn **qa** only | COMPLETE (no IMP re-entry) |
| 046 smoke | `artifactPhase: IMPLEMENTATION` | Should **re-enter Implementation** then resume Verification — **re-smoke required** |

OAT **045 COMPLETE** does **not** prove FIX-021; smoke **046** pre-021 does **not** prove regression on FIX-008–020 fixes.

## Related

- `references/imp019-verification-cross-phase-repair.md` (investigation)
- `references/runtime-fix020-pm-repair-invocation.md`
- `references/runtime-oat-adhoc-verify.md` (stale uptime banner ≠ verify)
---

## Source: `runtime-imp015-pm-repair-loop.md`

# Runtime IMP-015 — Bounded PM Repair Loop (Engine)

## Problem

Planning (and other PM-gated phases) failed **nondeterministically** across OAT 037–039: drifting worker rotated (research → pm). Prompt-only fixes (FIX-015/016) helped but did not stabilize. **Immediate BLOCKED on first PM REWORK** forced cancel + new OAT + developer prompt edits.

`rework-handler.sh` implements respawn + PM re-run but is **not called** by `scripts/engine/index.js` (FEAT-001 engine).

## Shipped behavior (IMP-015)

After workers + barrier + `pm-review.sh`:

| PM exit | Engine action |
|---------|----------------|
| 0 PASS | Clear `rework`, advance phase |
| 1 REWORK | Enter repair loop (if attempts remain) |
| 2 BLOCKED / 3 UNKNOWN | BLOCKED (no repair) |

**Repair loop:**

1. Read `reports/.pm-last-verdict.txt` (written by `pm-review.sh` when `AIC_TASK_ID` set).
2. `parseWorkersFromPmVerdict()` → subset of `pm|architect|research|backend|frontend|qa` in current phase plan.
3. If parse empty → **full-phase fallback** (all workers in phase).
4. `resetWorkersForRepair(barrier, targets)` — only targets cleared; peers stay `complete`.
5. **FIX-019:** `pm-repair-respawn.js delete-artifacts` removes `reports/<worker>-output.md` for targets only; spawn with `AIC_PM_REPAIR=1`, verdict path, repair worker list.
6. `phase-runner.sh` injects **PM REPAIR CONTEXT** (FIX-019) before `TASK_SCOPE` for repaired workers only.
7. **Planning + repair:** `planning-post-gen-gate.py` after spawn; one opencode regen if gate fails (no extra PM).
8. `phase-runner.sh` with **subset** only.
9. Barrier reconcile → PM again.
10. Max attempts: **`maxPmRepairAttempts`** in `.aic/runtime-contracts.json` (default **3**). Exceeded → BLOCKED as before.

**Checkpoint `engine.json` → `rework`:**

```json
{ "phase": "PLANNING", "attempt": 1, "repairedWorkers": ["pm"], "lastVerdict": "REWORK" }
```

Synced to dashboard `state.rework` via `syncDashboardFromCheckpoint`.

## Files

- `scripts/engine/index.js` — `pmRepairLoop`, `spawnWorkersForPhase`
- `scripts/engine/pm-repair.js` — parse + config
- `scripts/engine/barrier.js` — `resetWorkersForRepair`
- `scripts/pm-review.sh` — persist verdict; engine passes `AIC_TASK_ID`
- **FIX-019:** `scripts/pm-repair-respawn.js`, `scripts/planning-post-gen-gate.py`

## OAT expectations

- Log: `[engine] pm repair` / event `pm.repair.started` / `pm repair full-phase fallback`
- **Restart `server.js`** after engine patch before OAT.
- Planning REWORK on one worker may **self-heal** within same task (up to 3 PM cycles) without new TASK.

## Ad-hoc verify

```bash
# /tmp/hermes-verify-imp015-*.sh — node --check index+pm-repair, parseWorkersFromPmVerdict, barrier reset
```

## Not changed

WECP, PM prompts/parser, FSM phase order, leases.

## OAT evidence (040)

- Planning PM **PASS** first try → loop **not exercised** (valid when FIX-015/016 hold).
- Task stopped at **WECP** Implementation (`MISSING_SECTION`) — not an IMP-015 defect.
- To **prove** loop: OAT with PM REWORK (e.g. 039-style pm drift) + logs `pm.repair.started` / selective respawn before BLOCKED.

## Related

- `references/runtime-oat-planning-artifact-alignment.md`
- `references/imp016-wecp-implementation-missing-section.md`
- `references/runtime-fix017-implementation-skeleton-lock.md`
- `references/runtime-fix019-pm-repair-respawn.md`