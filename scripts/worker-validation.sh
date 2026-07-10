#!/usr/bin/env bash
# worker-validation.sh — Worker Self-Validation for AIC
# Usage: worker-validation.sh <worker> <artifact_file>
#
# Validates worker output before marking complete.

set -euo pipefail

WORKER="${1:?}"
ARTIFACT="${2:?}"

echo "=== Self-Validation: $WORKER ==="

if [[ ! -f "$ARTIFACT" ]]; then
  echo "  Result: FAIL (artifact not found)"
  exit 1
fi

# Validation checks
SIZE=$(wc -c < "$ARTIFACT")
LINES=$(wc -l < "$ARTIFACT")
HAS_CONTENT=$(grep -c "[a-zA-Z]" "$ARTIFACT" 2>/dev/null || echo 0)

echo "  Artifact: $(basename "$ARTIFACT")"
echo "  Size: $SIZE bytes"
echo "  Lines: $LINES"
echo "  Content lines: $HAS_CONTENT"

PASS=true

# Check minimum size
if [[ $SIZE -lt 10 ]]; then
  echo "  FAIL: Artifact too small (< 10 bytes)"
  PASS=false
fi

# Check has meaningful content
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
