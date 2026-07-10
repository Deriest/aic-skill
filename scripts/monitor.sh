#!/usr/bin/env bash
# monitor.sh — Backend Monitoring for AIC
# Usage: monitor.sh <action> [args]
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ACTION="${1:?Usage: monitor.sh <dashboard|alert|watch>}"

case "$ACTION" in
  dashboard)
    echo "=== AIC System Monitor ==="
    echo ""
    echo "--- Health ---"
    bash "$SCRIPT_DIR/health-check.sh" status 2>/dev/null || echo "No health data"
    echo ""
    echo "--- Metrics Summary ---"
    bash "$SCRIPT_DIR/metrics.sh" summary 2>/dev/null || echo "No metrics"
    echo ""
    echo "--- Recent Errors ---"
    bash "$SCRIPT_DIR/logger.sh" query ERROR "" 5 2>/dev/null || echo "No errors"
    echo ""
    echo "--- Server ---"
    curl -sf http://localhost:6868/health 2>/dev/null || echo "Server DOWN"
    ;;
  alert)
    THRESHOLD_ERROR="${2:-5}"
    THRESHOLD_QUEUE="${3:-100}"
    ALERTS=()
    
    # Check error rate
    ERROR_COUNT=$(bash "$SCRIPT_DIR/logger.sh" query ERROR "" 1000 2>/dev/null | wc -l)
    if [[ $ERROR_COUNT -gt $THRESHOLD_ERROR ]]; then
      ALERTS+=("HIGH_ERROR_RATE: $ERROR_COUNT errors (threshold: $THRESHOLD_ERROR)")
    fi
    
    # Check server health
    if ! curl -sf http://localhost:6868/health >/dev/null 2>&1; then
      ALERTS+=("SERVER_DOWN: Cannot reach server")
    fi
    
    if [[ ${#ALERTS[@]} -eq 0 ]]; then
      echo "OK: No alerts"
    else
      for a in "${ALERTS[@]}"; do
        echo "ALERT: $a"
      done
    fi
    ;;
  watch)
    INTERVAL="${2:-5}"
    echo "Monitoring every ${INTERVAL}s (Ctrl+C to stop)"
    while true; do
      clear
      bash "$SCRIPT_DIR/monitor.sh" dashboard
      sleep "$INTERVAL"
    done
    ;;
  *) echo "Unknown: $ACTION"; exit 1 ;;
esac
