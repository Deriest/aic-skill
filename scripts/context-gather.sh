#!/usr/bin/env bash
# Gather project context into a bounded output for piping into delegate_task.
# Usage: context-gather.sh [project_dir] [--tier thinker|crafter|sprinter] [max_kb]
#
# Tier defaults (unless max_kb override):
#   thinker  = auto (from .env, fallback 128KB)
#   crafter  = auto (from .env, fallback 64KB)
#   sprinter = auto (from .env, fallback 32KB)

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

# Default max_kb per tier — read from .env if available, else fallback
AIC_ENV="$(dirname "$0")/../.env"
if [[ -z "$max_kb" ]]; then
  # Try to read from context limits in .env (set by detect-context.sh via setup.sh)
  if [[ -f "$AIC_ENV" ]]; then
    source "$AIC_ENV" 2>/dev/null || true
  fi
  case "$tier" in
    thinker)  max_kb=${AIC_CTX_THINKER_KB:-128} ;;
    crafter)  max_kb=${AIC_CTX_CRAFTER_KB:-64} ;;
    sprinter) max_kb=${AIC_CTX_SPRINTER_KB:-32} ;;
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
  thinker)  tree_depth=4 ;;
  crafter)  tree_depth=3 ;;
  sprinter) tree_depth=2 ;;
esac

if command -v tree &>/dev/null; then
  output+="=== PROJECT TREE (depth=$tree_depth, tier=$tier) ==="$'\n'
  output+="$(tree -L "$tree_depth" --dirsfirst "$project_dir" 2>/dev/null || echo '(tree unavailable)')"$'\n\n'
elif command -v find &>/dev/null; then
  output+="=== PROJECT TREE (find fallback, tier=$tier) ==="$'\n'
  output+="$(find "$project_dir" -maxdepth "$tree_depth" -type f | sort | head -200 2>/dev/null || echo '(find unavailable)')"$'\n\n'
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
  thinker)  src_lines=500; src_depth=4 ;;
  crafter)  src_lines=300; src_depth=3 ;;
  sprinter) src_lines=150; src_depth=2 ;;
esac

if [[ -d "$project_dir/src" ]]; then
  while IFS= read -r -d '' f; do
    output+="=== src/$(basename "$f") ==="$'\n'
    output+="$(head -n "$src_lines" "$f")"$'\n\n'
  done < <(find "$project_dir/src" -maxdepth "$src_depth" -type f -print0 | sort -z)
fi

# 4. Truncate to max_kb
echo -n "$output" | head -c "$max_bytes"
