#!/usr/bin/env bash
# task-decomposer.sh — Task Decomposition for AIC
# Usage: task-decomposer.sh <task_description_file> <project_dir>
#
# Splits complex tasks into work packages for parallel execution.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TASK_FILE="${1:?Usage: task-decomposer.sh <task_description_file> <project_dir>}"
PROJECT_DIR="${2:?Missing project directory}"

if [[ ! -f "$TASK_FILE" ]]; then
  echo "ERROR: Task file '$TASK_FILE' not found" >&2
  exit 1
fi

echo "=== Task Decomposer ==="
echo "=== Input: $TASK_FILE ==="

# Read task description
TASK_DESC=$(cat "$TASK_FILE")
TASK_LINES=$(wc -l < "$TASK_FILE")

echo "=== Task size: $TASK_LINES lines ==="

# Decomposition heuristic: split by section headers
WORK_PACKAGES=()
WP_COUNT=0
CURRENT_WP=""
CURRENT_WP_NAME=""

while IFS= read -r line; do
  if [[ "$line" =~ ^##[[:space:]](.+) ]]; then
    if [[ -n "$CURRENT_WP" ]]; then
      WP_COUNT=$((WP_COUNT + 1))
      WP_FILE="${PROJECT_DIR}/.aic/work-packages/WP-${WP_COUNT}-${CURRENT_WP_NAME// /-}.md"
      mkdir -p "$(dirname "$WP_FILE")"
      echo "$CURRENT_WP" > "$WP_FILE"
      WORK_PACKAGES+=("$WP_FILE")
    fi
    CURRENT_WP_NAME="${BASH_REMATCH[1]}"
    CURRENT_WP="$line"
  else
    CURRENT_WP+=$'
'"$line"
  fi
done < "$TASK_FILE"

# Last work package
if [[ -n "$CURRENT_WP" ]]; then
  WP_COUNT=$((WP_COUNT + 1))
  WP_FILE="${PROJECT_DIR}/.aic/work-packages/WP-${WP_COUNT}-${CURRENT_WP_NAME// /-}.md"
  mkdir -p "$(dirname "$WP_FILE")"
  echo "$CURRENT_WP" > "$WP_FILE"
  WORK_PACKAGES+=("$WP_FILE")
fi

echo "=== Decomposed into $WP_COUNT work packages ==="
for wp in "${WORK_PACKAGES[@]}"; do
  echo "  $(basename "$wp")"
done
