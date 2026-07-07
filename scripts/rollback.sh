#!/usr/bin/env bash
# rollback.sh — Snapshot and restore files for AIC pipeline safety
# Usage:
#   rollback.sh snapshot <task_id> <file1> [file2] ...
#   rollback.sh restore <task_id>
#   rollback.sh cleanup <task_id>

set -euo pipefail

SNAPSHOT_DIR="${HOME}/.hermes/skills/workflows/aic/snapshots"
mkdir -p "$SNAPSHOT_DIR"

cmd="${1:-help}"
task_id="${2:-}"

case "$cmd" in
  snapshot)
    if [[ -z "$task_id" ]]; then echo "Usage: rollback.sh snapshot <task_id> <files...>"; exit 1; fi
    shift 2
    task_dir="$SNAPSHOT_DIR/$task_id"
    mkdir -p "$task_dir"
    count=0
    for f in "$@"; do
      if [[ -f "$f" ]]; then
        # Preserve directory structure
        rel_path="$f"
        dest="$task_dir/$(echo "$rel_path" | sed 's|/|__|g')"
        cp "$f" "$dest"
        # Store mapping
        echo "$rel_path|$dest" >> "$task_dir/manifest.txt"
        count=$((count + 1))
      fi
    done
    echo "✅ Snapshot: $count files for task $task_id"
    ;;

  restore)
    if [[ -z "$task_id" ]]; then echo "Usage: rollback.sh restore <task_id>"; exit 1; fi
    task_dir="$SNAPSHOT_DIR/$task_id"
    if [[ ! -f "$task_dir/manifest.txt" ]]; then
      echo "⚠️ No snapshot found for task $task_id"
      exit 0
    fi
    count=0
    while IFS='|' read -r orig dest; do
      if [[ -f "$dest" ]]; then
        cp "$dest" "$orig"
        count=$((count + 1))
      fi
    done < "$task_dir/manifest.txt"
    echo "✅ Restored $count files for task $task_id"
    ;;

  cleanup)
    if [[ -z "$task_id" ]]; then echo "Usage: rollback.sh cleanup <task_id>"; exit 1; fi
    task_dir="$SNAPSHOT_DIR/$task_id"
    if [[ -d "$task_dir" ]]; then
      rm -rf "$task_dir"
      echo "✅ Cleaned up snapshot for task $task_id"
    fi
    ;;

  help|*)
    echo "AIC Rollback — Snapshot and restore files"
    echo "Usage:"
    echo "  rollback.sh snapshot <task_id> <file1> [file2] ...  — Save files before edit"
    echo "  rollback.sh restore <task_id>                       — Restore files on failure"
    echo "  rollback.sh cleanup <task_id>                       — Remove snapshot after success"
    ;;
esac
