# AIC Operator Guide

## Starting a Task

```bash
# Via pipeline orchestrator
bash scripts/pipeline-orchestrator.sh "Your task description" /tmp/output-dir

# Via API
curl -X POST -H "X-API-Key: KEY" -d '{"title":"My Task"}' http://localhost:6868/api/task-start
```

## Monitoring Progress

### Dashboard
Open http://localhost:6868 in browser.

### API
```bash
# Current status
curl -H "X-API-Key: KEY" http://localhost:6868/api/status

# Pipeline progress
curl -H "X-API-Key: KEY" http://localhost:6868/api/pipeline/status

# Task history
curl http://localhost:6868/api/tasks
```

## Configuration

Configuration is stored in `.aic/` directory:
- `auth.json` — API keys
- `projects.json` — Project registry
- `permissions.json` — RBAC matrix

## Dashboard Panels

| Panel | Data Source | Content |
|-------|-----------|---------|
| Dispatcher | /api/status | Current dispatcher state |
| Workers | /api/status | Worker status by role |
| Pipeline | /api/pipeline/status | Phase progress |
| Metrics | /api/metrics | Tokens, cost, memory, CPU |
| Tasks | /api/tasks | Task history |
| Health | /api/health/components | Component status |
| Config | /api/config | Runtime configuration |
