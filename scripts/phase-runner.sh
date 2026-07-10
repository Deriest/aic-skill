#!/usr/bin/env bash
# phase-runner.sh — Parallel Phase Scheduler for AIC
# Usage: phase-runner.sh <phase> <project_dir> <worker1,tier1> <worker2,tier2> ...
#
# Runs all workers in a phase concurrently, waits for completion, handles errors.
#
# Examples:
#   # Planning phase: Architect serial, then 4 specialists parallel
#   phase-runner.sh Planning /project architect,thinker data,thinker integration,thinker infra,crafter security,crafter
#
#   # Implementation phase: 3 workers parallel
#   phase-runner.sh Implementation /project backend,crafter frontend,crafter designer,crafter
#
# Exit codes:
#   0 = All workers completed successfully
#   1 = One or more workers failed (details in output)
#   2 = Invalid arguments

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SKILL_DIR/.env"
API_URL="${AIC_API_URL:-http://localhost:6868}"

# Parse args
PHASE="${1:?Usage: phase-runner.sh <phase> <project_dir> <worker,tier> ...}"
PROJECT_DIR="${2:?Missing project directory}"
shift 2

if [[ $# -eq 0 ]]; then
  echo "ERROR: No workers specified." >&2
  exit 2
fi

# Load .env
if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE" 2>/dev/null || true; set +a
source "$(dirname "$0")/api-auth.sh"
fi

# Update phase
curl_api -X POST "$API_URL/api/task-status" \
  -H "Content-Type: application/json" \
  -d "{\"currentPhase\":\"$PHASE\"}" > /dev/null 2>&1 || true

echo "=== Phase: $PHASE ==="
echo "=== Spawning $# workers ==="

# Phase 1: Spawn all workers in background
declare -A PIDS
declare -A WORKERS

for worker_arg in "$@"; do
  IFS=',' read -r worker tier <<< "$worker_arg"
  
  if [[ -z "$worker" ]] || [[ -z "$tier" ]]; then
    echo "ERROR: Invalid worker format '$worker_arg'. Use worker,tier" >&2
    exit 2
  fi
  
  # Create prompt file for this worker
  PROMPT_FILE="${TMPDIR:-/tmp}/aic-phase-${PHASE}-${worker}.txt"
  cat > "$PROMPT_FILE" << PROMPT
You are the ${worker} for the AIC.
Phase: ${PHASE}
Execute your assigned tasks for this phase.
Project directory: ${PROJECT_DIR}
PROMPT

  echo "  Spawning: $worker (tier=$tier)"
  
  # Spawn in background
  bash "$SCRIPT_DIR/spawn-worker.sh" "$worker" "$tier" "$PROJECT_DIR" "$PROMPT_FILE" --no-context &
  PID=$!
  PIDS[$PID]=$worker
  WORKERS[$worker]=$PID
done

echo ""
echo "=== Phase Barrier: Waiting for ${#PIDS[@]} workers ==="

# Phase 2: Wait for all PIDs (Phase Barrier)
FAILED_WORKERS=()
COMPLETED_WORKERS=()

for pid in "${!PIDS[@]}"; do
  worker=${PIDS[$pid]}
  
  if wait "$pid" 2>/dev/null; then
    echo "  ✓ $worker completed"
    COMPLETED_WORKERS+=("$worker")
  else
    exit_code=$?
    echo "  ✗ $worker failed (exit $exit_code)" >&2
    FAILED_WORKERS+=("$worker")
  fi
done

echo ""
echo "=== Phase Barrier Complete ==="
echo "  Completed: ${#COMPLETED_WORKERS[@]}"
echo "  Failed: ${#FAILED_WORKERS[@]}"

# Phase 3: Report results
if [[ ${#FAILED_WORKERS[@]} -eq 0 ]]; then
  echo ""
  echo "=== Phase $PHASE: ALL WORKERS PASSED ==="
  exit 0
else
  echo ""
  echo "=== Phase $PHASE: ${#FAILED_WORKERS[@]} WORKER(S) FAILED ===" >&2
  echo "  Failed: ${FAILED_WORKERS[*]}" >&2
  exit 1
fi
