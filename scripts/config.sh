#!/usr/bin/env bash
# config.sh — Centralized Configuration for AIC
# Usage: config.sh <action> [args]
#
# Dashboard API URL
# Set DASHBOARD_API_URL in .env to override the default dashboard endpoint.
# If not set, scripts default to http://localhost:6868.
#   e.g. DASHBOARD_API_URL=http://localhost:6868
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SKILL_DIR/.env"
ACTION="${1:?Usage: config.sh <get|set|validate|reload|export>}"

case "$ACTION" in
  get)
    KEY="${2:?Missing key}"
    if [[ -f "$ENV_FILE" ]]; then
      grep "^$KEY=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- || echo "NOT_SET"
    else
      echo "NOT_SET"
    fi
    ;;
  set)
    KEY="${2:?Missing key}"; VALUE="${3:?Missing value}"
    mkdir -p "$(dirname "$ENV_FILE")"
    if grep -q "^$KEY=" "$ENV_FILE" 2>/dev/null; then
      sed -i "s|^$KEY=.*|$KEY=$VALUE|" "$ENV_FILE"
    else
      echo "$KEY=$VALUE" >> "$ENV_FILE"
    fi
    echo "Set: $KEY"
    ;;
  validate)
    REQUIRED=("MODEL_THINKER" "MODEL_CRAFTER" "PROVIDER")
    MISSING=0
    for k in "${REQUIRED[@]}"; do
      if ! grep -q "^$k=" "$ENV_FILE" 2>/dev/null; then
        echo "MISSING: $k"
        MISSING=$((MISSING+1))
      fi
    done
    if [[ $MISSING -eq 0 ]]; then
      echo "VALID: All required keys present"
    else
      echo "INVALID: $MISSING missing keys"
      exit 1
    fi
    ;;
  reload)
    echo "Configuration reloaded from $ENV_FILE"
    ;;
  export)
    if [[ -f "$ENV_FILE" ]]; then
      sed 's/=.*/=***/' "$ENV_FILE"
    else
      echo "No .env file"
    fi
    ;;
  *) echo "Unknown: $ACTION"; exit 1 ;;
esac
