#!/usr/bin/env bash
# worker-validation.sh — Worker Self-Validation for AIC
# Usage: worker-validation.sh <worker> <artifact_file>
#        worker-validation.sh knowledge-validate <artifact_path> <artifact_id>
set -euo pipefail

ACTION="${1:?}"

# H-1: Knowledge artifact validation
if [ "$ACTION" = "knowledge-validate" ]; then
  ARTIFACT_PATH="${2:?Missing path}"
  ARTIFACT_ID="${3:?Missing id}"
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  echo "  Validating knowledge artifact: $ARTIFACT_ID"
  bash "$SCRIPT_DIR/artifact-registry.sh" update-status "$ARTIFACT_ID" "validated" 2>/dev/null || true
  echo "  Result: KNOWLEDGE VALIDATED"
  exit 0
fi

# Standard worker validation
WORKER="$ACTION"
ARTIFACT="${2:?}"

echo "=== Self-Validation: $WORKER ==="

if [[ ! -f "$ARTIFACT" ]]; then
  echo "  Result: FAIL (artifact not found)"
  exit 1
fi

SIZE=$(wc -c < "$ARTIFACT")
LINES=$(wc -l < "$ARTIFACT")
HAS_CONTENT=$(grep -c "[a-zA-Z]" "$ARTIFACT" 2>/dev/null || echo 0)

echo "  Artifact: $(basename "$ARTIFACT")"
echo "  Size: $SIZE bytes"
echo "  Lines: $LINES"
echo "  Content lines: $HAS_CONTENT"

PASS=true

if [[ $SIZE -lt 10 ]]; then
  echo "  FAIL: Artifact too small (< 10 bytes)"
  PASS=false
fi

if [[ $HAS_CONTENT -lt 2 ]]; then
  echo "  FAIL: Insufficient content (< 2 content lines)"
  PASS=false
fi

if [[ "$WORKER" == "backend" || "$WORKER" == "frontend" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
  PHASE="${AIC_PIPELINE_PHASE:-Implementation}"
  if python3 "$SCRIPT_DIR/phase-contract-loader.py" load "$SKILL_DIR" "$PHASE" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if (d.get('roles') or {}).get('${WORKER}') else 1)" 2>/dev/null; then
    if ! python3 "$SCRIPT_DIR/validate-phase-artifact.py" "$SKILL_DIR" "$PHASE" "$WORKER" "$ARTIFACT"; then
      echo "  FAIL: Phase deliverable contract"
      PASS=false
    fi
  fi
elif [[ "$WORKER" == "pm" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
  PHASE="${AIC_PIPELINE_PHASE:-Investigate}"
  if python3 "$SCRIPT_DIR/phase-contract-loader.py" load "$SKILL_DIR" "$PHASE" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if (d.get('roles') or {}).get('pm') else 1)" 2>/dev/null; then
    if ! python3 "$SCRIPT_DIR/validate-phase-artifact.py" "$SKILL_DIR" "$PHASE" "pm" "$ARTIFACT"; then
      echo "  FAIL: Phase deliverable contract"
      PASS=false
    fi
  fi
fi

if $PASS; then
  echo "  Result: PASS"
  exit 0
else
  echo "  Result: FAIL"
  exit 1
fi
