# AIC Architecture Overview

## System Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Dashboard   │────▶│  API Server  │────▶│  Dispatcher │
│  (compiled)  │◀────│  (server.js) │◀────│  (in-proc)  │
└─────────────┘     └──────────────┘     └──────┬──────┘
                           │                     │
                    ┌──────┴──────┐        ┌─────┴─────┐
                    │  Knowledge  │        │  Workers  │
                    │  Platform   │        │ (opencode)│
                    └─────────────┘        └───────────┘
```

## Components

| Component | File | Purpose |
|-----------|------|---------|
| API Server | server.js | HTTP API, auth, RBAC, metrics, audit |
| Dispatcher | server.js (in-process) | Task orchestration, pipeline management |
| Workers | spawn-worker.sh | opencode-based task execution |
| Knowledge | knowledge-*.sh | Artifact lifecycle, indexing, search, reuse |
| Pipeline | pipeline-orchestrator.sh | Phase-based task execution |
| Dashboard | dist/ (compiled React) | Observability UI |

## Data Flow

```
Task Request → API → Dispatcher → Pipeline Orchestrator
                ↓
Phase: investigate → planning → implementation → verification → closeout
         ↓               ↓              ↓              ↓            ↓
       PM worker    architect+      backend+        QA worker    PM worker
                   research+        frontend
                    workers         workers
                ↓
Knowledge Update → Artifact Storage
```

## Technology Stack

- Runtime: Node.js
- Workers: opencode CLI (Claude, Gemini, etc.)
- Database: File-based (.aic/*.json)
- Dashboard: Compiled React (no source)
- Auth: API key (X-API-Key header)
- RBAC: Role-based (owner, admin, member, viewer)

## Key Design Decisions

- Single-process dispatcher (no IPC overhead)
- File-based state (no database dependency)
- Compiled dashboard (no build toolchain)
- opencode as worker runtime (multi-provider)
- Phase-based pipeline (investigate→plan→implement→verify→closeout)
