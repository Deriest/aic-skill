#!/usr/bin/env bash
# api-auth.sh — Internal runtime authentication helper
# Source this file in runtime scripts that call server.js APIs.
# Usage: source "$(dirname "$0")/api-auth.sh"
# Then use: curl_api [curl args...]

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUTH_FILE="$SKILL_DIR/.aic/auth.json"

_aic_get_api_key() {
  if [ -f "$AUTH_FILE" ]; then
    local key
    key=$(python3 -c "import json; d=json.load(open('$AUTH_FILE')); print(d['apiKeys'][0]['key'])" 2>/dev/null)
    if [ -n "$key" ]; then
      echo "$key"
      return 0
    fi
  fi
  return 1
}

curl_api() {
  local key
  key=$(_aic_get_api_key) || true
  if [ -n "$key" ]; then
    curl -sf -H "X-API-Key: $key" "$@"
  else
    # No key available — run without auth (dev mode)
    curl -sf "$@"
  fi
}

# Log errors instead of silently swallowing
run_api() {
  local label="$1"
  shift
  local result
  result=$("$@" 2>&1)
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    echo "  [WARN] $label failed (exit=$exit_code): $result" >&2
    return $exit_code
  fi
  return 0
}
