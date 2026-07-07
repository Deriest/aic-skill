#!/usr/bin/env bash
# cache-context.sh — Cache context-gather output for faster worker spawning
# Usage: cache-context.sh <project_dir> <tier>
# Invalidates cache when git HEAD changes

set -euo pipefail

CACHE_DIR="${HOME}/.hermes/skills/workflows/aic/cache"
mkdir -p "$CACHE_DIR"

project_dir="${1:-.}"
tier="${2:-crafter}"

# Create cache key from project path + tier + git HEAD
abs_dir="$(cd "$project_dir" && pwd)"
dir_hash="$(echo "$abs_dir" | md5sum | cut -c1-12)"
git_head="$(cd "$abs_dir" && git rev-parse HEAD 2>/dev/null || echo 'no-git')"
cache_key="${dir_hash}_${tier}_${git_head:0:8}"
cache_file="$CACHE_DIR/${cache_key}.txt"

# Check cache
if [[ -f "$cache_file" ]]; then
  cat "$cache_file"
  exit 0
fi

# Cache miss — generate and store
script_dir="$(cd "$(dirname "$0")" && pwd)"
"$script_dir/context-gather.sh" "$abs_dir" --tier "$tier" > "$cache_file"

# Cleanup old caches for this project (keep last 5)
ls -t "$CACHE_DIR"/"${dir_hash}_${tier}_"*.txt 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true

cat "$cache_file"
