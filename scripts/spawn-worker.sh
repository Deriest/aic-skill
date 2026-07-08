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

# Set worker status to working
curl -sf -X POST "$API_URL/api/agent-status" \
  -H "Content-Type: application/json" \
  -d "{\"agent\":\"$WORKER\",\"status\":\"working\",\"engine\":\"opencode\"}" > /dev/null 2>&1 || true

echo "=== Spawning $WORKER (tier=$TIER, model=$MODEL, timeout=${TIMEOUT}s) ==="

# Run opencode — cross-platform safe
EXIT_CODE=0
if command -v opencode &>/dev/null; then
  # Use node wrapper for maximum escaping safety
  NODE_RUNNER=$(mktemp "${TMPDIR:-/tmp}/aic-run-XXXXXX.js")
  cat << 'NODESCRIPT' > "$NODE_RUNNER"
const { execFileSync } = require('child_process');
const fs = require('fs');
const promptFile = process.argv[2];
const model = process.argv[3];
const cwd = process.argv[4];
try {
  execFileSync('opencode', ['run', promptFile, '-m', model, '--auto'], {
    stdio: 'inherit',
    cwd: cwd,
    timeout: parseInt(process.argv[5] || '300') * 1000,
  });
} catch (e) {
  process.exit(e.status || 1);
}
NODESCRIPT
  node "$NODE_RUNNER" "$PROMPT_FILE" "$MODEL" "$PROJECT_DIR" "$TIMEOUT" || EXIT_CODE=$?
  rm -f "$NODE_RUNNER"
else
  echo "ERROR: opencode not installed. Run: npm i -g opencode-ai@latest" >&2
  EXIT_CODE=1
fi

# Set worker status back to idle
curl -sf -X POST "$API_URL/api/agent-status" \
  -H "Content-Type: application/json" \
  -d "{\"agent\":\"$WORKER\",\"status\":\"idle\"}" > /dev/null 2>&1 || true

# Cleanup temp files
[[ "${CLEANUP_PROMPT:-false}" == true ]] && rm -f "$PROMPT_FILE"

if [[ $EXIT_CODE -eq 0 ]]; then
  echo "=== $WORKER completed successfully ==="
else
  echo "=== $WORKER failed (exit $EXIT_CODE) ===" >&2
fi

exit $EXIT_CODE
