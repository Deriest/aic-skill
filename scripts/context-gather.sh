#!/usr/bin/env bash
# Gather project context into a bounded output for piping into delegate_task.
# Usage: context-gather.sh [project_dir] [max_kb=8]

set -euo pipefail

project_dir="${1:-.}"
max_kb="${2:-8}"
max_bytes=$((max_kb * 1024))

if [[ ! -d "$project_dir" ]]; then
  echo "Error: '$project_dir' is not a directory" >&2
  exit 1
fi

output=""

# 1. Project tree (depth 2)
if command -v tree &>/dev/null; then
  output+="=== PROJECT TREE ==="$'\n'
  output+="$(tree -L 2 --dirsfirst "$project_dir" 2>/dev/null || echo '(tree unavailable)')"$'\n\n'
fi

# 2. Key root files: package.json, README.md, *.md
for f in "$project_dir"/package.json "$project_dir"/README.md; do
  [[ -f "$f" ]] || continue
  output+="=== $(basename "$f") ==="$'\n'
  output+="$(head -n 200 "$f")"$'\n\n'
done

for f in "$project_dir"/*.md; do
  [[ -f "$f" ]] || continue
  name="$(basename "$f")"
  [[ "$name" == "README.md" ]] && continue  # already included
  output+="=== $name ==="$'\n'
  output+="$(head -n 200 "$f")"$'\n\n'
done

# 3. Source files in src/ (first 200 lines each)
if [[ -d "$project_dir/src" ]]; then
  while IFS= read -r -d '' f; do
    output+="=== src/$(basename "$f") ==="$'\n'
    output+="$(head -n 200 "$f")"$'\n\n'
  done < <(find "$project_dir/src" -maxdepth 2 -type f -print0 | sort -z)
fi

# 4. Truncate to max_kb
echo -n "$output" | head -c "$max_bytes"
