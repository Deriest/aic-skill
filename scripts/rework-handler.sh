#!/usr/bin/env bash
# rework-handler.sh — REWORK Loop for AIC
# Usage: rework-handler.sh <phase> <project_dir> <max_retries> <worker1,tier1> <worker2,tier2> ...
#
# After PM Review returns REWORK:
# 1. Identifies which workers need rework
# 2. Respawns only affected workers
# 3. Tracks retry count
# 4. Enforces max retry limit
# 5. Re-runs PM Review after respawn
#
# Exit codes:
#   0 = All workers eventually PASS
#   1 = Retry limit exceeded (BLOCKED)
#   2 = Invalid arguments
#   3 = Error

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SKILL_DIR/.env"
API_URL="${AIC_API_URL:-http://localhost:6868}"

PHASE="${1:?Usage: rework-handler.sh <phase> <project_dir> <max_retries> <worker,tier> ...}"
PROJECT_DIR="${2:?Missing project directory}"
MAX_RETRIES="${3:?Missing max retry count}"
shift 3

if [[ $# -eq 0 ]]; then
  echo "ERROR: No workers specified." >&2
  exit 2
fi

# Load .env
if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE" 2>/dev/null || true; set +a
fi

echo "=== REWORK Handler: $PHASE ==="
echo "=== Max retries: $MAX_RETRIES ==="
echo "=== Workers: $@ ==="

RETRY_COUNT=0

while [[ $RETRY_COUNT -lt $MAX_RETRIES ]]; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo ""
  echo "=== REWORK attempt $RETRY_COUNT of $MAX_RETRIES ==="

  # Update runtime state
  curl -sf -X POST "$API_URL/api/phase-barrier" \
    -H "Content-Type: application/json" \
    -d "{\"active\":true,\"workers\":[\"${@%%,*}\"],\"completed\":{},\"startedAt\":$(date +%s),\"timeout\":600}" > /dev/null 2>&1 || true

  # Respawn all workers (targeted — only the ones that failed)
  echo "=== Respawning workers ==="
  bash "$SCRIPT_DIR/phase-runner.sh" "$PHASE" "$PROJECT_DIR" "$@"
  BARRIER_EXIT=$?

  if [[ $BARRIER_EXIT -ne 0 ]]; then
    echo "=== Barrier failed (exit $BARRIER_EXIT) ===" >&2
    continue
  fi

  # Collect artifacts
  ARTIFACTS=()
  TASK_ID=$(curl -sf "$API_URL/api/status" 2>/dev/null | grep -o '"id":"TASK-[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
  if [[ -n "$TASK_ID" ]]; then
    REPORT_DIR="$SKILL_DIR/.aic/tasks/$TASK_ID/reports"
    if [[ -d "$REPORT_DIR" ]]; then
      for f in "$REPORT_DIR"/*.md; do
        [[ -f "$f" ]] && ARTIFACTS+=("$f")
      done
    fi
  fi

  if [[ ${#ARTIFACTS[@]} -eq 0 ]]; then
    echo "=== No artifacts found, creating placeholder ==="
    ARTIFACTS=("/tmp/no-artifact.txt")
    echo "No artifacts generated" > /tmp/no-artifact.txt
  fi

  # Run PM Review
  echo "=== Running PM Review ==="
  bash "$SCRIPT_DIR/pm-review.sh" "$PHASE" "$PROJECT_DIR" "${ARTIFACTS[@]}"
  PM_EXIT=$?

  case $PM_EXIT in
    0)
      echo ""
      echo "=== PM Review: PASS ==="
      echo "=== REWORK loop complete after $RETRY_COUNT attempt(s) ==="
      
      # Update runtime state
      curl -sf -X POST "$API_URL/api/pm-review" \
        -H "Content-Type: application/json" \
        -d "{\"phase\":\"$PHASE\",\"verdicts\":{\"all\":\"PASS\"},\"feedback\":{}}" > /dev/null 2>&1 || true
      
      exit 0
      ;;
    1)
      echo ""
      echo "=== PM Review: REWORK (will retry) ==="
      continue
      ;;
    2)
      echo ""
      echo "=== PM Review: BLOCKED ===" >&2
      exit 1
      ;;
    *)
      echo ""
      echo "=== PM Review: UNKNOWN ($PM_EXIT) ===" >&2
      continue
      ;;
  esac
done

echo ""
echo "=== REWORK LIMIT EXCEEDED ===" >&2
echo "=== $MAX_RETRIES attempts failed for phase $PHASE ===" >&2
echo "=== Escalating to BLOCKED state ===" >&2

# Update runtime state to blocked
curl -sf -X POST "$API_URL/api/phase-barrier" \
  -H "Content-Type: application/json" \
  -d "{\"active\":false,\"workers\":[],\"completed\":{},\"startedAt\":0,\"timeout\":0}" > /dev/null 2>&1 || true

exit 1
