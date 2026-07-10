# Milestone I — Planning Report

**Status:** COMPLETE
**Date:** 2026-07-10
**Baseline:** Milestone H (commit 7a07b03)

---

## Planning Method

Transformation of I-INVESTIGATION.md gap analysis into executable implementation strategy. Per I-PLAN.md execution order: I-1 → I-4 → I-8 → I-3 → I-2 → I-5 → I-6 → I-7 → I-9 → I-10.

---

## Work Package Strategies

### I-1 Metrics (Foundation)

**Objective:** Runtime-wide metrics collection and aggregation.

**Current State:** `server.js` has `/api/metrics` POST/GET with per-call token tracking (worker, tier, model, tokens, duration). File-based persistence in `.aic/metrics.json`.

**Implementation Strategy:**
- Create `scripts/metrics.sh` with actions: `record`, `query`, `summary`, `export`, `prune`
- Add metrics middleware to `server.js` — auto-record for every API call (latency, status, endpoint)
- Add aggregation: per-worker totals, per-tier totals, error rate, request count
- Add `/api/metrics/summary` endpoint for dashboard consumption
- Storage: extend existing `.aic/metrics.json` (append-only, configurable retention)

**Repository Impact:**
- Create: `scripts/metrics.sh` (~80 lines)
- Modify: `server.js` (metrics middleware + summary endpoint, ~40 lines added)

**Dependencies:** None (foundation WP)

**Completion Criteria:** Metrics recorded for every API call. Summary endpoint returns aggregated data. CLI query works.

---

### I-4 Logging

**Objective:** Structured logging with levels, categories, and searchability.

**Current State:** No logging. `security-governance.sh` writes raw text to `.aic/audit.log`.

**Implementation Strategy:**
- Create `scripts/logger.sh` with actions: `log`, `query`, `tail`, `rotate`, `export`
- Format: JSON lines (`{"ts":"ISO","level":"INFO","cat":"api","msg":"...","data":{}}`)
- Levels: DEBUG, INFO, WARN, ERROR, FATAL
- Categories: api, worker, dispatcher, knowledge, auth, system
- Storage: `.aic/logs/app.log` (rotated daily, configurable retention)
- Add logger to `server.js` — log every request/response
- Trace ID: generate `req-id` per request, propagate to worker calls

**Repository Impact:**
- Create: `scripts/logger.sh` (~70 lines)
- Modify: `server.js` (logger middleware, ~30 lines)

**Dependencies:** None

**Completion Criteria:** All API calls logged with level/category/trace-id. CLI query by level/category works. Log rotation works.

---

### I-8 Configuration Management

**Objective:** Centralized configuration with validation and reload.

**Current State:** `.env` file + `opencode.jsonc` + `/api/config` endpoint. No validation, no reload.

**Implementation Strategy:**
- Create `scripts/config.sh` with actions: `get`, `set`, `validate`, `reload`, `export`
- Hierarchy: defaults → `.env` → environment variables (highest priority)
- Validation: required keys check (MODEL_THINKER, MODEL_CRAFTER, PROVIDER_ID)
- Runtime reload: `POST /api/config/reload` re-reads `.env` without restart
- Worker config: inherit from global, override per-worker via `.env` vars

**Repository Impact:**
- Create: `scripts/config.sh` (~60 lines)
- Modify: `server.js` (config reload endpoint, ~15 lines)

**Dependencies:** None

**Completion Criteria:** Config validation catches missing required keys. Reload works without restart. CLI get/set works.

---

### I-3 Health Management

**Objective:** Component-level health checks with state transitions.

**Current State:** `/health` returns `{ok:true, port, uptime}`.

**Implementation Strategy:**
- Create `scripts/health-check.sh` with actions: `check`, `status`, `history`
- Components: server, auth, knowledge, filesystem, memory
- States: healthy (all OK), degraded (1+ non-critical fail), unhealthy (critical fail)
- Extend `/health` to include component status
- Add `/api/health/components` for detailed breakdown
- Health history: last N checks in `.aic/health.json`
- Readiness: all components pass. Liveness: server process alive.

**Repository Impact:**
- Create: `scripts/health-check.sh` (~70 lines)
- Modify: `server.js` (extended health endpoint, ~25 lines)

**Dependencies:** I-1 (metrics for health data), I-4 (logging for health events)

**Completion Criteria:** Health endpoint returns component states. State transitions logged. CLI check/status works.

---

### I-2 Monitoring

**Objective:** Backend monitoring aggregation (no UI changes).

**Current State:** No monitoring.

