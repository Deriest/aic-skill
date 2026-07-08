#!/bin/bash
# context-gather.sh
PROJECT_DIR="${1:-.}"
OUTPUT_FILE="${2:-context.json}"

if [ ! -d "$PROJECT_DIR" ]; then
  echo "{}" > "$OUTPUT_FILE"
  exit 0
fi

cd "$PROJECT_DIR"
FILES_LIST=$(find . -maxdepth 3 -type f -not -path "*/\.*" -not -path "*/node_modules/*" -not -path "*/dist/*" | head -n 50 | tr '\n' ',' | sed 's/,$//')

cat << JSON > "$OUTPUT_FILE"
{
  "project_structure": "$FILES_LIST",
  "note": "Context is gathered natively. No artificial limits."
}
JSON
