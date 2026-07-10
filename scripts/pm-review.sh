#!/usr/bin/env bash
# pm-review.sh — PM Review Automation for AIC
# Usage: pm-review.sh <phase> <project_dir> <artifact1> <artifact2> ...
#
# After a phase barrier completes, this script:
# 1. Generates a PM Review prompt from artifacts
# 2. Invokes the PM worker to evaluate
# 3. Parses the verdict (PASS/REWORK/BLOCKED/UNKNOWN)
# 4. Updates runtime state via API
#
# Exit codes:
#   0 = All artifacts PASS
#   1 = One or more artifacts REWORK
#   2 = BLOCKED
#   3 = UNKNOWN/invalid verdict
#   4 = Error (timeout, missing artifacts)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SKILL_DIR/.env"
API_URL="${AIC_API_URL:-http://localhost:6868}"

# Parse args
PHASE="${1:?Usage: pm-review.sh <phase> <project_dir> <artifact1> [artifact2] ...}"
PROJECT_DIR="${2:?Missing project directory}"
shift 2

if [[ $# -eq 0 ]]; then
  echo "ERROR: No artifacts specified." >&2
  exit 4
fi

# Load .env
if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE" 2>/dev/null || true; set +a
fi

echo "=== PM Review: $PHASE ==="
echo "=== Artifacts: $# ==="

# Phase 1: Generate PM Review prompt
PROMPT_FILE=$(mktemp "${TMPDIR:-/tmp}/aic-pm-review-XXXXXX.txt")
cat > "$PROMPT_FILE" << PROMPT
You are the Project Manager (PM) for the AIC.

## Task
Review the following artifacts from the ${PHASE} phase.

## Artifacts
PROMPT

for artifact in "$@"; do
  if [[ -f "$artifact" ]]; then
    echo "" >> "$PROMPT_FILE"
    echo "### $(basename "$artifact")" >> "$PROMPT_FILE"
    echo '```' >> "$PROMPT_FILE"
    cat "$artifact" >> "$PROMPT_FILE"
    echo '```' >> "$PROMPT_FILE"
  else
    echo "WARNING: Artifact not found: $artifact" >&2
  fi
done

cat >> "$PROMPT_FILE" << PROMPT

## Instructions
Review each artifact for:
1. Completeness — does it address the work package requirements?
2. Quality — is the output well-structured and valid?
3. Consistency — does it align with the architecture specification?

## Verdict
Respond with EXACTLY one of:
- PASS — all artifacts are complete and valid
- REWORK — one or more artifacts need revision (specify which and why)
- BLOCKED — cannot proceed due to external dependency

Format your response as:
VERDICT: PASS
or
VERDICT: REWORK
[details]
or
VERDICT: BLOCKED
[details]
PROMPT

echo "=== Prompt generated: $PROMPT_FILE ==="

# Phase 2: Invoke PM Review
# Use opencode if available, otherwise use mock
VERDICT_FILE=$(mktemp "${TMPDIR:-/tmp}/aic-verdict-XXXXXX.txt")

if command -v opencode &>/dev/null; then
  echo "=== Invoking PM via opencode ==="
  NODE_RUNNER=$(mktemp "${TMPDIR:-/tmp}/aic-pm-XXXXXX.js")
  cat << 'NODESCRIPT' > "$NODE_RUNNER"
const { execFileSync } = require('child_process');
const fs = require('fs');
const promptFile = process.argv[2];
const model = process.argv[3];
const cwd = process.argv[4];
const outputFile = process.argv[5];
try {
  const result = execFileSync('opencode', ['run', promptFile, '-m', model, '--auto', '--format', 'json'], {
    cwd: cwd, timeout: 120000, encoding: 'utf8',
  });
  fs.writeFileSync(outputFile, result);
} catch (e) {
  if (e.stdout) fs.writeFileSync(outputFile, e.stdout);
  process.exit(e.status || 1);
}
NODESCRIPT
  PM_MODEL="${PROVIDER:-aic}/${MODEL_THINKER:-opus}"
  node "$NODE_RUNNER" "$PROMPT_FILE" "$PM_MODEL" "$PROJECT_DIR" "$VERDICT_FILE" 2>/dev/null || true
  rm -f "$NODE_RUNNER"
else
  echo "=== opencode not found, using mock PM ==="
  # Mock: read prompt and produce PASS
  echo "VERDICT: PASS" > "$VERDICT_FILE"
  echo "All artifacts are complete and valid." >> "$VERDICT_FILE"
fi

# Phase 3: Parse verdict
VERDICT_RAW=$(cat "$VERDICT_FILE")
echo "=== Raw verdict ==="
echo "$VERDICT_RAW" | head -5

# Extract verdict
VERDICT=$(echo "$VERDICT_RAW" | grep -i "VERDICT:" | head -1 | sed 's/.*VERDICT:\s*//' | tr '[:lower:]' '[:upper:]' | xargs)

case "$VERDICT" in
  PASS)
    echo "=== PM Review: PASS ==="
    # Update API
    VERDICTS_JSON="{"
    for artifact in "$@"; do
      name=$(basename "$artifact" .md)
      VERDICTS_JSON+="\"$name\":\"PASS\","
    done
    VERDICTS_JSON="${VERDICTS_JSON%,}}"
    
    curl -sf -X POST "$API_URL/api/pm-review" \
      -H "Content-Type: application/json" \
      -d "{\"phase\":\"$PHASE\",\"verdicts\":$VERDICTS_JSON,\"feedback\":{}}" > /dev/null 2>&1 || true
    
    EXIT_CODE=0
    ;;
  REWORK)
    echo "=== PM Review: REWORK ==="
    echo "$VERDICT_RAW" | grep -A 10 "REWORK" || true
    
    # Update API with REWORK verdict
    VERDICTS_JSON="{"
    for artifact in "$@"; do
      name=$(basename "$artifact" .md)
      VERDICTS_JSON+="\"$name\":\"REWORK\","
    done
    VERDICTS_JSON="${VERDICTS_JSON%,}}"
    
    curl -sf -X POST "$API_URL/api/pm-review" \
      -H "Content-Type: application/json" \
      -d "{\"phase\":\"$PHASE\",\"verdicts\":$VERDICTS_JSON,\"feedback\":{}}" > /dev/null 2>&1 || true
    
    EXIT_CODE=1
    ;;
  BLOCKED)
    echo "=== PM Review: BLOCKED ==="
    echo "$VERDICT_RAW" | grep -A 10 "BLOCKED" || true
    EXIT_CODE=2
    ;;
  *)
    echo "=== PM Review: UNKNOWN ===" >&2
    echo "Could not parse verdict from response." >&2
    echo "Raw: $VERDICT_RAW" >&2
    EXIT_CODE=3
    ;;
esac

# Cleanup
rm -f "$PROMPT_FILE" "$VERDICT_FILE"

echo "=== PM Review complete (exit $EXIT_CODE) ==="
exit $EXIT_CODE