**Implementation Strategy:**
- Create `scripts/monitor.sh` with actions: `dashboard`, `alert`, `watch`
- Aggregates: metrics (I-1) + health (I-3) + logs (I-4) into single view
- `/api/monitor` endpoint returns: system health, metrics summary, recent errors, active workers
- Alerting: threshold-based (error rate > 5%, memory > 80%, queue depth > 100)
- No dashboard UI changes — monitoring data available via API only

**Repository Impact:**
- Create: `scripts/monitor.sh` (~60 lines)
- Modify: `server.js` (monitor endpoint, ~20 lines)

**Dependencies:** I-1 (metrics), I-3 (health), I-4 (logging)

**Completion Criteria:** Monitor endpoint returns aggregated system status. Alerts fire on threshold breach. CLI dashboard works.

---

### I-5 Recovery

**Objective:** Auto-recovery from common failures with backup/restore.

**Current State:** `rollback.sh` exists (manual). No auto-recovery.

**Implementation Strategy:**
- Create `scripts/recovery.sh` with actions: `backup`, `restore`, `recover`, `status`
- Backup: snapshot `.aic/` directory (state, knowledge, workers, metrics)
- Restore: from latest or specified backup
- Auto-recover: triggered by health check (I-3) when state is unhealthy
- Recovery steps: 1) stop server, 2) restore from backup, 3) restart server
- Crash recovery: on server start, check for incomplete shutdown, restore last good state
- Retention: configurable (default 5 backups)

**Repository Impact:**
- Create: `scripts/recovery.sh` (~80 lines)
- Modify: `server.js` (startup recovery check, ~15 lines)

**Dependencies:** I-3 (health triggers recovery)

**Completion Criteria:** Backup creates snapshot. Restore works from backup. Auto-recovery triggers on unhealthy state. Startup recovery handles crash.

---

### I-6 Queue Management

**Objective:** File-based task queue with priority and persistence.

**Current State:** Tasks started directly via `/api/task-start`. No queue.

**Implementation Strategy:**
- Create `scripts/queue.sh` with actions: `enqueue`, `dequeue`, `status`, `list`, `retry`
- Priority: high (1), normal (2), low (3)
- Storage: `.aic/queue.json` (persistent)
- Integration: `/api/queue/enqueue` and `/api/queue/status` endpoints
- Dispatcher integration: phase-runner checks queue before starting tasks
- Retry: configurable max retries (default 3), exponential backoff
- Dead letter: tasks exceeding max retries moved to `.aic/queue-dead.json`

**Repository Impact:**
- Create: `scripts/queue.sh` (~70 lines)
- Modify: `server.js` (queue endpoints, ~30 lines)

**Dependencies:** I-1 (queue metrics)

**Completion Criteria:** Tasks enqueue/dequeue with priority. Queue persists across restarts. Retry works. CLI status/list works.

---

### I-7 Security Hardening

**Objective:** Extend existing auth with audit, validation, and prompt signing.

**Current State:** API key auth, rate limiter, scope-check, audit-log.

**Implementation Strategy:**
- Extend `scripts/security-governance.sh`: add `validate-input`, `sign-prompt`, `rotate-key`
- Audit improvement: structured JSON audit log (uses I-4 logger)
- Input validation: sanitize all API inputs (prevent injection)
- Prompt signing: HMAC of prompt content for integrity verification
- Key rotation: generate new key, invalidate old key gracefully
- CORS: configurable allowed origins

**Repository Impact:**
- Modify: `scripts/security-governance.sh` (~50 lines added)
- Modify: `server.js` (input validation, CORS, ~25 lines)

**Dependencies:** I-4 (structured audit logging)

**Completion Criteria:** Audit log is structured JSON. Input validation rejects malformed requests. Prompt signing works. Key rotation works.

---

### I-9 Performance

**Objective:** Optimize critical paths without architectural redesign.

**Current State:** Synchronous file I/O in server.js. No caching.

**Implementation Strategy:**
- Convert sync I/O to async (fs.promises) in server.js hot paths
- Add in-memory cache for frequently accessed files (state.json, registry.json)
- Cache invalidation: file mtime check or explicit invalidation on write
- Metrics endpoint: pre-aggregate summary on write (not on read)
- No new files — optimization is in existing code

**Repository Impact:**
- Modify: `server.js` (async I/O, caching, ~40 lines)

**Dependencies:** I-1 (metrics to measure improvement)

**Completion Criteria:** No sync I/O in request handlers. Cache hit rate measurable. API latency improved.

---

### I-10 Scalability

**Objective:** Prepare for horizontal scaling within single-process constraint.

**Current State:** Single-process Node.js server.

**Implementation Strategy:**
- Document scaling strategy in `references/scalability-pattern.md`
- Add Node.js cluster mode to server.js (optional, behind flag)
- Prepare for multi-instance: ensure state is file-based (not in-memory)
- Health endpoint includes instance ID for load balancer awareness
- No distributed execution — that's Milestone J

