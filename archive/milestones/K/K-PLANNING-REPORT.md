# Milestone K — Planning Report

**Status:** COMPLETE
**Date:** 2026-07-10

---

## Repository Evidence Correction

**K-6 Pipeline Resume EXISTS.** RP-003 Runtime Resume confirmed: `phase-runner.sh` + `pipeline-orchestrator.sh` can resume from incomplete phase. Do NOT re-implement.

Remaining K-6 gaps: provider timeout retry, worker crash recovery, automatic retry policy.

---

## Architecture Decisions

### AD-K1: Graceful Shutdown
**Decision:** Add SIGTERM/SIGINT handlers to server.js.
**Rationale:** Standard Node.js pattern. Closes connections, saves state, exits cleanly.
**Implementation:** 15 lines in server.js (`process.on('SIGTERM', ...)`)

### AD-K2: Dashboard Auto-Refresh
**Decision:** Add polling (setInterval) to dashboard.js.
**Rationale:** Simplest approach. No WebSocket/SSE complexity.
**Implementation:** 20 lines in dashboard JS. Poll /api/status every 5s.

### AD-K3: Extended Audit Events
**Decision:** Add audit calls in server.js at key lifecycle points.
**Rationale:** Reuse existing audit.log + /api/audit. Add events for: worker-spawn, phase-start, phase-complete, project-select, pipeline-start, pipeline-complete.
**Implementation:** ~30 lines in server.js (append to audit.log at each event)

### AD-K4: RBAC Middleware
**Decision:** Add permission check middleware before each endpoint handler.
**Rationale:** Fail-closed default. Check role against endpoint permission matrix.
**Implementation:** 40 lines in server.js (middleware function + route-level checks)

### AD-K5: Stress Testing
**Decision:** Ad-hoc shell scripts for concurrent task testing.
**Rationale:** No load testing framework needed at this scale. Shell scripts sufficient.
**Implementation:** Create `scripts/stress-test.sh`

### AD-K6: Provider Timeout Retry
**Decision:** Add retry with exponential backoff in spawn-worker.sh.
**Rationale:** Single retry covers transient provider timeouts.
**Implementation:** 10 lines in spawn-worker.sh (retry wrapper)

### AD-K7: Runtime Resource Monitoring
**Decision:** Add memory/CPU tracking to /api/metrics/summary.
**Rationale:** Reuse existing metrics endpoint. Node.js `process.memoryUsage()` + `os.cpus()`.
**Implementation:** 15 lines in server.js

### AD-K8: Operations Runbook
**Decision:** Create `references/operations-runbook.md`.
**Rationale:** Documentation for production deployment procedures.
**Implementation:** New file (~100 lines)

---

## Work Package Plans

### K-1 Runtime Stability

**Objective:** Clean process lifecycle management.

**Repository Impact:**
- MODIFY: `scripts/server.js` (+30 lines: SIGTERM/SIGINT handlers, orphan cleanup)

**Implementation:**
1. SIGTERM handler: save state, close server, exit 0
2. SIGINT handler: same as SIGTERM
3. Startup cleanup: check for stale PID file, kill orphan if exists
4. Worker cleanup on startup: reset all workers to idle

**Completion Criteria:**
- `kill -TERM <pid>` exits cleanly with state saved
- No orphan processes after crash simulation
- Server restarts clean without stale state

---

### K-2 Dashboard & Observability

**Objective:** Live runtime visibility without redesign.

**Repository Impact:**
- MODIFY: `dashboard/dist/` (+30 lines: auto-refresh, pipeline visibility)

**Implementation:**
1. Add `setInterval` polling `/api/status` every 5 seconds
2. Add `/api/pipeline/status` display (current phase, task progress)
3. Add worker transition indicators (idle→working→complete colors)
4. Add multi-project display (current project name)

**Completion Criteria:**
- Dashboard auto-refreshes without manual reload
- Worker state changes visible in real-time
- Current phase displayed during pipeline execution

---

### K-3 Extended Audit

**Objective:** Engineering traceability via existing audit platform.

**Repository Impact:**
- MODIFY: `scripts/server.js` (+40 lines: audit event logging at lifecycle points)

**Implementation:**
1. Log events: `WORKER_SPAWN`, `PHASE_START`, `PHASE_COMPLETE`, `PIPELINE_START`, `PIPELINE_COMPLETE`, `PROJECT_SELECT`
2. Format: `[timestamp] EVENT_TYPE key=value key=value`
3. Write to existing `.aic/audit.log`
4. Query via existing `/api/audit` endpoint

**Completion Criteria:**
- Pipeline execution generates audit entries for each phase
- Worker spawn logged with worker name and tier
- Query returns engineering events alongside security events

---

### K-4 RBAC Hardening

**Objective:** Enforce existing RBAC model on API endpoints.

**Repository Impact:**
- MODIFY: `scripts/server.js` (+50 lines: RBAC middleware)

**Implementation:**
1. Define endpoint→role matrix:
   - `admin`: all endpoints
   - `lead`: project.*, worker.*, audit.*, knowledge.*
   - `member`: task.*, artifact.*, knowledge.read
   - `viewer`: status.read, metrics.read, health.read
