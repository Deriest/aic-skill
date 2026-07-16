#!/usr/bin/env bash
# spawn-worker.sh — Worker executor (FEAT-001: lease + completion contract)
# Exit codes: 0=success, 1=error (worker failure, infrastructure issue)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SKILL_DIR/.env"
API_URL="${AIC_API_URL:-http://localhost:6868}"

WORKER="${1:?Usage: spawn-worker.sh <worker> <tier> <project_dir> <prompt_file> [--no-context]}"
TIER="${2:?Missing tier (thinker/crafter/sprinter)}"
PROJECT_DIR="${3:?Missing project directory}"
PROMPT_FILE="${4:?Missing prompt file path}"
SKIP_CONTEXT=false
for arg in "${5:-}" "${6:-}"; do
  [[ "$arg" == "--no-context" ]] && SKIP_CONTEXT=true
done

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
  *) echo "ERROR: Unknown tier '$TIER'." >&2; exit 1 ;;
esac

case "$WORKER" in
  pm|architect|data|integration|research) TIMEOUT="${AIC_PM_TIMEOUT_SECONDS:-300}" ;;
  designer|qa|governor|documentation)     TIMEOUT=300 ;;
  frontend|backend|infra|security|perf)   TIMEOUT=600 ;;
  *)                                      TIMEOUT=300 ;;
esac

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "ERROR: Prompt file '$PROMPT_FILE' not found." >&2
  exit 1
fi

if [[ "$SKIP_CONTEXT" == false ]] && [[ -x "$SCRIPT_DIR/cache-context.sh" ]]; then
  CONTEXT=$("$SCRIPT_DIR/cache-context.sh" "$PROJECT_DIR" "$TIER" 2>/dev/null || echo "")
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

TASK_ID="${AIC_TASK_ID:-}"
LEASE_ID="${AIC_LEASE_ID:-}"

if [[ -z "$TASK_ID" ]]; then
  TASK_ID=$(curl_api "$API_URL/api/status" 2>/dev/null | jq -r '.currentTask.id // empty' 2>/dev/null || echo "")
fi

if [[ -z "$LEASE_ID" && -n "$TASK_ID" ]]; then
  LEASE_JSON=$(curl_api -X POST "$API_URL/api/runtime/lease/issue" \
    -H "Content-Type: application/json" \
    -d "{\"taskId\":\"$TASK_ID\",\"worker\":\"$WORKER\",\"tier\":\"$TIER\",\"projectDir\":\"$PROJECT_DIR\"}" 2>/dev/null || echo "")
  LEASE_ID=$(echo "$LEASE_JSON" | jq -r '.leaseId // empty' 2>/dev/null || echo "")
fi

if [[ -z "$LEASE_ID" ]]; then
  echo "ERROR: No runtime lease. Engine must issue lease before spawn." >&2
  exit 1
fi

echo "=== Spawning $WORKER (tier=$TIER, lease=$LEASE_ID) ==="

EXIT_CODE=0
WORKER_START_TS=$(date +%s)

# WECP: delegate to compliance pipeline for contract-covered phases/roles
PIPE_PHASE="${AIC_PIPELINE_PHASE:-Implementation}"
HAS_CONTRACT=$(python3 "$SCRIPT_DIR/phase-contract-loader.py" load "$SKILL_DIR" "$PIPE_PHASE" 2>/dev/null \
  | jq -e ".roles.$WORKER" >/dev/null 2>&1 && echo yes || echo no)

if [[ "$HAS_CONTRACT" == "yes" ]]; then
  echo "=== Using Worker Execution Compliance Pipeline (WECP) ==="
  export TIMEOUT
  python3 "$SCRIPT_DIR/worker-execution-pipeline.py" "$SKILL_DIR" "$WORKER" "$TIER" "$PROJECT_DIR" "$PROMPT_FILE"
  EXIT_CODE=$?
  # Artifact already written by WECP to reports/ if exit 0
  ARTIFACT_PATH=""
  if [[ $EXIT_CODE -eq 0 && -n "${AIC_TASK_ID:-}" ]]; then
    ARTIFACT_PATH="$SKILL_DIR/.aic/tasks/$AIC_TASK_ID/reports/${WORKER}-output.md"
  fi
else
  # Legacy single-shot for non-contract roles
  OUTPUT_FILE=$(mktemp "${TMPDIR:-/tmp}/aic-output-XXXXXX.txt")
  if command -v opencode &>/dev/null; then
    NODE_RUNNER=$(mktemp "${TMPDIR:-/tmp}/aic-run-XXXXXX.js")
    cat << 'NODESCRIPT' > "$NODE_RUNNER"
