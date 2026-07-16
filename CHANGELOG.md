# AIC Changelog

All notable releases and historical task entries.

## [3.4.1] — Production Stabilization Patch — 2026-07-16

### Release Type: PATCH

Production stabilization release fixing 7 defects across critical pipeline,
worker execution, RBAC, authentication, and lease lifecycle subsystems.

### Fixed (Critical)
- **D-01:** `/api/metrics` crashed on every request — `server.js` rebuilt `req.url` as plain object via spread, losing the `searchParams` getter. Fixed: assign URL object directly.
- **D-07:** Pipeline failed silently when project directory didn't exist — `pipeline-orchestrator.sh` never created it. Fixed: `mkdir -p` before task-start.
- **D-12:** All workers failed artifact extraction — `spawn-worker.sh` used `printf "%b"` in awk, which mawk doesn't support. Fixed: `printf "%s"` (3 locations). Root cause blocking every pipeline from reaching COMPLETE.

### Fixed (High/Medium)
- **D-02:** RBAC blocked all admin endpoints — `server.js` used `config.loadCredentials()` (reads `credentials.json`, no role field) instead of `auth.loadCredentials()` (reads `auth.json` with role). Fixed: use `auth.loadCredentials()`. Added `role: "admin"` to `auth.json`.
- **D-03:** `/api/tasks` accessible without authentication. Fixed: removed from public API allowlist.
- **D-04:** `/api/version` returned `3.1.3`. Fixed: version string updated to match baseline.
- **D-08:** Leases from cancelled/completed tasks accumulated forever. Fixed: prune non-current-task leases after each `finishLease`.

### Validation Evidence
- 2 complete real pipelines reached COMPLETE (TASK-007, TASK-008)
- All 6 workers (pm, architect, research, backend, frontend, qa) executed successfully
- PM Review: PASS on both runs
- Unit tests: 39/39 PASS
- Self-test: 24/24 PASS
- Syntax validation: ALL OK
- No regressions introduced

### Known Limitations
- D-10 (LOW): Event bus in-memory only, no disk persistence. Non-blocking.

---

## [3.4.0] — Production Stabilization — 2026-07-16

### Fixed (Critical)
- **D-01:** `/api/metrics` crashed on every request — `server.js` rebuilt `req.url` as plain object via spread, losing the `searchParams` getter. Fixed: assign URL object directly.
- **D-07:** Pipeline failed silently when project directory didn't exist — `pipeline-orchestrator.sh` never created it. Fixed: `mkdir -p` before task-start.
- **D-12:** All workers failed artifact extraction — `spawn-worker.sh` used `printf "%b"` in awk, which mawk doesn't support. Fixed: `printf "%s"` (3 locations). This was the root cause blocking every pipeline from reaching COMPLETE.

### Fixed (High/Medium)
- **D-02:** RBAC blocked all admin endpoints — `server.js` used `config.loadCredentials()` (reads `credentials.json`, no role field) instead of `auth.loadCredentials()` (reads `auth.json` with role). Fixed: use `auth.loadCredentials()`. Added `role: "admin"` to `auth.json`.
- **D-03:** `/api/tasks` and `/api/tasks/:id` were accessible without authentication. Fixed: removed from public API allowlist.
- **D-04:** `/api/version` returned `3.1.3` instead of `3.4.0`. Fixed: hardcoded version in `public-routes.js`.
- **D-08:** Leases from cancelled/completed tasks accumulated in state forever (38+ stale). Fixed: prune non-current-task leases after each `finishLease`.

### Validation
- 2 complete real pipelines reached COMPLETE (TASK-007, TASK-008)
- All 6 workers (pm, architect, research, backend, frontend, qa) executed successfully
- PM Review: PASS on both runs
- Unit tests: 39/39 PASS
- Self-test: 24/24 PASS

---

## [3.2.0] — Runtime Observability Platform (WP-80) — 2026-07-15

### Added
- **Runtime Observability Layer:** Read-only service aggregating engine state, checkpoints, filesystem, and events into a unified snapshot.
- **`GET /api/observability/runtime`** — Canonical runtime snapshot (engine, workers, leases, pipeline, knowledge, health, metrics, recent events).
- **`GET /api/observability/workers/:id`** — Single worker detail with lease history.
- **`GET /api/observability/events`** — Paginated event timeline with filtering (`?limit=&type=&taskId=&phase=`).
- **`GET /api/observability/pipeline/:taskId`** — Historical pipeline state for a specific task.
- **`GET /api/observability/knowledge/:taskId`** — Knowledge entry for a specific task.
- **`GET /api/observability/tasks/:taskId/artifacts`** — Artifact listing for a task.
- **Append-only JSONL Event Store** (`scripts/engine/event-store.js`) with rotation (10MB) and corruption recovery.

### Improved
- Read-only Observability Service (`scripts/engine/observability.js`) with TTL-based filesystem caching (5s).
- Event bus (`scripts/engine/events.js`) now supports persistence hook for JSONL event store.
- Dashboard backward compatibility preserved — existing `/api/status` endpoint unchanged.
- System Validation integration — SV-007 through SV-017 can now consume observability APIs.

### Fixed
- Event store rotation no longer runs `statSync` on every append (optimized to every 100 appends).
- URL parsing in observability handler no longer uses hardcoded localhost.
- Health and metrics filesystem reads now use TTL cache instead of raw `readFileSync` per request.

### Compatibility
- **No breaking API changes.**
- Existing endpoints remain fully compatible: `/health`, `/api/status`, `/api/metrics`, `/api/task-start`, `/api/runtime/intent`.
- New functionality available under `/api/observability/*`.

---


## [3.1.3] — Intelligent Intake (EPIC-201) — 2026-07-14

**AIC v3.1.3** (global release). Dispatcher pre-pipeline intake: four modes, deterministic requirement completeness, project-scoped state, domain checklists, and Option C (LLM-assisted clarification question wording only).

### Intake (EPIC-201)

- **WP-201 / WP-202:** Conversation, Quick, Discovery, From PRD routing; PASS/FAIL checklists; PRD intent resolution; approval gate before `task.start` for net-new scope.
- **Phase 2:** Context engine (chat + PRD file + lightweight repo heuristics); `.aic/intake/session.json` state; ten domain YAML packs under `templates/intake-checklists/`.
- **Option C:** Structured `llm_question_input` / `--discovery-payload`; prompt template `templates/intake-discovery-question-prompt.md`; validator remains authoritative (no LLM routing in scripts).
- **Verify:** `scripts/verify-wp202-intake.sh`, `verify-intake-phase2.sh`, `verify-option-c-intake.sh`.
- **Docs:** `references/epic-201-wp201-intake-routing-architecture.md`, `references/intake-routing-epic201.md`, closeout/verification refs under `references/epic-201-*`.
- **Runtime:** Engine, FSM, Barrier, WECP, workers, dashboard unchanged.

---

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

