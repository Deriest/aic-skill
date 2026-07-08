#!/usr/bin/env bash
# preflight.sh — Auto preflight for /aic activation
# Checks opencode, .env, server, dashboard. Auto-starts what's missing.
# Usage: bash preflight.sh [--auto-start]
# Exit 0 = ready, Exit 1 = blocker (report to user)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SKILL_DIR/.env"
API_PORT="${AIC_API_PORT:-6868}"
API_URL="http://localhost:$API_PORT"
AUTO_START=false
[[ "${1:-}" == "--auto-start" ]] && AUTO_START=true

PASS=0; FAIL=0
check() { if eval "$1" >/dev/null 2>&1; then echo "✓ $2"; PASS=$((PASS+1)); else echo "✗ $2"; FAIL=$((FAIL+1)); fi; }

# 1. OpenCode
check "command -v opencode" "OpenCode installed"

# 2. .env exists — auto-setup if missing
if [[ ! -f "$ENV_FILE" ]]; then
  echo "✗ .env not found"
  if [[ "$AUTO_START" == true ]]; then
    echo "  → Running setup.sh..."
    bash "$SCRIPT_DIR/setup.sh"
    [[ -f "$ENV_FILE" ]] && echo "  → .env created" || { echo "  → Setup failed"; exit 1; }
  else
    echo "  → Run: bash $SCRIPT_DIR/setup.sh"
    FAIL=$((FAIL+1))
  fi
else
  echo "✓ .env exists"
  PASS=$((PASS+1))
fi

# 3. API server — auto-start if down
if curl -sf "$API_URL/health" >/dev/null 2>&1; then
  echo "✓ API server (port $API_PORT)"
  PASS=$((PASS+1))
elif [[ "$AUTO_START" == true ]]; then
  echo "○ API server down — starting..."
  # Cross-platform: kill existing, then start
  if command -v fuser &>/dev/null; then
    fuser -k "$API_PORT/tcp" 2>/dev/null || true
  elif command -v lsof &>/dev/null; then
    lsof -ti :"$API_PORT" | xargs kill -9 2>/dev/null || true
  fi
  sleep 0.5
  nohup node "$SCRIPT_DIR/server.js" "$API_PORT" > /tmp/aic-api.log 2>&1 &
  # Wait up to 5s for server
  for i in $(seq 1 10); do
    curl -sf "$API_URL/health" >/dev/null 2>&1 && break
    sleep 0.5
  done
  if curl -sf "$API_URL/health" >/dev/null 2>&1; then
    echo "✓ API server started (port $API_PORT)"
    PASS=$((PASS+1))
  else
    echo "✗ API server failed to start"
    FAIL=$((FAIL+1))
  fi
else
  echo "✗ API server (port $API_PORT)"
  FAIL=$((FAIL+1))
fi

# 4. Dashboard dist exists
if [[ -d "$SKILL_DIR/dashboard/dist/index.html" ]] || [[ -f "$SKILL_DIR/dashboard/dist/index.html" ]]; then
  echo "✓ Dashboard built"
  PASS=$((PASS+1))
elif [[ "$AUTO_START" == true ]] && [[ -f "$SKILL_DIR/dashboard/package.json" ]]; then
  echo "○ Dashboard not built — building..."
  cd "$SKILL_DIR/dashboard"
  [[ -d node_modules ]] || npm install --silent 2>/dev/null
  npm run build 2>/dev/null
  echo "✓ Dashboard built"
  PASS=$((PASS+1))
  cd - >/dev/null
else
  echo "✗ Dashboard not built"
  FAIL=$((FAIL+1))
fi

# 5. Set dispatcher to working & Open Dashboard
if [[ $FAIL -eq 0 ]]; then
  curl -sf -X POST "$API_URL/api/agent-status" \
    -H "Content-Type: application/json" \
    -d '{"agent":"dispatcher","status":"working","engine":"delegate"}' >/dev/null 2>&1 || true

  # Auto-open the dashboard on the production server port (6868)
  if [[ "$AUTO_START" == true ]]; then
    sleep 1
    (xdg-open "$API_URL" 2>/dev/null || open "$API_URL" 2>/dev/null || start "$API_URL" 2>/dev/null) &
  fi
fi

echo ""
echo "Preflight: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]] && echo "🟢 AIC Ready" || echo "🔴 Fix issues above"
exit $FAIL
