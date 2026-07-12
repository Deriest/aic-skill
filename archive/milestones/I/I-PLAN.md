# Milestone I — Production Operations Plan

**Status:** PLANNED
**Date:** 2026-07-10

---

## Objective

Add production-grade monitoring, metrics, health checks, logging, recovery, and security to the AIC platform.

### Backup Strategy (included in I-5)

Automated backup of state, artifacts, and configuration. Configurable schedule.

### Restore Strategy (included in I-5)

Point-in-time restore from backup. Tested recovery procedures.

### Disaster Recovery (included in I-5)

Recovery from complete failure. State reconstruction from artifacts.

### Observability (included in I-2)

Metrics, logs, traces unified into single observability view.

### Runtime Tracing (included in I-4)

Request tracing across workers and sub-workers. Distributed trace ID.

---

## Implementation Strategy

Current state: Basic server with API endpoints. Partial metrics (token tracking), partial health (ok/port/uptime), partial auth (API key + rate limiter). No structured logging, no monitoring, no recovery.

Gap: Not production-ready. Limited observability, no recovery, incomplete security.

Solution: Add metrics aggregation, structured logger, monitoring endpoint, health checks, recovery module, queue manager, security hardening, config management, performance optimization.

---

## Work Package Execution Order

| Order | WP | Status | Rationale |
|-------|-----|--------|----------|
| 1 | I-1 Metrics | PARTIAL → COMPLETE | Foundation — need data for everything else |
| 2 | I-4 Logging | NOT IMPL → COMPLETE | Structured logs for debugging |
| 3 | I-8 Configuration | PARTIAL → COMPLETE | Centralized config for all components |
| 4 | I-3 Health Checks | PARTIAL → COMPLETE | Automated component verification |
| 5 | I-2 Monitoring | NOT IMPL → COMPLETE | Dashboard using metrics + health data |
| 6 | I-5 Recovery | NOT IMPL → COMPLETE | Auto-recovery using health checks |
| 7 | I-6 Queue Management | NOT IMPL → COMPLETE | Task queue with priority |
| 8 | I-7 Security | PARTIAL → COMPLETE | Auth hardening, audit, validation |
| 9 | I-9 Performance | NOT IMPL → COMPLETE | Optimize critical paths |
| 10 | I-10 Scalability | NOT IMPL → COMPLETE | Horizontal scaling prep |

---

## Work Package Details

### I-1 Metrics

**Objective:** Runtime-wide metrics collection and aggregation.

**Implementation:**
- Create `scripts/metrics.sh` (~80 lines): record, query, summary, export, prune
- Modify `server.js`: auto-record middleware for every API call (latency, status, endpoint)
- Add `/api/metrics/summary` endpoint for aggregated data
- Storage: extend existing `.aic/metrics.json`

**Dependencies:** None

**Completion:** Metrics recorded for every API call. Summary endpoint returns aggregated data.

---

### I-4 Logging

**Objective:** Structured logging with levels, categories, and searchability.

**Implementation:**
- Create `scripts/logger.sh` (~70 lines): log, query, tail, rotate, export
- Format: JSON lines (`{"ts":"ISO","level":"INFO","cat":"api","msg":"...","data":{}}`)
- Levels: DEBUG, INFO, WARN, ERROR, FATAL
- Categories: api, worker, dispatcher, knowledge, auth, system
- Add trace ID per request
- Storage: `.aic/logs/app.log` (rotated daily)

**Dependencies:** None

**Completion:** All API calls logged. CLI query by level/category works.

---

### I-8 Configuration Management

**Objective:** Centralized configuration with validation and reload.

**Implementation:**
- Create `scripts/config.sh` (~60 lines): get, set, validate, reload, export
- Hierarchy: defaults → `.env` → environment variables
- Validation: required keys check
- `POST /api/config/reload` endpoint

**Dependencies:** None

**Completion:** Config validation catches missing keys. Reload works without restart.

---

### I-3 Health Management

**Objective:** Component-level health checks with state transitions.

**Implementation:**
- Create `scripts/health-check.sh` (~70 lines): check, status, history
- Components: server, auth, knowledge, filesystem, memory
- States: healthy, degraded, unhealthy
- Extend `/health` with component status
- `/api/health/components` for detailed breakdown

**Dependencies:** I-1 (metrics), I-4 (logging)

