#!/usr/bin/env bash
# worker-memory.sh — Worker Memory for AIC
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MEMORY_DIR="$SKILL_DIR/.aic/workers"
mkdir -p "$MEMORY_DIR"

ACTION="${1:?}"
WORKER="${2:?}"
KEY="${3:-}"
VALUE="${4:-}"

MEMORY_FILE="$MEMORY_DIR/$WORKER/memory.json"
mkdir -p "$(dirname "$MEMORY_FILE")"

case "$ACTION" in
  store)
    [[ -z "$KEY" ]] && { echo "ERROR: Missing key"; exit 1; }
    [[ -z "$VALUE" ]] && { echo "ERROR: Missing value"; exit 1; }
    python3 << PYEOF
import json, os
f = os.path.abspath("$MEMORY_FILE")
d = json.load(open(f)) if os.path.exists(f) else {}
d["$KEY"] = "$VALUE"
json.dump(d, open(f, "w"), indent=2)
print(f"  Stored: $KEY = $VALUE")
PYEOF
    ;;
  recall)
    [[ -z "$KEY" ]] && { echo "ERROR: Missing key"; exit 1; }
    python3 << PYEOF
import json, os
f = os.path.abspath("$MEMORY_FILE")
k = "$KEY"
if os.path.exists(f):
    d = json.load(open(f))
    v = d.get(k, "not found")
    print(f"  {k} = {v}")
else:
    print("  No memory found")
PYEOF
    ;;
  list)
    if [[ -f "$MEMORY_FILE" ]]; then
      echo "=== Worker Memory: $WORKER ==="
      python3 << PYEOF
import json
d = json.load(open("$MEMORY_FILE"))
for k, v in d.items():
    print(f"  {k} = {v}")
PYEOF
    else
      echo "  No memory found"
    fi
    ;;
  clear)
    rm -f "$MEMORY_FILE"
    echo "  Memory cleared for $WORKER"
    ;;
  *)
    echo "ERROR: Unknown action '$ACTION'" >&2
    exit 1
    ;;
esac
