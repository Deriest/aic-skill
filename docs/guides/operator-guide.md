# AIC Operator Guide

## Quick Start

```bash
cp .env.example .env
# Edit .env: PROVIDER=aic, API_KEY, MODEL_THINKER/CRAFTER/SPRINTER
bash scripts/setup.sh
bash scripts/deploy.sh start
curl http://localhost:6868/health
```

Dashboard opens at `http://localhost:6868` — see `docs/assets/` for screenshots.

## Starting a Task

Via Hermes chat (recommended):

```
/aic
/aic project ~/my-app
/aic status
```

Via API (with auth):

```bash
source scripts/api-auth.sh
curl_api -X POST http://localhost:6868/api/runtime/intent   -H "Content-Type: application/json"   -d '{"intent":"task.start","title":"My Task","description":"..."}'
```

## Monitoring Progress

### Dashboard

Open `http://localhost:6868` — Overview, History, Costs, Config pages.

- **Pipeline Tracker**: task elapsed timer (task lifecycle, not server uptime) via `dashboard/src/utils/taskTimer.ts`
- **Runtime Gate**: from Engine barrier + `runtime-gate-system.md`
- **Performance**: latency + SLI from `DashboardContext.tsx`

### API

```bash
source scripts/api-auth.sh
curl_api http://localhost:6868/api/status
curl_api http://localhost:6868/api/pipeline/status
curl http://localhost:6868/api/tasks  # public
```

## Configuration

- `.env.example` → `.env` (canonical prod template)
- `PROVIDER` (required, e.g. `aic`, `openrouter`), `API_KEY`, `MODEL_THINKER/CRAFTER/SPRINTER`
- Optional: `AIC_API_URL`, `AIC_CORS_ORIGINS`
- Runtime state: `.aic/` (ignored), see `.gitignore`
- Phase contracts: `templates/phase-contracts/` (canonical) → `.aic/phase-contracts/` (runtime)
- Knowledge ledger: `knowledge/task-entries.json` (generated, ignored)

## Dashboard Panels

| Panel | Data Source | Content |
|-------|-----------|---------|
| Dispatcher | /api/status | Current dispatcher + pipelineRunning |
| Workers | /api/status | Worker status by role |
| Pipeline Tracker | /api/status + /api/tasks/:id/timing | Phase progress + task elapsed |
| Runtime Gate | /api/status engine | Barrier, PM verdict |
| Performance | /api/metrics + latency | Latency, TPS, token breakdown |
| History | /api/tasks | Paginated task archive |
| Costs | /api/metrics summary | Token economics + cache hit |
| Config | /api/config | Runtime env + models |

## Operations

See `docs/operations/operations-guide.md` and `docs/operations/operations-runbook.md`.