const { execFileSync } = require('child_process');
const fs = require('fs');
const promptFile = process.argv[2];
const model = process.argv[3];
const cwd = process.argv[4];
const timeout = parseInt(process.argv[5] || '300') * 1000;
const outputFile = process.argv[6];
try {
  const result = execFileSync('opencode', ['run', promptFile, '-m', model, '--auto', '--format', 'json'], {
    cwd: cwd, timeout: timeout, encoding: 'utf8',
  });
  fs.writeFileSync(outputFile, result);
} catch (e) {
  if (e.stdout) fs.writeFileSync(outputFile, e.stdout);
  process.exit(e.status || 1);
}
NODESCRIPT
    ATTEMPT=0
    MAX_ATTEMPTS=2
    while [[ $ATTEMPT -lt $MAX_ATTEMPTS ]]; do
      node "$NODE_RUNNER" "$PROMPT_FILE" "$MODEL" "$PROJECT_DIR" "$TIMEOUT" "$OUTPUT_FILE" && EXIT_CODE=0 && break
      EXIT_CODE=$?
      ATTEMPT=$((ATTEMPT + 1))
      [[ $ATTEMPT -lt $MAX_ATTEMPTS ]] && sleep 5
    done

    if [[ -f "$OUTPUT_FILE" ]]; then
      TOKEN_JSON=$(python3 "$SCRIPT_DIR/opencode-token-extract.py" "$OUTPUT_FILE" 2>/dev/null || echo '{"input":0}')
      INPUT_TOKENS=$(echo "$TOKEN_JSON" | jq -r '.input // 0' 2>/dev/null || echo "0")
      if [[ "${INPUT_TOKENS:-0}" != "0" ]]; then
        WORKER_END_TS=$(date +%s)
        DURATION=$((WORKER_END_TS - WORKER_START_TS))
        METRICS_PAYLOAD=$(jq -n \
          --arg w "$WORKER" --arg t "$TIER" --arg m "$MODEL" \
          --argjson tokens "$TOKEN_JSON" --argjson dur "$DURATION" \
          '{worker:$w, tier:$t, model:$m, tokens:$tokens, durationSec:$dur}')
        curl_api -X POST "$API_URL/api/metrics" \
          -H "Content-Type: application/json" \
          -d "$METRICS_PAYLOAD" > /dev/null 2>&1 || true
      fi
    fi
  else
    echo "ERROR: opencode not installed." >&2
    EXIT_CODE=1
  fi

  ARTIFACT_PATH=""
  if [[ -n "$TASK_ID" && -f "$OUTPUT_FILE" ]]; then
    REPORT_DIR="$SKILL_DIR/.aic/tasks/$TASK_ID/reports"
    mkdir -p "$REPORT_DIR"
    ARTIFACT_PATH="$REPORT_DIR/${WORKER}-output.md"

    # Extract existing generation if any
    PREV_GEN=0
    if [[ -f "$ARTIFACT_PATH" ]]; then
      PREV_GEN=$(grep -oP '^generation: \K\d+' "$ARTIFACT_PATH" | head -1 || echo 0)
    fi
    NEW_GEN=$((PREV_GEN + 1))
    
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    # Create frontmatter
    FRONTMATTER="---\nschema_version: 1\ntask_id: ${TASK_ID}\nphase: ${PIPE_PHASE}\nworker: ${WORKER}\ngeneration: ${NEW_GEN}\ntimestamp: ${TIMESTAMP}\n"
    if [[ $PREV_GEN -gt 0 ]]; then
      FRONTMATTER="${FRONTMATTER}supersedes: ${PREV_GEN}\nrepair_iteration: ${PREV_GEN}\n"
    fi
    FRONTMATTER="${FRONTMATTER}---\n"

if ! python3 "$SCRIPT_DIR/opencode-json-to-md.py" "$OUTPUT_FILE" | awk -v fm="$FRONTMATTER" 'NR==1{printf "%s\n", fm} 1' > "$ARTIFACT_PATH" 2>/dev/null; then
      # IMP-024-B: Strategy B parity for legacy runner
      SID=$(python3 "$SCRIPT_DIR/legacy-extract-sid.py" "$OUTPUT_FILE" 2>/dev/null || true)
      if [[ -n "$SID" ]]; then
        echo "=== LEGACY: extraction failed — attempting Strategy B continue sid=$SID ===" >&2
        CONT_MSG=$(bash "$SCRIPT_DIR/worker-continue-prompt.sh" 2>/dev/null | head -c 800 || echo "Output ONLY the final markdown report. No tools.")
        CONT_FILE=$(mktemp "${TMPDIR:-/tmp}/aic-cont-XXXXXX.txt")
        CONT_RUNNER=$(mktemp "${TMPDIR:-/tmp}/aic-cont-run-XXXXXX.js")
        cat << 'CONTJS' > "$CONT_RUNNER"
