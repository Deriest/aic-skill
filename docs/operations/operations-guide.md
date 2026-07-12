# Operations Guide

## Deployment

```bash
# Validate deployment
bash scripts/deploy.sh validate

# Check status
bash scripts/deploy.sh status

# Start server
node scripts/server.js 6868
```

## Health Checks

```bash
# Server health
curl http://localhost:6868/health

# Component health
curl -H "X-API-Key: KEY" http://localhost:6868/api/health/components

# Metrics
curl http://localhost:6868/api/metrics/summary
```

## Monitoring

- Metrics: `/api/metrics` (tokens, cost, memory, CPU)
- Monitor: `/api/monitor` (runtime state)
- Audit: `/api/audit` (audit log)
- Logs: `.aic/logs/app.log`

## Recovery

```bash
# Queue retry
bash scripts/queue.sh retry

# Recovery check
bash scripts/recovery.sh check

# Runtime reset
curl -X POST -H "X-API-Key: KEY" http://localhost:6868/api/reset
```

## Graceful Shutdown

Server handles SIGTERM and SIGINT:
1. Stops accepting connections
2. Waits for active workers (30s timeout)
3. Kills orphan workers
4. Cleans up PID file
5. Exits

## Troubleshooting

| Issue | Check | Fix |
|-------|-------|-----|
| Server won't start | Port in use | `lsof -i:6868` |
| Auth failure | API key | Check .aic/auth.json |
| Worker timeout | opencode | Check provider status |
| Pipeline stuck | Phase barrier | Check /api/pipeline/status |
