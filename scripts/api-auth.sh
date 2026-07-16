#!/usr/bin/env bash
set -euo pipefail
# api-auth.sh — Internal runtime authentication helper
# Source this file in runtime scripts that call server.js APIs.
# Usage: source "$(dirname "$0")/api-auth.sh"
# Then use: curl_api [curl args...]

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUTH_FILE="$SKILL_DIR/.aic/auth.json"

_AIC_CACHED_KEY=""

_aic_get_api_key() {
  if [[ -n "$_AIC_CACHED_KEY" ]]; then
    echo "$_AIC_CACHED_KEY"
    return 0
  fi
  if [ -f "$AUTH_FILE" ]; then
    local key
    key=$(jq -r '.apiKeys[0].key // empty' "$AUTH_FILE" 2>/dev/null)
    if [ -n "$key" ]; then
      _AIC_CACHED_KEY="$key"
      echo "$key"
      return 0
    fi
  fi
  return 1
}

curl_api() {
  local key
  key=$(_aic_get_api_key) || true
  local http_status body_file auth_flag
  body_file=$(mktemp)
  trap "rm -f '$body_file'" RETURN
  if [ -n "$key" ]; then
    auth_flag="X-API-Key: $key"
    http_status=$(curl -s -o "$body_file" -w "%{http_code}" -H "$auth_flag" "$@")
  else
    http_status=$(curl -s -o "$body_file" -w "%{http_code}" "$@")
  fi
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    echo "curl failed (exit=$exit_code)" >&2
    cat "$body_file" >&2
    return $exit_code
  fi
  if [ "$http_status" -ge 400 ] 2>/dev/null; then
    echo "HTTP $http_status: $(cat "$body_file")" >&2
    cat "$body_file"
    return 1
  fi
  cat "$body_file"
  return 0
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