const { execFileSync } = require('child_process');
const fs = require('fs');
const message = process.argv[2];
const model = process.argv[3];
const cwd = process.argv[4];
const timeout = parseInt(process.argv[5] || '300') * 1000;
const outputFile = process.argv[6];
const sessionId = process.argv[7];
try {
  const result = execFileSync('opencode', ['run', message, '-m', model, '--continue', '-s', sessionId, '--auto', '--format', 'json'], {
    cwd: cwd, timeout: timeout, encoding: 'utf8',
  });
  fs.writeFileSync(outputFile, result);
} catch (e) {
  if (e.stdout) fs.writeFileSync(outputFile, e.stdout);
  process.exit(e.status || 1);
}
CONTJS
        node "$CONT_RUNNER" "$CONT_MSG" "$MODEL" "$PROJECT_DIR" "$TIMEOUT" "$CONT_FILE" "$SID" 2>/dev/null || true
        if [[ -f "$CONT_FILE" && -s "$CONT_FILE" ]]; then
          if python3 "$SCRIPT_DIR/opencode-json-to-md.py" "$CONT_FILE" | awk -v fm="$FRONTMATTER" 'NR==1{printf "%s\n", fm} 1' > "$ARTIFACT_PATH" 2>/dev/null; then
            echo "=== LEGACY: Strategy B PASS ===" >&2
            EXIT_CODE=0
            rm -f "$OUTPUT_FILE"
            OUTPUT_FILE="$CONT_FILE"
            REPORT_DIR="$SKILL_DIR/.aic/tasks/$TASK_ID/reports"
            mkdir -p "$REPORT_DIR"
            ARTIFACT_PATH="$REPORT_DIR/${WORKER}-output.md"
          else
            echo "=== LEGACY: Strategy B extraction failed — failing worker ===" >&2
            rm -f "$ARTIFACT_PATH" 2>/dev/null || true; ARTIFACT_PATH=""; EXIT_CODE=1
            rm -f "$CONT_FILE"
          fi
        else
          echo "=== LEGACY: Strategy B continue no output — failing worker ===" >&2
          rm -f "$ARTIFACT_PATH" 2>/dev/null || true; ARTIFACT_PATH=""; EXIT_CODE=1
        fi
        rm -f "$CONT_RUNNER" 2>/dev/null || true
      else
        echo "=== LEGACY: extraction failed (no session for continue) — failing worker, NOT dumping raw NDJSON ===" >&2
        rm -f "$ARTIFACT_PATH" 2>/dev/null || true; ARTIFACT_PATH=""; EXIT_CODE=1
      fi
    fi
    # FIX-019: Planning post-gen gate after PM repair respawn (one regen, no PM)
    if [[ "${AIC_PM_REPAIR:-}" == "1" && "${AIC_PIPELINE_PHASE:-}" == "PLANNING" ]]; then
      case "$WORKER" in pm|architect|research)
        CTXF="${AIC_CONTEXT_FILE:-$SKILL_DIR/.aic/tasks/$TASK_ID/context.json}"
        if [[ -f "$ARTIFACT_PATH" && -f "$CTXF" ]]; then
          if ! python3 "$SCRIPT_DIR/planning-post-gen-gate.py" check "$WORKER" "$ARTIFACT_PATH" "$CTXF" 2>/dev/null; then
            echo "=== FIX-019: planning gate FAIL — one regeneration ===" >&2
            node "$NODE_RUNNER" "$PROMPT_FILE" "$MODEL" "$PROJECT_DIR" "$TIMEOUT" "$OUTPUT_FILE" || true
            if [[ -f "$OUTPUT_FILE" ]]; then
              if ! python3 "$SCRIPT_DIR/opencode-json-to-md.py" "$OUTPUT_FILE" | awk -v fm="$FRONTMATTER" 'NR==1{printf "%s\n", fm} 1' > "$ARTIFACT_PATH" 2>/dev/null; then
                echo "=== LEGACY: extraction failed on regen — failing worker ===" >&2
                rm -f "$ARTIFACT_PATH" 2>/dev/null || true
                ARTIFACT_PATH=""
                EXIT_CODE=1
              fi
            fi
          fi
        fi
        ;;
      esac
    fi
  fi
  rm -f "$NODE_RUNNER" 2>/dev/null || true
  rm -f "$OUTPUT_FILE"
fi

[[ "${CLEANUP_PROMPT:-false}" == true ]] && rm -f "$PROMPT_FILE"

FINAL_EXIT="$EXIT_CODE" FINAL_PATH="$ARTIFACT_PATH" COMPLETE_PAYLOAD=$(jq -n --argjson ec "${FINAL_EXIT:-0}" --arg ap "${FINAL_PATH:-}" '{exitCode:$ec, artifactPath:$ap}')
if ! curl_api -X POST "$API_URL/api/runtime/lease/${LEASE_ID}/complete" \
  -H "Content-Type: application/json" \
  -d "$COMPLETE_PAYLOAD" > /dev/null 2>&1; then
  echo "WARN: Lease completion API call failed for $LEASE_ID" >&2
fi

[[ -n "${OUTPUT_FILE:-}" ]] && rm -f "$OUTPUT_FILE"

if [[ $EXIT_CODE -eq 0 ]]; then
  echo "=== $WORKER completed (lease reported) ==="
else
  echo "=== $WORKER failed (exit $EXIT_CODE) ===" >&2
fi
exit $EXIT_CODE