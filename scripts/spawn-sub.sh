#!/usr/bin/env bash
# spawn-sub.sh — Safe sub-worker spawner for AIC
# Usage: spawn-sub.sh <parent_worker> <sub_id> <tier> <project_dir> <prompt_file> [--no-context]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SKILL_DIR/.env"
API_URL="${AIC_API_URL:-http://localhost:6868}"

# Parse args
PARENT="${1:?Usage: spawn-sub.sh <parent_worker> <sub_id> <tier> <project_dir> <prompt_file> [--no-context]}"
SUB_ID="${2:?Missing sub_id}"
TIER="${3:?Missing tier (thinker/crafter/sprinter)}"
PROJECT_DIR="${4:?Missing project directory}"
PROMPT_FILE="${5:?Missing prompt file path}"
SKIP_CONTEXT=false
[[ "${6:-}" == "--no-context" ]] && SKIP_CONTEXT=true

# Load .env
if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE" 2>/dev/null || true; set +a
source "$(dirname "$0")/api-auth.sh"
else
  echo "ERROR: $ENV_FILE not found." >&2
  exit 1
fi

case "$TIER" in
  thinker)  MODEL="${PROVIDER:-aic}/${MODEL_THINKER}" ;;
  crafter)  MODEL="${PROVIDER:-aic}/${MODEL_CRAFTER}" ;;
  sprinter) MODEL="${PROVIDER:-aic}/${MODEL_SPRINTER}" ;;
  *)        echo "ERROR: Unknown tier '$TIER'." >&2; exit 1 ;;
esac

TIMEOUT=300

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "ERROR: Prompt file '$PROMPT_FILE' not found." >&2
  exit 1
fi

# Auto-context
if [[ "$SKIP_CONTEXT" == false ]] && [[ -x "$SCRIPT_DIR/context-gather.sh" ]]; then
  CONTEXT=$("$SCRIPT_DIR/context-gather.sh" "$PROJECT_DIR" --tier "$TIER" 2>/dev/null || echo "")
  if [[ -n "$CONTEXT" ]]; then
    FULL_PROMPT_FILE=$(mktemp "${TMPDIR:-/tmp}/aic-sub-prompt-XXXXXX.txt")
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

# Set sub-worker status to working
curl_api -X POST "$API_URL/api/sub-agent-status" \
  -H "Content-Type: application/json" \
  -d "{\"parent\":\"$PARENT\",\"id\":\"$SUB_ID\",\"status\":\"working\",\"scope\":\"${SUB_ID}\"}" > /dev/null 2>&1 || true

echo "=== Spawning SUB-WORKER $SUB_ID (parent=$PARENT, tier=$TIER, model=$MODEL) ==="

EXIT_CODE=0
if command -v opencode &>/dev/null; then
  NODE_RUNNER=$(mktemp "${TMPDIR:-/tmp}/aic-subrun-XXXXXX.js")
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
  const outputFile = process.argv[6];
  if (outputFile) fs.writeFileSync(outputFile, result);
} catch (e) {
  if (e.stdout) {
    const outputFile = process.argv[6];
    if (outputFile) fs.writeFileSync(outputFile, e.stdout);
  }
  process.exit(e.status || 1);
}
NODESCRIPT
  OUTPUT_FILE=$(mktemp "${TMPDIR:-/tmp}/aic-suboutput-XXXXXX.txt")
  node "$NODE_RUNNER" "$PROMPT_FILE" "$MODEL" "$PROJECT_DIR" "$TIMEOUT" "$OUTPUT_FILE" || EXIT_CODE=$?
  
  if [[ -f "$OUTPUT_FILE" ]]; then
    # Token metrics could be sent here as well, similar to spawn-worker.sh
    # Save output
    TASK_ID=$(curl_api "$API_URL/api/status" 2>/dev/null | grep -o '"id":"TASK-[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
    if [[ -n "$TASK_ID" ]]; then
      REPORT_DIR="$SKILL_DIR/.aic/tasks/$TASK_ID/reports"
      mkdir -p "$REPORT_DIR"
      cp "$OUTPUT_FILE" "$REPORT_DIR/${SUB_ID}-report.md" 2>/dev/null || true
    fi
    rm -f "$OUTPUT_FILE"
  fi
  rm -f "$NODE_RUNNER"
else
  echo "ERROR: opencode not installed." >&2
  EXIT_CODE=1
fi

# Cleanup
[[ "${CLEANUP_PROMPT:-false}" == true ]] && rm -f "$PROMPT_FILE"

STATUS="complete"
if [[ $EXIT_CODE -ne 0 ]]; then
  STATUS="failed"
  echo "=== $SUB_ID failed (exit $EXIT_CODE) ===" >&2
else
  echo "=== $SUB_ID completed successfully ==="
fi

curl_api -X POST "$API_URL/api/sub-agent-status" \
  -H "Content-Type: application/json" \
  -d "{\"parent\":\"$PARENT\",\"id\":\"$SUB_ID\",\"status\":\"$STATUS\"}" > /dev/null 2>&1 || true

exit $EXIT_CODE
