#!/usr/bin/env bash
# recovery.sh — Runtime Recovery for AIC
# Usage: recovery.sh <action> [args]
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$SKILL_DIR/.aic/backups"
mkdir -p "$BACKUP_DIR"
ACTION="${1:?Usage: recovery.sh <backup|restore|recover|status>}"

case "$ACTION" in
  backup)
    TAG="${2:-$(date +%Y%m%d-%H%M%S)}"
    DEST="$BACKUP_DIR/$TAG"
    mkdir -p "$DEST"
    # Backup critical state
    for d in state.json auth.json knowledge workers metrics.json health.json; do
      src="$SKILL_DIR/.aic/$d"
      if [[ -e "$src" ]]; then
        cp -r "$src" "$DEST/" 2>/dev/null || true
      fi
    done
    echo "$TAG" > "$DEST/.backup_tag"
    echo "Backup: $TAG"
    
    # Prune old backups (keep 5)
    cd "$BACKUP_DIR"
    ls -1dt */ 2>/dev/null | tail -n +6 | xargs rm -rf 2>/dev/null || true
    ;;
  restore)
    TAG="${2:-$(ls -1t "$BACKUP_DIR" | head -1)}"
    SRC="$BACKUP_DIR/$TAG"
    if [[ ! -d "$SRC" ]]; then
      echo "Backup not found: $TAG"
      exit 1
    fi
    for item in state.json auth.json knowledge workers metrics.json health.json; do
      if [[ -e "$SRC/$item" ]]; then
        cp -r "$SRC/$item" "$SKILL_DIR/.aic/" 2>/dev/null || true
      fi
    done
    echo "Restored: $TAG"
    ;;
  recover)
    echo "=== Auto-Recovery ==="
    # Check health
    HEALTH_STATE=$(bash "$SCRIPT_DIR/health-check.sh" check 2>/dev/null | grep "^State:" | cut -d' ' -f2)
    if [[ "$HEALTH_STATE" == "unhealthy" ]]; then
      echo "State: unhealthy — initiating recovery"
      # Try restore from latest backup
      LATEST=$(ls -1t "$BACKUP_DIR" | head -1)
      if [[ -n "$LATEST" ]]; then
        bash "$SCRIPT_DIR/health-check.sh" status 2>/dev/null
        bash "$0" restore "$LATEST"
        echo "Recovery complete. Re-checking health..."
        bash "$SCRIPT_DIR/health-check.sh" check 2>/dev/null
      else
        echo "No backup available for recovery"
        exit 1
      fi
    elif [[ "$HEALTH_STATE" == "degraded" ]]; then
      echo "State: degraded — monitoring"
    else
      echo "State: healthy — no recovery needed"
    fi
    ;;
  status)
    echo "=== Recovery Status ==="
    echo "Backups: $(ls -1 "$BACKUP_DIR" 2>/dev/null | wc -l)"
    LATEST=$(ls -1t "$BACKUP_DIR" | head -1)
    echo "Latest: ${LATEST:-none}"
    bash "$SCRIPT_DIR/health-check.sh" status 2>/dev/null || echo "No health data"
    ;;
  *) echo "Unknown: $ACTION"; exit 1 ;;
esac