**Repository Impact:**
- Modify: `server.js` (cluster mode flag, ~20 lines)
- Create: `references/scalability-pattern.md`

**Dependencies:** I-1 (metrics), I-3 (health)

**Completion Criteria:** Cluster mode starts multiple workers. State persists across instances. Documentation complete.

---

## Repository Impact Summary

| Action | Files | Lines |
|--------|-------|-------|
| Create | `scripts/metrics.sh` | ~80 |
| Create | `scripts/logger.sh` | ~70 |
| Create | `scripts/config.sh` | ~60 |
| Create | `scripts/health-check.sh` | ~70 |
| Create | `scripts/monitor.sh` | ~60 |
| Create | `scripts/recovery.sh` | ~80 |
| Create | `scripts/queue.sh` | ~70 |
| Create | `references/scalability-pattern.md` | ~50 |
| Modify | `server.js` | ~260 lines added |
| Modify | `scripts/security-governance.sh` | ~50 lines added |
| **Total new** | **8 files** | **~540 lines** |
| **Total modified** | **2 files** | **~310 lines** |
| **Net addition** | | **~850 lines** |

---

## Runtime OAT Strategy

Execute one real engineering task through the full pipeline with production operations active.

**Validation:**
1. Start server → health checks pass → monitoring shows healthy
2. Enqueue task via queue API → dequeue → execute via spawn-worker
3. Metrics collected for every API call → summary endpoint returns data
4. Logger records all events → query by level/category works
5. Inject failure (kill worker process) → health detects unhealthy → recovery triggers
6. Config reload works without restart
7. Security audit log captures all events
8. Performance: measurable latency improvement from caching

**Evidence:** API responses, log files, metrics data, health history, recovery logs.

---

## Verification Strategy

- Syntax: `bash -n` for all new scripts
- API: curl all new endpoints
- Regression: existing 35 scripts pass syntax + functional tests
- Integration: metrics flows through logger → monitor → health → recovery chain
- One verification after all 10 WPs complete

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| server.js regression | High | Regression test after every WP |
| Performance overhead | Medium | Async metrics, sampling, configurable levels |
| Config migration | Low | Backward-compatible defaults |
| Recovery false positives | Low | Configurable thresholds |
| Scope creep | Low | Strict WP boundaries |

---

## Success Criteria

- All 10 WPs implemented
- Metrics collected for every API call
- Health checks component-level
- Structured logging with searchability
- Auto-recovery from common failures
- Queue with priority and persistence
- Security audit trail
- Config validation and reload
- Performance improved (async I/O + caching)
- Verification PASS
- Runtime OAT PASS

---

## Exit Criteria

Milestone I may proceed to Closeout only after:
- All 10 WPs implemented
- Verification PASS
- Runtime OAT PASS
- PM Final Review PASS

---

## Planning Compliance Matrix

| I-PLAN Requirement | Addressed | Section |
|-------------------|-----------|---------|
| Runtime metrics | ✅ | I-1 |
| Dispatcher metrics | ✅ | I-1 |
| Worker metrics | ✅ | I-1 |
| Queue metrics | ✅ | I-1 |
| Knowledge metrics | ✅ | I-1 |
| Monitoring architecture | ✅ | I-2 |
| Health model | ✅ | I-3 |
| Health transitions | ✅ | I-3 |
| Structured logging | ✅ | I-4 |
| Log categories | ✅ | I-4 |
| Runtime recovery | ✅ | I-5 |
| Queue model | ✅ | I-6 |
| Priority model | ✅ | I-6 |
| Security hardening | ✅ | I-7 |
| Config hierarchy | ✅ | I-8 |
| Performance optimization | ✅ | I-9 |
| Scalability prep | ✅ | I-10 |
| Runtime OAT strategy | ✅ | OAT section |
| Verification strategy | ✅ | Verification section |

---

## Baseline Delta

| Capability | Milestone H | Milestone I (Expected) |
|-----------|-------------|----------------------|
| Scripts | 35 | 43 (+8 new) |
| Lines | 3,832 | ~4,680 (+850) |
| Metrics | Per-call tokens | Runtime-wide aggregation |
| Monitoring | None | Backend aggregation + alerts |
| Health | ok/port/uptime | Component checks + transitions |
| Logging | None | Structured JSON + levels + search |
| Recovery | None | Auto-recovery + backup/restore |
| Queue | None | Priority queue + persistence |
| Security | API key + rate limit | + audit + validation + signing |
| Config | .env + /api/config | Centralized + validation + reload |
| Performance | Sync I/O | Async I/O + caching |
| Scalability | Single-process | Cluster mode (optional) |

---

## Milestone I Planning = COMPLETE

Ready for Implementation.