**Completion:** Health endpoint returns component states. State transitions logged.

---

### I-2 Monitoring

**Objective:** Backend monitoring aggregation (no UI changes).

**Implementation:**
- Create `scripts/monitor.sh` (~60 lines): dashboard, alert, watch
- `/api/monitor` endpoint: system health, metrics summary, recent errors, active workers
- Alerting: threshold-based (error rate, memory, queue depth)
- No dashboard UI changes

**Dependencies:** I-1 (metrics), I-3 (health), I-4 (logging)

**Completion:** Monitor endpoint returns aggregated status. Alerts fire on threshold breach.

---

### I-5 Recovery

**Objective:** Auto-recovery from common failures with backup/restore.

**Implementation:**
- Create `scripts/recovery.sh` (~80 lines): backup, restore, recover, status
- Backup: snapshot `.aic/` directory
- Auto-recover: triggered by health check (I-3)
- Crash recovery: on server start, check for incomplete shutdown
- Retention: configurable (default 5 backups)

**Dependencies:** I-3 (health triggers)

**Completion:** Backup/restore works. Auto-recovery triggers on unhealthy state.

---

### I-6 Queue Management

**Objective:** File-based task queue with priority and persistence.

**Implementation:**
- Create `scripts/queue.sh` (~70 lines): enqueue, dequeue, status, list, retry
- Priority: high (1), normal (2), low (3)
- Storage: `.aic/queue.json`
- Retry: configurable max retries, exponential backoff
- Dead letter: `.aic/queue-dead.json`

**Dependencies:** I-1 (queue metrics)

**Completion:** Tasks enqueue/dequeue with priority. Queue persists across restarts.

---

### I-7 Security Hardening

**Objective:** Extend existing auth with audit, validation, and prompt signing.

**Implementation:**
- Extend `scripts/security-governance.sh` (~50 lines): validate-input, sign-prompt, rotate-key
- Structured JSON audit log (uses I-4 logger)
- Input validation: sanitize all API inputs
- Prompt signing: HMAC integrity

**Dependencies:** I-4 (structured audit)

**Completion:** Audit log structured. Input validation works. Prompt signing works.

---

### I-9 Performance

**Objective:** Optimize critical paths without architectural redesign.

**Implementation:**
- Convert sync I/O to async (fs.promises) in server.js
- In-memory cache for frequently accessed files
- Pre-aggregate metrics summary on write

**Dependencies:** I-1 (metrics to measure)

**Completion:** No sync I/O in request handlers. Cache hit rate measurable.

---

### I-10 Scalability

**Objective:** Prepare for horizontal scaling within single-process constraint.

**Implementation:**
- Node.js cluster mode (optional, behind flag)
- Ensure state is file-based (not in-memory)
- Health endpoint includes instance ID
- Document scaling strategy

**Dependencies:** I-1 (metrics), I-3 (health)

**Completion:** Cluster mode starts multiple workers. Documentation complete.

---

## Repository Modification Strategy

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
| Modify | `server.js` | ~260 added |
| Modify | `scripts/security-governance.sh` | ~50 added |
| **Total new** | **8 files** | **~540** |
| **Total modified** | **2 files** | **~310** |
| **Net addition** | | **~850** |

---

## Runtime Strategy

- server.js enhanced with metrics middleware, structured logging, health endpoints
- Metrics collected for every API call
- Health checks run periodically
- Recovery triggered on failure detection

---

## Dashboard Strategy

No UI changes. Monitoring data available via API only.

---

## Verification Strategy

One verification after all 10 WPs complete. Validates:
- Metrics collected for all operations
- Monitoring shows system health
- Health checks automated
- Logs structured and searchable
- Recovery automatic for common failures
- Security enforced at boundaries
- Queue operational with priority

---

## OAT Strategy

One OAT after Verification. Executes:
- System under load → metrics collected → monitoring shows health → failure detected → recovery triggered → security enforced

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| server.js regression | Regression test after every WP |
| Performance overhead | Async metrics, sampling |
| Config migration | Backward-compatible defaults |
| Recovery false positives | Configurable thresholds |
| Scope creep | Strict WP boundaries |

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

- All 10 WPs implemented
- Verification PASS
- Runtime OAT PASS
- PM Final Review PASS
- Closeout complete
