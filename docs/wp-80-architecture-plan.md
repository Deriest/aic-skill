# WP-80 — Runtime Observability Platform: Architecture Plan v2

Version: 2.0 (Refinement A + B applied)
Status: PHASE 2 APPROVED — READY FOR IMPLEMENTATION

---

## Refinement A — Final Public API Surface

### Design Rule

One canonical snapshot endpoint. Additional endpoints only when they provide value the snapshot cannot.

### Final API Inventory

| Endpoint | Verdict | Justification |
|----------|---------|---------------|
| `GET /api/observability/runtime` | **KEEP** | Canonical snapshot. Contains EVERYTHING: engine, workers, task, pipeline, leases, knowledge, metrics, recent events, health. Single source of truth for all consumers. |
| `GET /api/observability/workers/:id` | **KEEP** | Provides per-worker detail (full lease history, execution logs) that would bloat the snapshot if included for all 15 workers. Consumers: debugging, dashboard drill-down. |
| `GET /api/observability/events` | **KEEP** | Provides paginated event history with filtering (`?limit=&type=&taskId=&phase=`). Snapshot only includes last N events. Full history requires dedicated endpoint. Consumers: debugging, audit, validation. |
| `GET /api/observability/workers` | **MERGE into runtime** | Snapshot already includes all worker statuses. Dedicated endpoint adds no value. |
| `GET /api/observability/leases` | **MERGE into runtime** | Snapshot already includes lease registry. Dedicated endpoint adds no value. |
| `GET /api/observability/pipeline` | **MERGE into runtime** | Snapshot already includes pipeline state + current phase. Dedicated endpoint adds no value. |
| `GET /api/observability/pipeline/:taskId` | **KEEP** | Historical task pipeline lookup. Snapshot only has current task. Consumers: debugging completed/failed tasks. |
| `GET /api/observability/knowledge` | **MERGE into runtime** | Snapshot already includes knowledge status (initialized, entry count, last updated). |
| `GET /api/observability/knowledge/:taskId` | **KEEP** | Per-task knowledge content. Snapshot only has aggregate status. Consumers: System Validation (verify knowledge generated for specific task). |
| `GET /api/observability/health` | **MERGE into runtime** | Snapshot already includes health state. No separate endpoint needed. |
| `GET /api/observability/tasks/:taskId/artifacts` | **KEEP** | Artifact listing (file names, sizes, worker attribution). Not in snapshot scope. Consumers: debugging, validation. |

### Final Public API (5 endpoints)

```
GET /api/observability/runtime          ← Canonical snapshot (everything)
GET /api/observability/workers/:id      ← Worker drill-down
GET /api/observability/events           ← Paginated event history
GET /api/observability/pipeline/:taskId ← Historical task pipeline
GET /api/observability/knowledge/:taskId← Per-task knowledge content
GET /api/observability/tasks/:taskId/artifacts ← Task artifact listing
```

6 endpoints total. 1 primary, 5 drill-down.

---

## Runtime Snapshot Schema

`GET /api/observability/runtime`

