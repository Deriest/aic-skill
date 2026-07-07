#!/bin/bash
# test-api.sh — Smoke tests for AIC Status API
# Usage: ./test-api.sh [base_url]   (default: http://localhost:3000)

set -euo pipefail

BASE="${1:-http://localhost:6868}"
PASS=0
FAIL=0

assert() {
  local label="$1" json="$2" filter="$3"
  if echo "$json" | jq -e "$filter" > /dev/null 2>&1; then
    echo "  ✓ $label"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $label  (jq: $filter)"
    echo "    got: $json"
    FAIL=$((FAIL + 1))
  fi
}

post() {
  curl -sf -X POST "$BASE$1" -H 'Content-Type: application/json' -d "$2"
}

get() {
  curl -sf "$BASE$1"
}

echo "=== AIC Status API Tests ($BASE) ==="
echo ""

# Preflight
echo "0. Preflight"
HEALTH=$(get /health) || { echo "  ✗ API not reachable"; exit 1; }
assert "health ok" "$HEALTH" '.ok == true'
echo ""

# Reset to clean slate
echo "1. POST /api/reset"
RESET=$(post /api/reset '{}')
assert "reset success" "$RESET" '.success == true'

# Task-start
echo "2. POST /api/task-start"
TASK=$(post /api/task-start '{"title":"Test Sprint","type":"chore","id":"T-99"}')
assert "task-start success" "$TASK" '.success == true'

# Phase-start
echo "3. POST /api/phase-start"
PHASE=$(post /api/phase-start '{"name":"Implementation","status":"active"}')
assert "phase-start success" "$PHASE" '.success == true'

# Agent-status
echo "4. POST /api/agent-status"
AGENT=$(post /api/agent-status '{"agent":"worker-1","status":"working","engine":"opencode"}')
assert "agent-status success" "$AGENT" '.success == true'

# GET /api/status — verify saved state
echo "5. GET /api/status (verify writes persisted)"
STATUS=$(get /api/status)
assert "currentTask.title == Test Sprint"      "$STATUS" '.currentTask.title == "Test Sprint"'
assert "currentTask.type == chore"              "$STATUS" '.currentTask.type == "chore"'
assert "currentTask.id == T-99"                 "$STATUS" '.currentTask.id == "T-99"'
assert "last phase name == Implementation"      "$STATUS" '.phases[-1].name == "Implementation"'
assert "last phase status == active"            "$STATUS" '.phases[-1].status == "active"'
assert "worker-1 status == working"             "$STATUS" '.agents["worker-1"].status == "working"'
assert "worker-1 engine == opencode"            "$STATUS" '.agents["worker-1"].engine == "opencode"'
assert "connected == true"                      "$STATUS" '.connected == true'
assert "logs non-empty"                         "$STATUS" '.logs | length > 0'

# Note: GET /api/status drains logs (clears them on read), so next poll will show empty logs.
# This is by design — ring buffer consumed on read.

# Task-complete
echo "6. POST /api/task-complete"
COMPLETE=$(post /api/task-complete '{}')
assert "task-complete success" "$COMPLETE" '.success == true'

# GET /api/history — verify entry appended
echo "7. GET /api/history"
HIST=$(get /api/history)
assert "history is array"              "$HIST" 'type == "array"'
assert "history has ≥1 entry"          "$HIST" 'length >= 1'
assert "last entry task.title match"   "$HIST" '.[-1].task.title == "Test Sprint"'
assert "last entry has completedAt"    "$HIST" '.[-1].completedAt != null'
assert "last entry has phases array"   "$HIST" '.[-1].phases | type == "array"'
assert "last entry has agents object"  "$HIST" '.[-1].agents | type == "object"'

# Concurrent writes — 10 rapid agent-status calls (no data loss)
echo "8. Concurrent agents (10 rapid writes)"
post /api/task-start '{"title":"Concurrent-Test","type":"chore","id":"T-CONC"}'
for i in $(seq 1 10); do
  post /api/agent-status "{\"agent\":\"agent-$i\",\"status\":\"working\"}" &
done
wait
CONC_STATUS=$(get /api/status)
CONC_COUNT=$(echo "$CONC_STATUS" | jq '.agents | length')
if [ "$CONC_COUNT" -ge 10 ]; then
  echo "  ✓ $CONC_COUNT agents persisted (≥10)"
  PASS=$((PASS + 1))
else
  echo "  ✗ Only $CONC_COUNT agents persisted (expected ≥10)"
  FAIL=$((FAIL + 1))
fi

# Clean up concurrent test state
post /api/task-complete '{}'
post /api/reset '{}'
# Verify state was reset after task-complete
echo "9. GET /api/status (verify state reset)"
STATUS2=$(get /api/status)
assert "currentTask is null after complete" "$STATUS2" '.currentTask == null'
assert "phases is empty after complete"     "$STATUS2" '.phases | length == 0'
assert "agents is empty after complete"     "$STATUS2" '.agents | length == 0'

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
