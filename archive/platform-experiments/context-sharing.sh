#!/usr/bin/env bash
# context-sharing.sh — Worker-to-Worker Context Sharing
# Usage: context-sharing.sh <action> <from_worker> <to_worker> [data]
#
# Actions:
#   share <from> <to> <data>  — Share context from one worker to another
#   request <from> <to>       — Request context from another worker
#   list <worker>             — List shared contexts for worker

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTEXT_DIR="$SKILL_DIR/.aic/shared-context"
mkdir -p "$CONTEXT_DIR"

ACTION="${1:?}"
FROM="${2:?}"
TO="${3:-}"
DATA="${4:-}"

case "$ACTION" in
  share)
    [[ -z "$TO" ]] && { echo "ERROR: Missing target worker"; exit 1; }
    [[ -z "$DATA" ]] && { echo "ERROR: Missing data"; exit 1; }
    CONTEXT_FILE="$CONTEXT_DIR/${FROM}-to-${TO}.json"
    python3 -c "
import json, os, time
f = '$CONTEXT_FILE'
d = json.load(open(f)) if os.path.exists(f) else {'from': '$FROM', 'to': '$TO', 'contexts': []}
d['contexts'].append({'data': '$DATA', 'timestamp': int(time.time())})
json.dump(d, open(f, 'w'), indent=2)
print(f'  Shared: $FROM → $TO')
" 2>/dev/null || echo "  Error sharing context"
    ;;
  request)
    [[ -z "$TO" ]] && { echo "ERROR: Missing target worker"; exit 1; }
    CONTEXT_FILE="$CONTEXT_DIR/${TO}-to-${FROM}.json"
    if [[ -f "$CONTEXT_FILE" ]]; then
      echo "=== Context from $TO → $FROM ==="
      python3 -c "
import json
d = json.load(open('$CONTEXT_FILE'))
for c in d.get('contexts', []):
    print(f'  {c["data"]} (ts: {c["timestamp"]})')
" 2>/dev/null || echo "  Empty"
    else
      echo "  No context shared"
    fi
    ;;
  list)
    echo "=== Shared Contexts for $FROM ==="
    for f in "$CONTEXT_DIR"/*-to-${FROM}.json; do
      [[ -f "$f" ]] && echo "  $(basename "$f")"
    done
    ;;
  *)
    echo "ERROR: Unknown action '$ACTION'" >&2
    exit 1
    ;;
esac