```jsonc
{
  // Engine
  "engine": {
    "paused": false,
    "pipelineRunning": true,
    "uptime": 8833,
    "version": "3.1.6"
  },

  // Active Task
  "activeTask": {
    "id": "TASK-20260715-003",
    "title": "Build AIC Showcase Website",
    "type": "feature",
    "pipelineState": "INVESTIGATE",
    "phaseStatus": "barrier_wait",
    "startedAt": "2026-07-15T10:00:00Z"
  } | null,

  // Workers (all 15)
  "workers": {
    "pm": { "status": "working", "leaseId": "lease-abc123", "taskId": "TASK-20260715-003" },
    "architect": { "status": "idle", "leaseId": null, "taskId": null },
    // ... 13 more
  },

  // Lease Registry (active + last 20 completed)
  "leases": {
    "lease-abc123": {
      "worker": "pm",
      "taskId": "TASK-20260715-003",
      "status": "active",
      "issuedAt": "2026-07-15T10:00:01Z",
      "completedAt": null,
      "exitCode": null
    }
  },

  // Pipeline
  "pipeline": {
    "currentPhase": "INVESTIGATE",
    "phaseStatus": "barrier_wait",
    "barrier": {
      "workers": ["pm"],
      "completed": { "pm": "complete" },
      "failed": {}
    },
    "runtimeGate": null,
    "pmReview": null,
    "rework": null,
    "phaseHistory": [
      { "phase": "INVESTIGATE", "status": "in_progress", "startedAt": "2026-07-15T10:00:00Z" }
    ]
  },

  // Knowledge
  "knowledge": {
    "initialized": false,
    "entryCount": 0,
    "lastUpdated": null
  },

  // Health
  "health": {
    "state": "healthy",
    "server": "healthy",
    "auth": "healthy",
    "knowledge": "Lazy (Not Initialized)",
    "filesystem": "healthy",
    "lastCheck": "2026-07-15T10:00:00Z"
  },

  // Metrics
  "metrics": {
    "taskCount": 3,
    "completedTasks": 1,
    "failedTasks": 1,
    "activeTasks": 1,
    "latency": {
      "p50": 12,
      "p95": 45,
      "p99": 89
    }
  },

  // Recent Events (last 50)
  "events": [
    { "ts": "2026-07-15T10:00:00Z", "type": "task.created", "taskId": "TASK-20260715-003", "data": {} },
    { "ts": "2026-07-15T10:00:01Z", "type": "lease.issued", "taskId": "TASK-20260715-003", "data": { "leaseId": "lease-abc123", "worker": "pm" } }
  ],

  // Project
  "project": {
    "path": "/home/tvd/AIC-WEB",
    "name": ""
  }
}
```

---

## Work Package Dependency Graph

```
WP-80.1  Event Store
  │  INPUT:  Existing event bus (scripts/engine/events.js)
  │  OUTPUT: scripts/engine/event-store.js, .aic/events.jsonl
  │  VERIFY: Emit event → JSONL file contains entry
  │
  ▼
WP-80.2  Observability Service
  │  INPUT:  state.json, checkpoint.json, events.jsonl, filesystem (tasks/, knowledge/)
  │  OUTPUT: scripts/engine/observability.js
  │  VERIFY: Each query function returns correct shape for snapshot schema
  │
  ▼
WP-80.3  REST API Layer
  │  INPUT:  observability.js (WP-80.2)
  │  OUTPUT: New routes in server.js, 6 endpoints live
  │  VERIFY: curl each endpoint → correct JSON, auth enforced
  │
  ▼
  ┌───────────────┐
  │               │
  ▼               ▼
WP-80.4          WP-80.5
Dashboard        System Validation
  │  INPUT:  /api/observability/* endpoints (WP-80.3)
  │  OUTPUT: Dashboard pages use new API
  │  VERIFY: Dashboard loads, shows real-time state
  │
  │  INPUT:  /api/observability/* endpoints (WP-80.3)
  │  OUTPUT: SV-007 through SV-017 pass
  │  VERIFY: Full SV-100 all 25 pass
  │               │
  └───────┬───────┘
          │
          ▼
WP-80.6  Documentation + Closeout
     INPUT:  All implemented code, all validation results
     OUTPUT: Updated docs, closeout report
     VERIFY: Doc review, no mismatches, READY FOR COMMIT
```

### Strict Dependency Rules

| WP | Blocked By | Gate |
|----|-----------|------|
| WP-80.1 | None | — |
| WP-80.2 | WP-80.1 | Event store writes events.jsonl correctly |
| WP-80.3 | WP-80.2 | Observability service returns correct snapshot shape |
| WP-80.4 | WP-80.3 | All 6 API endpoints return 200 with correct schema |
| WP-80.5 | WP-80.3 | All 6 API endpoints return 200 with correct schema |
| WP-80.6 | WP-80.4 + WP-80.5 | Dashboard works, all SV tests pass |

---

## Implementation Order (strict)

```
1. WP-80.1  Event Store            (~2-3 hours)
2. WP-80.2  Observability Service  (~3-4 hours)
3. WP-80.3  REST API Layer         (~2-3 hours)
4. WP-80.4  Dashboard Migration    (~3-4 hours)  ─┐ parallel
5. WP-80.5  System Validation      (~2-3 hours)  ─┘
6. WP-80.6  Documentation          (~1-2 hours)
```

Total estimated: 15-20 hours.

---

## Status

**PHASE 2 APPROVED — READY FOR IMPLEMENTATION**
