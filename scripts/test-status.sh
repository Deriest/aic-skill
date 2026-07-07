#!/bin/bash
# test-status.sh
# Bash integration tests for update-status.py (legacy) compatibility via API

echo "Running legacy compatibility API tests..."
FAIL=0

# Helper
assert() {
  if [ "$1" != "true" ]; then
    echo "❌ $2"
    FAIL=1
  else
    echo "✅ $2"
  fi
}

# 1. Reset
curl -s -X POST http://localhost:6868/api/reset > /dev/null

# 2. Task Start
curl -s -X POST -H "Content-Type: application/json" -d '{"title":"Test Bash","type":"feature","id":"B-1"}' http://localhost:6868/api/task-start > /dev/null
RES=$(curl -s http://localhost:6868/api/status | jq -r '.currentTask.title')
assert "$([ "$RES" = "Test Bash" ] && echo true || echo false)" "task-start recorded"

# 3. Agent Status
curl -s -X POST -H "Content-Type: application/json" -d '{"agent":"qa","status":"working","engine":"test"}' http://localhost:6868/api/agent-status > /dev/null
RES=$(curl -s http://localhost:6868/api/status | jq -r '.agents.qa.status')
assert "$([ "$RES" = "working" ] && echo true || echo false)" "agent-status recorded"

# 4. Phase Start & Complete
curl -s -X POST -H "Content-Type: application/json" -d '{"name":"QA"}' http://localhost:6868/api/phase-start > /dev/null
curl -s -X POST http://localhost:6868/api/phase-complete > /dev/null
RES=$(curl -s http://localhost:6868/api/status | jq -r '.phases[0].status')
assert "$([ "$RES" = "complete" ] && echo true || echo false)" "phase progression"

# 5. Task Complete (creates history)
curl -s -X POST -H "Content-Type: application/json" -d '{"outcome":"success"}' http://localhost:6868/api/task-complete > /dev/null
RES=$(curl -s http://localhost:6868/api/history | jq -r '.[-1].task.title')
assert "$([ "$RES" = "Test Bash" ] && echo true || echo false)" "history appended"

if [ $FAIL -eq 0 ]; then
  echo "All status tests PASS"
  exit 0
else
  echo "Some tests FAILED"
  exit 1
fi
