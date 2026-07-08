#!/usr/bin/env bash
# spawn-worker.sh — Safe worker spawner for AIC Dispatcher
# Usage: spawn-worker.sh <worker> <tier> <project_dir> <prompt_file> [--no-context]
#
# Features:
# - Escape-safe: reads prompt from file, never inline bash quotes
# - Auto-context: runs context-gather.sh and prepends to prompt
# - Multi-OS: works on Linux, macOS, Windows (git-bash/MSYS/WSL)
# - Auto API status: hits /api/agent-status before and after

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SKILL_DIR/.env"
API_URL="${AIC_API_URL:-http://localhost:6868}"

# Parse args
WORKER="${1:?Usage: spawn-worker.sh <worker> <tier> <project_dir> <prompt_file> [--no-context]}"
TIER="${2:?Missing tier (thinker/crafter/sprinter)}"
PROJECT_DIR="${3:?Missing project directory}"
PROMPT_FILE="${4:?Missing prompt file path}"
SKIP_CONTEXT=false
[[ "${5:-}" == "--no-context" ]] && SKIP_CONTEXT=true

# Load .env
if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE" 2>/dev/null || true; set +a
else
  echo "ERROR: $ENV_FILE not found. Run setup.sh first." >&2
  exit 1
fi

# 3. Model selection based on tier
case "$TIER" in
  thinker)  MODEL="${PROVIDER:-aic}/${MODEL_THINKER}" ;;
  crafter)  MODEL="${PROVIDER:-aic}/${MODEL_CRAFTER}" ;;
  sprinter) MODEL="${PROVIDER:-aic}/${MODEL_SPRINTER}" ;;
  *)        echo "ERROR: Unknown tier '$TIER'. Use thinker/crafter/sprinter." >&2; exit 1 ;;
esac

# Resolve timeout from worker
case "$WORKER" in
  pm|architect)                    TIMEOUT=180 ;;
  researcher|designer|qa|governor) TIMEOUT=300 ;;
  frontend|backend|infra)          TIMEOUT=600 ;;
  *)                               TIMEOUT=300 ;;
esac

# Validate prompt file
if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "ERROR: Prompt file '$PROMPT_FILE' not found." >&2
  exit 1
fi

# Auto-context: prepend project context to prompt
if [[ "$SKIP_CONTEXT" == false ]] && [[ -x "$SCRIPT_DIR/context-gather.sh" ]]; then
  CONTEXT=$("$SCRIPT_DIR/context-gather.sh" "$PROJECT_DIR" --tier "$TIER" 2>/dev/null || echo "")
  if [[ -n "$CONTEXT" ]]; then
    FULL_PROMPT_FILE=$(mktemp "${TMPDIR:-/tmp}/aic-prompt-XXXXXX.txt")
    {
      echo "=== PROJECT CONTEXT (auto-gathered, tier=$TIER) ==="
      echo "$CONTEXT"
      echo ""
      echo "=== TASK PROMPT ==="
      cat "$PROMPT_FILE"
    } > "$FULL_PROMPT_FILE"
    PROMPT_FILE="$FULL_PROMPT_FILE"
    CLEANUP_PROMPT=true
  fi
fi

# Map worker to pipeline phase
PHASE_MAP_pm="Investigate"
PHASE_MAP_architect="Planning"
PHASE_MAP_researcher="Implementation"
PHASE_MAP_designer="Implementation"
PHASE_MAP_frontend="Implementation"
PHASE_MAP_backend="Implementation"
PHASE_MAP_infra="Implementation"
PHASE_MAP_qa="Verification"
PHASE_MAP_governor="Review"
PHASE_VAR="PHASE_MAP_$WORKER"
CURRENT_PHASE="${!PHASE_VAR:-unknown}"

# Update pipeline phase
curl -sf -X POST "$API_URL/api/task-status" \
  -H "Content-Type: application/json" \
  -d "{\"currentPhase\":\"$CURRENT_PHASE\"}" > /dev/null 2>&1 || true

# Set worker status to working
curl -sf -X POST "$API_URL/api/agent-status" \
  -H "Content-Type: application/json" \
  -d "{\"agent\":\"$WORKER\",\"status\":\"working\",\"engine\":\"opencode\"}" > /dev/null 2>&1 || true

echo "=== Spawning $WORKER (tier=$TIER, model=$MODEL, timeout=${TIMEOUT}s) ==="

# Run opencode — cross-platform safe, capture output for metrics
EXIT_CODE=0
METRICS_OUTPUT=""
if command -v opencode &>/dev/null; then
  # Use node wrapper for maximum escaping safety, capture stdout for metrics
  NODE_RUNNER=$(mktemp "${TMPDIR:-/tmp}/aic-run-XXXXXX.js")
  cat << 'NODESCRIPT' > "$NODE_RUNNER"
