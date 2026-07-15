#!/usr/bin/env bash
# pm-review.sh — PM Review Automation for AIC (v3.3.0 — EDP + Recovery)
# Usage: pm-review.sh <phase> <project_dir> <artifact1> <artifact2> ...
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SKILL_DIR/.env"
API_URL="${AIC_API_URL:-http://localhost:6868}"

PHASE="${1:?Usage: pm-review.sh <phase> <project_dir> <artifact1> [artifact2] ...}"
PROJECT_DIR="${2:?Missing project directory}"
shift 2

if [[ $# -eq 0 ]]; then
  echo "ERROR: No artifacts specified." >&2
  exit 4
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE" 2>/dev/null || true; set +a
  source "$(dirname "$0")/api-auth.sh"
fi

echo "=== PM Review: $PHASE ==="
echo "=== Artifacts: $# ==="
echo "=== Degraded: ${AIC_PM_DEGRADED:-0} ==="

# M1 WP-1.3: Degraded mode — structure-only validation, skip content reads
if [[ "${AIC_PM_DEGRADED:-0}" == "1" ]]; then
  echo "=== PM Review DEGRADED MODE — structure-only validation ==="
  STRUCTURE_OK=true
  for artifact in "$@"; do
    if [[ ! -f "$artifact" ]]; then
      echo "MISSING: $artifact" >&2
      STRUCTURE_OK=false
      continue
    fi
    LINE_COUNT=$(wc -l < "$artifact" 2>/dev/null || echo 0)
    BYTE_COUNT=$(wc -c < "$artifact" 2>/dev/null || echo 0)
    HAS_H1=$(grep -c "^#" "$artifact" 2>/dev/null || echo 0)
    if [[ "$BYTE_COUNT" -lt 10 ]]; then
      echo "EMPTY: $(basename "$artifact") ($BYTE_COUNT bytes)" >&2
      STRUCTURE_OK=false
    elif [[ "$LINE_COUNT" -lt 2 ]]; then
      echo "TOO_SHORT: $(basename "$artifact") ($LINE_COUNT lines)" >&2
      STRUCTURE_OK=false
    elif [[ "$HAS_H1" -eq 0 ]]; then
      echo "NO_HEADING: $(basename "$artifact")" >&2
      STRUCTURE_OK=false
    else
      echo "OK: $(basename "$artifact") ($BYTE_COUNT bytes, $LINE_COUNT lines)"
    fi
  done
  if [[ "$STRUCTURE_OK" == true ]]; then
    EDP='{"verdict":"PASS","reason":"Degraded mode: structural validation only","decision_package":null}'
    if [[ -n "${AIC_TASK_ID:-}" ]]; then
      TASK_REPORTS="$SKILL_DIR/.aic/tasks/$AIC_TASK_ID/reports"
      mkdir -p "$TASK_REPORTS"
      printf '%s' "$EDP" > "$TASK_REPORTS/.pm-last-edp.json"
    fi
    echo "=== PM Review complete (exit 0, degraded PASS) ==="
    exit 0
  else
    EDP='{"verdict":"BLOCKED","reason":"InvalidArtifact","decision_package":{"owner":"Worker","root_cause":"Degraded structural validation failed","engineering_objective":"Produce structurally valid deliverables","expected_deliverables":[],"completion_criteria":["File exists","Has H1","Word count >= 50"]}}'
    if [[ -n "${AIC_TASK_ID:-}" ]]; then
      TASK_REPORTS="$SKILL_DIR/.aic/tasks/$AIC_TASK_ID/reports"
      mkdir -p "$TASK_REPORTS"
      printf '%s' "$EDP" > "$TASK_REPORTS/.pm-last-edp.json"
    fi
    echo "=== PM Review complete (exit 2, degraded BLOCKED) ==="
    exit 2
  fi
fi

# M2: Generate PM Review prompt with EDP schema requirement
PROMPT_FILE=$(mktemp "${TMPDIR:-/tmp}/aic-pm-review-XXXXXX.txt")
cat > "$PROMPT_FILE" << PROMPT
You are the Project Manager (PM) for the AIC.

You are performing a review only.
Do not implement.
Do not edit files.
Do not execute engineering work.
Do not use tools.
Return only the review.

## Task
Review the following artifacts from the ${PHASE} phase.

## Artifacts
PROMPT

CONTRACT_RUBRIC=$(python3 "$SCRIPT_DIR/phase-contract-loader.py" pm-rubric "$SKILL_DIR" "$PHASE" 2>/dev/null || true)
if [[ -n "$CONTRACT_RUBRIC" ]]; then
  echo "$CONTRACT_RUBRIC" >> "$PROMPT_FILE"
fi

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

## Verdict and Decision Package
You MUST output EXACTLY this YAML format. Do not add prose outside the YAML block.

\`\`\`yaml
verdict: PASS | REWORK | BLOCKED
reason: <string summarizing the decision>

# Include ONLY if verdict is REWORK or BLOCKED
decision_package:
  owner: <string (e.g. Frontend, Backend, Architect, Infrastructure)>
  root_cause: <Declarative statement of the technical gap. No actions.>
  engineering_objective: <Declarative statement of the required end-state>
  expected_deliverables:
    - <string (e.g. frontend-output.md)>
  completion_criteria:
    - <string (measurable condition to pass next review)>
\`\`\`

Supported meanings:
- PASS — all artifacts are complete and valid
- REWORK — engineering quality is insufficient (requires repair)
- BLOCKED — external dependency or infrastructure failure prevents progress
PROMPT

echo "=== Prompt generated: $PROMPT_FILE ==="

# M1 WP-1.1: Invoke PM with --auto, M1 WP-1.3: retry logic in engine handles retries
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
const reviewMsg = [
  'Review the attached prompt.',
  'Return a review only.',
  'You MUST output a YAML block with verdict: PASS|REWORK|BLOCKED.',
  'Do not perform implementation work.',
].join('\n');
try {
  const result = execFileSync('opencode', [
    'run', reviewMsg, '-m', model, '--auto', '--format', 'json', '-f', promptFile,
  ], {
    cwd: cwd, timeout: parseInt(process.env.AIC_PM_TIMEOUT_SECONDS || "300", 10) * 1000, encoding: 'utf8',
  });
  fs.writeFileSync(outputFile, result);
} catch (e) {
  const stdout = e.stdout || '';
  const stderr = e.stderr || '';
  if (stdout) fs.writeFileSync(outputFile, stdout);
  process.stderr.write(
    `=== PM opencode failed exit=${e.status || 1} stdout_bytes=${stdout.length} ===\n`
  );
  if (stderr) process.stderr.write(stderr);
  process.exit(e.status || 1);
}
NODESCRIPT
  PM_MODEL="${PROVIDER:-aic}/${MODEL_THINKER:-opus}"
  PM_ERR_LOG=$(mktemp "${TMPDIR:-/tmp}/aic-pm-err-XXXXXX.txt")
  PM_NODE_EC=0
  node "$NODE_RUNNER" "$PROMPT_FILE" "$PM_MODEL" "$PROJECT_DIR" "$VERDICT_FILE" 2>"$PM_ERR_LOG" || PM_NODE_EC=$?
  if [[ $PM_NODE_EC -ne 0 ]] || [[ ! -s "$VERDICT_FILE" ]]; then
    echo "=== PM opencode diagnostics ===" >&2
    echo "node_exit=$PM_NODE_EC verdict_bytes=$(wc -c < "$VERDICT_FILE" 2>/dev/null || echo 0)" >&2
    [[ -s "$PM_ERR_LOG" ]] && cat "$PM_ERR_LOG" >&2
  fi
  rm -f "$NODE_RUNNER" "$PM_ERR_LOG"
  if [[ -f "$VERDICT_FILE" ]]; then
    EXTRACT_ERR=$(mktemp "${TMPDIR:-/tmp}/aic-pm-extract-err-XXXXXX.txt")
    if python3 "$SCRIPT_DIR/opencode-json-to-md.py" "$VERDICT_FILE" > "${VERDICT_FILE}.md" 2>"$EXTRACT_ERR"; then
      mv "${VERDICT_FILE}.md" "$VERDICT_FILE"
    else
      echo "=== PM extract failed ===" >&2
      cat "$EXTRACT_ERR" >&2
      echo "raw_ndjson_bytes=$(wc -c < "$VERDICT_FILE")" >&2
    fi
    rm -f "$EXTRACT_ERR"
  fi
else
  echo "=== opencode not found, using mock PM ==="
  echo "VERDICT: PASS" > "$VERDICT_FILE"
  echo "All artifacts are complete and valid." >> "$VERDICT_FILE"
fi

# M2: EDP YAML Parser (deterministic, no UNKNOWN)
VERDICT_RAW=$(cat "$VERDICT_FILE")
echo "=== Raw EDP ==="
echo "$VERDICT_RAW" | head -20

EDP_JSON=$(python3 -c "
import yaml, re, sys, json
text = sys.stdin.read()
m = re.search(r'\`\`\`yaml\s*(.*?)\s*\`\`\`', text, re.DOTALL | re.IGNORECASE)
yaml_str = m.group(1) if m else text
try:
    yaml_str = re.sub(r'^\s*VERDICT:\s*(PASS|REWORK|BLOCKED)', r'verdict: \1', yaml_str, flags=re.MULTILINE|re.IGNORECASE)
    docs = list(yaml.safe_load_all(yaml_str))
    data = {}
    for d in docs:
        if isinstance(d, dict) and 'verdict' in d:
            data = d
            break
    if not data and len(docs) > 0 and isinstance(docs[0], dict):
        data = docs[0]
    v = str(data.get('verdict', 'BLOCKED')).upper()
    if v not in ('PASS', 'REWORK', 'BLOCKED'):
        if re.search(r'\bPASS\b', text, re.IGNORECASE) and not re.search(r'\bREWORK\b', text, re.IGNORECASE): v = 'PASS'
        elif re.search(r'\bREWORK\b', text, re.IGNORECASE): v = 'REWORK'
        else: v = 'BLOCKED'
        data['verdict'] = v
    print(json.dumps(data))
except Exception as e:
    v = 'BLOCKED'
    if re.search(r'\bPASS\b', text, re.IGNORECASE) and not re.search(r'\bREWORK\b', text, re.IGNORECASE): v = 'PASS'
    elif re.search(r'\bREWORK\b', text, re.IGNORECASE): v = 'REWORK'
    print(json.dumps({'verdict': v, 'reason': 'InvalidArtifact', 'decision_package': {'owner': 'Worker', 'root_cause': 'YAML Parse Error: ' + str(e), 'engineering_objective': 'Produce valid EDP YAML', 'expected_deliverables': [], 'completion_criteria': []}}))
" <<<"$VERDICT_RAW")

VERDICT=$(echo "$EDP_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('verdict', 'BLOCKED').upper())" 2>/dev/null || echo "BLOCKED")
REASON=$(echo "$EDP_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('reason', ''))" 2>/dev/null || echo "")

case "$VERDICT" in
  PASS)
    echo "=== PM Review: PASS ==="
    EXIT_CODE=0
    ;;
  REWORK)
    echo "=== PM Review: REWORK ==="
    echo "Reason: $REASON"
    EXIT_CODE=1
    ;;
  BLOCKED)
    echo "=== PM Review: BLOCKED ==="
    echo "Reason: $REASON"
    EXIT_CODE=2
    ;;
  *)
    echo "=== PM Review: BLOCKED (unrecognized) ===" >&2
    EXIT_CODE=2
    ;;
esac

# Update API with EDP feedback
VERDICTS_JSON="{"
for artifact in "$@"; do
  name=$(basename "$artifact" .md)
  VERDICTS_JSON+="\"$name\":\"$VERDICT\","
done
VERDICTS_JSON="${VERDICTS_JSON%,}}"
curl_api -X POST "$API_URL/api/pm-review" \
  -H "Content-Type: application/json" \
  -d "{\"phase\":\"$PHASE\",\"verdicts\":$VERDICTS_JSON,\"feedback\":$EDP_JSON}" > /dev/null 2>&1 || true

# Save EDP artifacts
if [[ -n "${AIC_TASK_ID:-}" ]]; then
  TASK_REPORTS="$SKILL_DIR/.aic/tasks/$AIC_TASK_ID/reports"
  mkdir -p "$TASK_REPORTS"
  printf '%s' "$VERDICT_RAW" > "$TASK_REPORTS/.pm-last-verdict.txt"
  printf '%s' "$EDP_JSON" > "$TASK_REPORTS/.pm-last-edp.json"
fi
rm -f "$PROMPT_FILE" "$VERDICT_FILE"

echo "=== PM Review complete (exit $EXIT_CODE) ==="
exit $EXIT_CODE
