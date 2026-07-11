#!/usr/bin/env bash
# stress-test.sh — K-5 Stress & Load Testing
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
API="${AIC_API_URL:-http://localhost:6868}"
KEY=$(python3 -c "import json; print(json.load(open('$SKILL_DIR/.aic/auth.json'))['apiKeys'][0]['key'])" 2>/dev/null || echo "")
ACTION="${1:-all}"

api() { curl -sf -H "X-API-Key: $KEY" "$@"; }

test_concurrent() {
  echo "--- Concurrent Tasks ---"
  for i in 1 2 3; do
    api -X POST -H "Content-Type: application/json"       -d "{"title":"stress-$i","type":"feature"}"       "$API/api/task-start" &
  done
  wait
  echo "3 concurrent tasks submitted"
  RESULT=$(api "$API/api/status")
  echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Workers: {len(d.get("workers",{}))} connected: {d.get("connected",False)}')"
}

test_queue_growth() {
  echo "--- Queue Growth ---"
  for i in $(seq 1 10); do
    api -X POST -H "Content-Type: application/json"       -d "{"task":"stress-queue-$i","priority":$((i % 3))}"       "$API/api/queue/enqueue" 2>/dev/null || true
  done
  RESULT=$(api "$API/api/queue/status" 2>/dev/null || echo '{"queue":{"length":0}}')
  echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Queue: {d.get("queue",{}).get("length",0)} items')"
}

test_restart() {
  echo "--- Restart Under Load ---"
  PID=$(lsof -ti:6868 2>/dev/null | head -1)
  if [[ -n "$PID" ]]; then
    kill -9 "$PID" 2>/dev/null
    sleep 2
    echo "Server killed, checking restart..."
    # Server should be restarted by deploy or manual start
    curl -sf "$API/health" 2>/dev/null | grep -q '"ok"' && echo "PASS: restarted" || echo "FAIL: not restarted (manual start needed)"
  fi
}

case "$ACTION" in
  concurrent) test_concurrent ;;
  queue)      test_queue_growth ;;
  restart)    test_restart ;;
  all)        test_concurrent; test_queue_growth; test_restart ;;
  *)          echo "Usage: stress-test.sh [concurrent|queue|restart|all]" ;;
esac
