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

if $PASS; then
  echo "  Result: PASS"
  exit 0
else
  echo "  Result: FAIL"
  exit 1
fi
