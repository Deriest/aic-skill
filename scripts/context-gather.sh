#!/usr/bin/env bash
# Gather project context into a bounded output for piping into delegate_task.
# Usage: context-gather.sh [project_dir] [--tier thinker|crafter|sprinter] [max_kb]
#
# Tier defaults (unless max_kb override):
#   thinker  = 32KB (512K context window)
#   crafter  = 16KB (256K context window)
#   sprinter =  8KB (128K context window)

set -euo pipefail

project_dir="."
tier="crafter"
max_kb=""

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tier) tier="$2"; shift 2 ;;
    -*)     echo "Unknown flag: $1" >&2; exit 1 ;;
    *)      project_dir="$1"; shift ;;
  esac
done

# Default max_kb per tier (unless explicitly set)
if [[ -z "$max_kb" ]]; then
  case "$tier" in
    thinker)  max_kb=32 ;;
    crafter)  max_kb=16 ;;
    sprinter) max_kb=8  ;;
    *)        max_kb=16 ;;
  esac
fi

max_bytes=$((max_kb * 1024))

if [[ ! -d "$project_dir" ]]; then
  echo "Error: '$project_dir' is not a directory" >&2
  exit 1
fi

output=""

# 1. Project tree (depth varies by tier)
case "$tier" in
  thinker)  tree_depth=3 ;;
  crafter)  tree_depth=2 ;;
  sprinter) tree_depth=1 ;;
esac

if command -v tree &>/dev/null; then
  output+="=== PROJECT TREE (depth=$tree_depth, tier=$tier) ==="$'\n'
  output+="$(tree -L "$tree_depth" --dirsfirst "$project_dir" 2>/dev/null || echo '(tree unavailable)')"$'\n\n'
fi

# 2. Key root files
for f in "$project_dir"/package.json "$project_dir"/README.md; do
  [[ -f "$f" ]] || continue
  output+="=== $(basename "$f") ==="$'\n'
  output+="$(head -n 200 "$f")"$'\n\n'
done

for f in "$project_dir"/*.md; do
  [[ -f "$f" ]] || continue
  name="$(basename "$f")"
  [[ "$name" == "README.md" ]] && continue
  output+="=== $name ==="$'\n'
  output+="$(head -n 200 "$f")"$'\n\n'
done

# 3. Source files — depth varies by tier
case "$tier" in
  thinker)  src_lines=300; src_depth=3 ;;
  crafter)  src_lines=200; src_depth=2 ;;
  sprinter) src_lines=100; src_depth=1 ;;
esac

if [[ -d "$project_dir/src" ]]; then
  while IFS= read -r -d '' f; do
    output+="=== src/$(basename "$f") ==="$'\n'
    output+="$(head -n "$src_lines" "$f")"$'\n\n'
  done < <(find "$project_dir/src" -maxdepth "$src_depth" -type f -print0 | sort -z)
fi

# 4. Truncate to max_kb
echo -n "$output" | head -c "$max_bytes"
