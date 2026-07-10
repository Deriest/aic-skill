#!/usr/bin/env bash
# collaboration.sh — Team Collaboration for AIC
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCKS_DIR="$SKILL_DIR/.aic/locks"
ACTION="${1:?Usage: collaboration.sh <action> [args]}"
ARG="${2:-}"; ARG2="${3:-}"

mkdir -p "$LOCKS_DIR"

case "$ACTION" in
  share)
    ARTIFACT="${ARG:?Missing artifact path}"; PROJECT="${ARG2:?Missing project ID}"
    SHARE_DIR="$SKILL_DIR/.aic/shared/$PROJECT"
    mkdir -p "$SHARE_DIR"
    ln -sf "$(realpath "$ARTIFACT")" "$SHARE_DIR/$(basename "$ARTIFACT")" 2>/dev/null || cp "$ARTIFACT" "$SHARE_DIR/"
    echo "Shared: $(basename "$ARTIFACT") → $PROJECT"
    ;;
  lock)
    RESOURCE="${ARG:?Missing resource}"; USER="${ARG2:?Missing user}"
    LOCK_FILE="$LOCKS_DIR/$(echo "$RESOURCE" | tr '/' '_')"
    if [[ -f "$LOCK_FILE" ]]; then
      HOLDER=$(cat "$LOCK_FILE")
      echo "LOCKED by $HOLDER: $RESOURCE"; exit 1
    fi
    echo "$USER" > "$LOCK_FILE"
    echo "Locked: $RESOURCE by $USER"
    ;;
  unlock)
    RESOURCE="${ARG:?Missing resource}"
    LOCK_FILE="$LOCKS_DIR/$(echo "$RESOURCE" | tr '/' '_')"
    [[ -f "$LOCK_FILE" ]] && rm "$LOCK_FILE" && echo "Unlocked: $RESOURCE" || echo "Not locked: $RESOURCE"
    ;;
  status)
    echo "=== Collaboration Status ==="
    ls "$LOCKS_DIR" 2>/dev/null | while read f; do
      echo "  LOCKED: $f by $(cat "$LOCKS_DIR/$f")"
    done
    echo "Shared dirs: $(ls "$SKILL_DIR/.aic/shared/" 2>/dev/null | wc -l)"
    ;;
  *)
    echo "ERROR: Unknown action '$ACTION'" >&2; exit 1
    ;;
esac
