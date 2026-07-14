# AIC Operations Runbook

**Version:** 1.0
**Date:** 2026-07-10

---

## Startup

```bash
# Start server
cd ~/.hermes/skills/workflows/aic
bash scripts/deploy.sh start

# Verify
curl http://localhost:6868/health
```

## Shutdown

```bash
# Graceful shutdown
bash scripts/deploy.sh stop

# Or send SIGTERM
kill -TERM $(cat .aic/server.pid)
```

## Backup

```bash
bash scripts/deploy.sh backup
# Creates: .aic/backups/backup-YYYYMMDD-HHMMSS/
```

## Restore

```bash
bash scripts/deploy.sh restore .aic/backups/backup-YYYYMMDD-HHMMSS/
```

## Upgrade

```bash
bash scripts/deploy.sh upgrade
# Backs up → stops → pulls → starts → validates
```

## Log Rotation

Audit log is auto-archived when > 10MB on server startup.
Manual: `mv .aic/audit.log .aic/audit.log.$(date +%Y%m%d)`

## Health Check

```bash
curl http://localhost:6868/health
curl http://localhost:6868/api/health/components
```

## Troubleshooting

| Symptom | Action |
|---------|--------|
| Port 6868 in use | `kill -9 $(lsof -ti:6868)` |
| Stale workers | Restart server (resets to idle) |
| Auth failure | Check .aic/auth.json has valid key |
| Pipeline stuck | Check .aic/tasks/*/state.json |