const { execFileSync } = require('child_process');
const fs = require('fs');
const promptFile = process.argv[2];
const model = process.argv[3];
const cwd = process.argv[4];
const timeout = parseInt(process.argv[5] || '300') * 1000;
try {
  const result = execFileSync('opencode', ['run', promptFile, '-m', model, '--auto', '--format', 'json'], {
    cwd: cwd,
    timeout: timeout,
    encoding: 'utf8',
  });
  // Write output to temp file for token extraction
  const outputFile = process.argv[6];
  if (outputFile) fs.writeFileSync(outputFile, result);
} catch (e) {
  // Still capture stdout from error for token extraction
  if (e.stdout) {
    const outputFile = process.argv[6];
    if (outputFile) fs.writeFileSync(outputFile, e.stdout);
  }
  process.exit(e.status || 1);
}
NODESCRIPT
  OUTPUT_FILE=$(mktemp "${TMPDIR:-/tmp}/aic-output-XXXXXX.txt")
  node "$NODE_RUNNER" "$PROMPT_FILE" "$MODEL" "$PROJECT_DIR" "$TIMEOUT" "$OUTPUT_FILE" || EXIT_CODE=$?
  
  # Extract tokens from captured output
  if [[ -f "$OUTPUT_FILE" ]]; then
    # Parse step_finish events for token counts
    INPUT_TOKENS=$(grep -o '"input":[0-9]*' "$OUTPUT_FILE" | tail -1 | cut -d: -f2 || echo "0")
    OUTPUT_TOKENS=$(grep -o '"output":[0-9]*' "$OUTPUT_FILE" | tail -1 | cut -d: -f2 || echo "0")
    REASONING_TOKENS=$(grep -o '"reasoning":[0-9]*' "$OUTPUT_FILE" | tail -1 | cut -d: -f2 || echo "0")
    CACHE_READ=$(grep -o '"read":[0-9]*' "$OUTPUT_FILE" | tail -1 | cut -d: -f2 || echo "0")
    CACHE_WRITE=$(grep -o '"write":[0-9]*' "$OUTPUT_FILE" | tail -1 | cut -d: -f2 || echo "0")
    COST=$(grep -o '"cost":[0-9.]*' "$OUTPUT_FILE" | tail -1 | cut -d: -f2 || echo "0")
    
    # Send metrics to API
    if [[ -n "$INPUT_TOKENS" ]] && [[ "$INPUT_TOKENS" != "0" ]]; then
      TOTAL_TOKENS=$((${INPUT_TOKENS:-0} + ${OUTPUT_TOKENS:-0} + ${REASONING_TOKENS:-0}))
      curl -sf -X POST "$API_URL/api/metrics" \
        -H "Content-Type: application/json" \
        -d "{
          \"worker\": \"$WORKER\",
          \"tier\": \"$TIER\",
          \"model\": \"$MODEL\",
          \"tokens\": {
            \"input\": ${INPUT_TOKENS:-0},
            \"output\": ${OUTPUT_TOKENS:-0},
            \"reasoning\": ${REASONING_TOKENS:-0},
            \"cacheRead\": ${CACHE_READ:-0},
            \"cacheWrite\": ${CACHE_WRITE:-0},
            \"total\": $TOTAL_TOKENS
          },
          \"durationSec\": 0
        }" > /dev/null 2>&1 || true
    fi
    # Save output to task reports directory before cleanup
    TASK_ID=$(curl -sf "$API_URL/api/status" 2>/dev/null | grep -o '"id":"TASK-[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
    if [[ -n "$TASK_ID" ]]; then
      REPORT_DIR="$SKILL_DIR/.aic/tasks/$TASK_ID/reports"
      mkdir -p "$REPORT_DIR"
      cp "$OUTPUT_FILE" "$REPORT_DIR/${WORKER}-output.md" 2>/dev/null || true
    fi
    rm -f "$OUTPUT_FILE"
  fi

  rm -f "$NODE_RUNNER"
else
  echo "ERROR: opencode not installed. Run: npm i -g opencode-ai@latest" >&2
  EXIT_CODE=1
fi

# Cleanup temp files
[[ "${CLEANUP_PROMPT:-false}" == true ]] && rm -f "$PROMPT_FILE"

if [[ $EXIT_CODE -eq 0 ]]; then
  curl -sf -X POST "$API_URL/api/agent-status" \
    -H "Content-Type: application/json" \
    -d "{\"agent\":\"$WORKER\",\"status\":\"complete\"}" > /dev/null 2>&1 || true
  # Auto-mark task done when last phase worker (governor) completes
  if [[ "$WORKER" == "governor" ]]; then
    TASK_ID=$(curl -sf "$API_URL/api/status" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('currentTask',{}).get('id',''))" 2>/dev/null || echo "")
    if [[ -n "$TASK_ID" ]]; then
      curl -sf -X POST "$API_URL/api/task-complete" \
        -H "Content-Type: application/json" \
        -d "{\"taskId\":\"$TASK_ID\"}" > /dev/null 2>&1 || true
    fi
  fi
  echo "=== $WORKER completed successfully ==="
else
  echo "=== $WORKER failed (exit $EXIT_CODE) ===" >&2
fi

exit $EXIT_CODE
