# AIC Architecture Overview

## System Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Dashboard   │────▶│  API Server  │────▶│  Dispatcher │
│  (Vite+React)│◀────│  (server.js) │◀────│  (in-proc)  │
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
| API Server | `scripts/server.js` | HTTP API, auth, RBAC, metrics, audit, serves `dashboard/dist` |
| Dispatcher | `scripts/server.js` (in-process) + `scripts/engine/` | Task orchestration, FSM, barrier, PM repair |
| Workers | `scripts/spawn-worker.sh` + `scripts/worker-execution-pipeline.py` | opencode-based task execution |
| Knowledge | `scripts/knowledge-*.sh` + `scripts/artifact-registry.sh` | Artifact lifecycle, indexing, search, reuse |
| Pipeline | `scripts/engine/index.js` → `scripts/phase-runner.sh` | Phase-based execution (investigate→closeout) |
| Dashboard | `dashboard/src/` (Vite + React + Tailwind) → `dashboard/dist/` | Observability UI, self-hosted font |

## Data Flow

```
Task Request → API → Dispatcher → Engine → Phase Runner
                ↓
Phase: investigate → planning → implementation → verification → closeout
         ↓               ↓              ↓              ↓            ↓
       PM worker    architect+      backend+        QA worker    PM worker
                   research+        frontend
                    workers         workers
                ↓
Knowledge Update → Artifact Storage (.aic/artifacts/, .aic/tasks/)
```

## Technology Stack

- Runtime: Node.js (server.js, engine/)
- Workers: opencode CLI (Claude, Gemini, etc.) via `spawn-worker.sh`
- Database: File-based (`.aic/*.json`, `.aic/tasks/`, `.aic/artifacts/`)
- Dashboard: React + Vite + Tailwind, source in `dashboard/src/`, built to `dashboard/dist/`, self-hosted `PressStart2P` in `dashboard/public/fonts/`
- Auth: API key (`X-API-Key` header, `.aic/auth.json`)
- RBAC: Role-based (owner, admin, member, viewer) via `auth.js`
- Phase Contracts: `templates/phase-contracts/` (canonical seed) → `.aic/phase-contracts/` (runtime)

## Key Design Decisions

- Single-process dispatcher (no IPC overhead)
- File-based state (no external DB dependency)
- Vite-built dashboard with self-hosted pixel font (CSP-safe, FIX-022)
- opencode as worker runtime (multi-provider via `PROVIDER` env)
- Phase-based pipeline (investigate→plan→implement→verify→closeout) with Engine FSM + Barrier
- File-based phase contracts (`templates/phase-contracts/` seed → `.aic/phase-contracts/` runtime)
- Archive over delete for historical docs (`archive/` governance)
