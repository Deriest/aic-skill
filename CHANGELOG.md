# AIC Changelog

All notable releases and historical task entries.

## [1.0.0] — Runtime Baseline — 2026-07-14

First production baseline (`c6faeac`). Engineering complete; no further runtime stabilization work in this line.

### Runtime Stabilization

- Engine FSM, phase barriers, PM review, recovery, and guarded lifecycle hardened through milestone FIX-008 → FIX-023 (including token/cost metrics and dashboard observability alignment).
- Runtime gate, checkpoint/task isolation, WECP orchestration, and OAT verification patterns documented in active `references/`.

### Worker Reliability

- IMP-024 milestone: extraction hardening (no raw NDJSON in reports), session reliability and JSON payload safety, trivial-task classification and noop handling.

### Repository Finalization

- WP-101 / WP-102: archive normalization, tracked FIX/IMP lineage refs, `.env.example` and `PROVIDER` config consistency, hardened `.gitignore`, canonical `templates/phase-contracts/`, generated knowledge ledger policy, `docs/assets/` screenshots, synchronized guides and architecture docs.

---

## Earlier history

Task-level entries from pre-baseline development:

## 🔧 Fix context-gather backtick crash
- **Date:** 2026-07-08
- **Type:** bug-infra
- **Duration:** 5m
- **Files changed:** 3 (scripts/spawn-worker.sh, SKILL.md, CHANGELOG.md)
- **Root cause:** spawn-worker.sh used `execSync` (shell-invoking) in its Node.js wrapper to run opencode. When context-gather.sh gathered source files containing backticks, they were interpreted as shell command substitutions, causing `Syntax error: end of file unexpected`.
- **Fix:** Replaced `execSync` with `execFileSync` — passes arguments as an array directly to the process, bypassing shell interpretation entirely. No need to sanitize context output.

## ✨ Verify Task
- **Date:** 2026-07-07 12:43
- **Type:** feature
- **Duration:** 1m
- **Files changed:** 2

## 🗣️ Dispatcher Role & Communication Clarification
- **Date:** 2026-07-07 18:45
- **Type:** feature
- **Duration:** 15m
- **Files changed:** 1 (SKILL.md)
- **Issue:** The PM was described as the "translator from user", which implied PM talked to the user. User requested natural language directly to the Dispatcher, and for the Dispatcher to be the sole communicator.
- **Fix:**
  1. Updated Dispatcher prompt (line 15) to explicitly state it is the ONLY user-facing entity.
  2. Added "Dispatcher Communication Protocol" (greetings, clarification, auto-language switching to Indonesian).
  3. Redefined PM as a "backend spec-writer" that ONLY reads the Dispatcher's task handoff block and outputs `requirements.json`.
  4. Updated "How This Works" to integrate the 5-phase lifecycle directly into the Dispatcher's orchestration steps.
  5. Removed redundant lifecycle definition block.

## 🔧 Workflow Lifecycle Enforcement (5-Phase Outer Wrapper)
- **Date:** 2026-07-07 18:36
- **Type:** bug
- **Duration:** 30m
- **Files changed:** 1 (scripts/server.js + SKILL.md)
- **Issue:** Dispatcher was skipping the 5-phase task lifecycle (Investigate→Planning→Implementation→Documentation→Closeout) and directly firing `phase_start: "PM (Translation)"` then `backend: working` while PM was still running. User complaint: "suka langsung di tembak ke front end padahal workflow sudah di buat".
- **Root cause:** `server.js` had no enforcement of lifecycle ordering. `state.phase` was a free string. `task-start` set `phase: 'Planning'` and `workers.pm: working` immediately, before any Investigate ran.
- **Fix:**
  1. Added `LIFECYCLE_PHASES` and `LIFECYCLE_ALLOWED_WORKERS` constants.
  2. `task-start` now always starts at `Investigate`, resets all workers to `idle`, does NOT auto-spawn PM.
  3. `agent-status` (status=working) now guards: rejects with 403 if worker not allowed in current lifecycle phase.
  4. `phase-start` accepts new `lifecyclePhase` field with backward-transition rejection.
  5. `phase-advance` stops at Closeout (no wrap-around).
  6. `reconcileLifecycle()` on boot: derives lifecycle from working workers if state.json is from pre-patch run.
  7. SKILL.md: new "Task Lifecycle (5-Phase Outer Wrapper)" section.
- **Invariant:** workflow 6-phase Feature/Bug/etc. (PM→Architect→Engineers→QA→Governor) UNCHANGED. Lifecycle is outer wrapper; workflow is inner.
- **Tests passing:** guard rejects engineer in Investigate/Planning, accepts in Implementation; backward transitions rejected; phase-advance stops at Closeout; task-start starts at Investigate.