2. Add middleware: extract role from API key → check against matrix → 403 if denied
3. Fail-closed: unknown role = denied
4. Public endpoints (no auth): `/health`, dashboard static files

**Completion Criteria:**
- Viewer role: GET /api/status works, POST /api/task-start returns 403
- Admin role: all endpoints accessible
- Unknown role: all endpoints return 403

---

### K-5 Stress & Load Testing

**Objective:** Validate stability under concurrent load.

**Repository Impact:**
- CREATE: `scripts/stress-test.sh` (~80 lines)

**Implementation:**
1. Concurrent task test: spawn 3 tasks simultaneously, verify all complete
2. Queue growth test: enqueue 10 items, verify dequeue order
3. Provider timeout test: mock slow provider, verify retry handles it
4. Restart under load: kill server during task, restart, verify state consistent

**Completion Criteria:**
- 3 concurrent tasks complete without data corruption
- Queue handles 10+ items without loss
- Provider timeout triggers retry (after K-6)
- Server restart during task preserves state

---

### K-6 Recovery & Resilience

**Objective:** Automatic recovery from common failures.

**Repository Impact:**
- MODIFY: `scripts/spawn-worker.sh` (+15 lines: retry wrapper)

**Implementation:**
1. Provider timeout retry: retry once with exponential backoff (5s, 10s)
2. Worker crash recovery: detect non-zero exit, log error, continue with remaining workers
3. Queue recovery: verify queue.json persistence on restart (already works via queue.sh)
4. Pipeline resume: ALREADY EXISTS (RP-003). No changes needed.

**Completion Criteria:**
- Provider timeout triggers 1 retry before failure
- Worker crash doesn't crash server
- Queue persists across restart
- Pipeline can resume from last completed phase

---

### K-7 Performance & Resource Usage

**Objective:** Runtime resource visibility.

**Repository Impact:**
- MODIFY: `scripts/server.js` (+20 lines: memory/CPU in metrics)

**Implementation:**
1. Add `process.memoryUsage()` to /api/metrics/summary response
2. Add `os.cpus()` usage to /api/metrics/summary response
3. Add uptime to /api/metrics/summary (already in /health)
4. Log warning if memory > 500MB threshold

**Completion Criteria:**
- /api/metrics/summary includes `memory` and `cpu` fields
- Memory threshold warning logged when exceeded

---

### K-8 Production Readiness

**Objective:** Operational procedures for production deployment.

**Repository Impact:**
- CREATE: `references/operations-runbook.md` (~100 lines)
- MODIFY: `scripts/server.js` (+10 lines: log rotation check)

**Implementation:**
1. Operations runbook: startup, shutdown, backup, restore, upgrade, troubleshooting procedures
2. Log rotation: check audit.log size on startup, archive if > 10MB
3. Production checklist: pre-deploy validation script
4. Health check integration: deploy.sh validate uses /health endpoint

**Completion Criteria:**
- Operations runbook covers all deployment procedures
- Log rotation prevents unbounded growth
- deploy.sh validate passes all checks

---

## Repository Impact Summary

| Action | Files | Est. Lines |
|--------|-------|-----------|
| MODIFY | server.js | +165 |
| MODIFY | spawn-worker.sh | +15 |
| CREATE | stress-test.sh | 80 |
| CREATE | references/operations-runbook.md | 100 |

**Total: +1 new script, +1 new doc, +2 modified files, ~360 lines**

---

## Verification Strategy

One milestone-level verification:
1. Graceful shutdown: kill -TERM, verify clean exit
2. Dashboard: verify auto-refresh (curl + check interval)
3. Audit: run pipeline, verify engineering events in audit.log
4. RBAC: test viewer vs admin access
5. Stress: run stress-test.sh
6. Recovery: kill server during task, restart, verify state
7. Performance: check /api/metrics/summary for memory/cpu
8. Production: run deploy.sh validate

---

## Runtime OAT Strategy

One real Runtime OAT:
1. Start server, verify all capabilities
2. Run pipeline with graceful shutdown mid-phase → restart → verify resume
3. Verify dashboard shows live updates during execution
4. Verify audit log contains engineering events
5. Verify RBAC blocks unauthorized access
6. Verify metrics include memory/CPU
7. Run deploy.sh validate

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| RBAC middleware breaks existing auth | High | Fail-open for admin, test thoroughly |
| Graceful shutdown loses in-flight workers | Medium | Wait for workers before exit |
| Dashboard polling increases load | Low | 5s interval is negligible |
| Log rotation may lose entries | Low | Archive, don't delete |

---

## Boundary Validation

K does NOT introduce:
- ❌ New runtime capabilities (no new endpoints except monitoring additions)
- ❌ New enterprise features (stabilizes existing J features only)
- ❌ New worker intelligence (no G changes)
- ❌ New dispatcher intelligence (no F changes)
- ❌ New knowledge capabilities (audit extension only)

**Boundary: CLEAN. K is stabilization only.**

---

## Final Decision

**Milestone K Planning = COMPLETE**

Ready for Implementation.
