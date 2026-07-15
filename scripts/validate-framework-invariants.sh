#!/usr/bin/env bash
# validate-framework-invariants.sh — Mechanical Validation Gate (M3 WP-3.3)
# Validates: file existence, H1 heading, minimum word count, provenance metadata
# Usage: validate-framework-invariants.sh <task_dir> <worker1,worker2,...>
set -euo pipefail

TASK_DIR=$1
IFS=',' read -r -a WORKERS <<< "$2"

for w in "${WORKERS[@]}"; do
  ART="$TASK_DIR/reports/$w-output.md"

  # File existence
  if [[ ! -f "$ART" ]]; then
    echo "FAIL: Missing deliverable $w-output.md" >&2
    exit 1
  fi

  # H1 heading
  HAS_H1=$(grep -c "^#" "$ART" 2>/dev/null | tr -d '[:space:]')
  HAS_H1=${HAS_H1:-0}
  if [[ "$HAS_H1" -eq 0 ]]; then
    echo "FAIL: No heading in $w-output.md" >&2
    exit 1
  fi

  # Minimum word count
  WORD_COUNT=$(wc -w < "$ART" 2>/dev/null | tr -d '[:space:]')
  WORD_COUNT=${WORD_COUNT:-0}
  if [[ "$WORD_COUNT" -lt 50 ]]; then
    echo "FAIL: Too short ($WORD_COUNT words) in $w-output.md" >&2
    exit 1
  fi

  # RCA-4: Provenance metadata validation
  HAS_FM=$(head -1 "$ART" 2>/dev/null || echo "")
  if [[ "$HAS_FM" != "---" ]]; then
    echo "FAIL: Missing YAML frontmatter in $w-output.md" >&2
    exit 1
  fi

  # Extract frontmatter block
  FM_CONTENT=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$ART")

  # schema_version
  SCHEMA_VER=$(echo "$FM_CONTENT" | grep -oP '^schema_version:\s*\K.*' || echo "")
  if [[ -z "$SCHEMA_VER" ]]; then
    echo "FAIL: Missing schema_version in $w-output.md frontmatter" >&2
    exit 1
  fi

  # task_id
  FM_TASK_ID=$(echo "$FM_CONTENT" | grep -oP '^task_id:\s*\K.*' || echo "")
  if [[ -z "$FM_TASK_ID" ]]; then
    echo "FAIL: Missing task_id in $w-output.md frontmatter" >&2
    exit 1
  fi

  # worker
  FM_WORKER=$(echo "$FM_CONTENT" | grep -oP '^worker:\s*\K.*' || echo "")
  if [[ -z "$FM_WORKER" ]]; then
    echo "FAIL: Missing worker in $w-output.md frontmatter" >&2
    exit 1
  fi

  # generation
  FM_GENERATION=$(echo "$FM_CONTENT" | grep -oP '^generation:\s*\K\d+' || echo "")
  if [[ -z "$FM_GENERATION" ]]; then
    echo "FAIL: Missing generation in $w-output.md frontmatter" >&2
    exit 1
  fi

  echo "OK: $w-output.md (words=$WORD_COUNT, gen=$FM_GENERATION, schema=$SCHEMA_VER)"
done

exit 0
