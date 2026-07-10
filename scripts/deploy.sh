#!/usr/bin/env bash
# deploy.sh — Enterprise Deployment (Native Linux) for AIC
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ACTION="${1:?Usage: deploy.sh <action> [args]}"
ARG="${2:-}"

export AIC_ENV="${AIC_ENV:-prod}"
PORT="${AIC_PORT:-6868}"

case "$ACTION" in
  install)
    echo "=== AIC Installation (${AIC_ENV}) ==="
    mkdir -p "$SKILL_DIR/.aic/logs" "$SKILL_DIR/.aic/metrics" "$SKILL_DIR/.aic/locks" "$SKILL_DIR/.aic/backups"
    echo '{"apiKeys":[]}' > "$SKILL_DIR/.aic/auth.json" 2>/dev/null || true
    echo '{}' > "$SKILL_DIR/.aic/quotas.json" 2>/dev/null || true
    echo '[]' > "$SKILL_DIR/.aic/projects.json" 2>/dev/null || true
    echo '[]' > "$SKILL_DIR/.aic/dispatcher-registry.json" 2>/dev/null || true
    echo '[]' > "$SKILL_DIR/.aic/worker-targets.json" 2>/dev/null || true
    echo '{"roles":{"admin":["*"],"lead":["project.*","worker.*","audit.*"],"member":["task.*","artifact.*"],"viewer":["status.read"]},"users":{}}' > "$SKILL_DIR/.aic/permissions.json" 2>/dev/null || true
    echo '{"project_dir":"'$SKILL_DIR'","task_type":"feature","timestamp":'$(date +%s)',"branch":"main"}' > "$SKILL_DIR/.aic/active-project.json"
    echo "Installation complete. Environment: $AIC_ENV"
    echo "Run: deploy.sh start"
    ;;
  start)
    echo "=== Starting AIC (${AIC_ENV}) ==="
    if lsof -ti:$PORT >/dev/null 2>&1; then
      echo "Port $PORT already in use"; exit 1
    fi
    cd "$SKILL_DIR"
    node scripts/server.js $PORT &
    echo $! > "$SKILL_DIR/.aic/server.pid"
    sleep 2
    if curl -sf http://localhost:$PORT/health >/dev/null 2>&1; then
      echo "AIC started on port $PORT (PID $(cat "$SKILL_DIR/.aic/server.pid"))"
    else
      echo "ERROR: server failed to start"; exit 1
    fi
    ;;
  stop)
    PID_FILE="$SKILL_DIR/.aic/server.pid"
    if [[ -f "$PID_FILE" ]]; then
      kill "$(cat "$PID_FILE")" 2>/dev/null || true
      rm "$PID_FILE"
      echo "AIC stopped"
    else
      echo "No PID file found, killing by port"
      kill -9 $(lsof -ti:$PORT) 2>/dev/null || echo "No process on port $PORT"
    fi
    ;;
  restart)
    "$0" stop; sleep 1; "$0" start
    ;;
  upgrade)
    echo "=== AIC Upgrade (${AIC_ENV}) ==="
    "$0" backup
    "$0" stop
    cd "$SKILL_DIR" && git pull 2>/dev/null || echo "No git remote configured"
    "$0" start
    "$0" validate
    echo "Upgrade complete"
    ;;
  backup)
    BACKUP_DIR="$SKILL_DIR/.aic/backups/backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    cp -r "$SKILL_DIR/.aic/"*.json "$BACKUP_DIR/" 2>/dev/null || true
    cp -r "$SKILL_DIR/.aic/logs" "$BACKUP_DIR/" 2>/dev/null || true
    cp -r "$SKILL_DIR/.aic/audit.log" "$BACKUP_DIR/" 2>/dev/null || true
    echo "Backup: $BACKUP_DIR"
    ;;
  restore)
    BACKUP="${ARG:?Missing backup path}"
    if [[ ! -d "$BACKUP" ]]; then echo "Error: $BACKUP not found"; exit 1; fi
    "$0" stop
    cp -r "$BACKUP/"*.json "$SKILL_DIR/.aic/" 2>/dev/null || true
    cp -r "$BACKUP/logs" "$SKILL_DIR/.aic/" 2>/dev/null || true
    cp "$BACKUP/audit.log" "$SKILL_DIR/.aic/" 2>/dev/null || true
    "$0" start
    echo "Restored from: $BACKUP"
    ;;
  validate)
    echo "=== Deployment Validation (${AIC_ENV}) ==="
    PASS=0; FAIL=0
    HEALTH=$(curl -sf http://localhost:$PORT/health 2>/dev/null || echo "DOWN")
    echo "$HEALTH" | grep -q '"ok"' && { PASS=$((PASS+1)); echo "  PASS: health"; } || { FAIL=$((FAIL+1)); echo "  FAIL: health"; }
    [[ -f "$SKILL_DIR/.aic/auth.json" ]] && { PASS=$((PASS+1)); echo "  PASS: auth.json"; } || { FAIL=$((FAIL+1)); echo "  FAIL: auth.json"; }
    [[ -f "$SKILL_DIR/.aic/projects.json" ]] && { PASS=$((PASS+1)); echo "  PASS: projects.json"; } || { FAIL=$((FAIL+1)); echo "  FAIL: projects.json"; }
    [[ -f "$SKILL_DIR/.aic/permissions.json" ]] && { PASS=$((PASS+1)); echo "  PASS: permissions.json"; } || { FAIL=$((FAIL+1)); echo "  FAIL: permissions.json"; }
    echo "Result: $PASS PASS, $FAIL FAIL"
    [[ $FAIL -eq 0 ]] && echo "VALIDATION: PASS" || echo "VALIDATION: FAIL"
    ;;
  status)
    PID_FILE="$SKILL_DIR/.aic/server.pid"
    if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      echo "AIC: RUNNING (PID $(cat "$PID_FILE"), env=$AIC_ENV, port=$PORT)"
    else
      echo "AIC: STOPPED (env=$AIC_ENV)"
    fi
    ;;
  *)
    echo "ERROR: Unknown action '$ACTION'" >&2; exit 1
    ;;
esac
