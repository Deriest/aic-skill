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
f = "$MEMORY_FILE"
d = json.load(open(f)) if os.path.exists(f) else {}
d["$KEY"] = "$VALUE"
json.dump(d, open(f, "w"), indent=2)
print("  Stored: $KEY = $VALUE")
PYEOF
    ;;
  retrieve)
    [[ -z "$KEY" ]] && { echo "ERROR: Missing key"; exit 1; }
    python3 << PYEOF
import json, os
f = "$MEMORY_FILE"
d = json.load(open(f)) if os.path.exists(f) else {}
v = d.get("$KEY")
if v: print("  $KEY = %s" % v)
else: print("  Not found: $KEY")
PYEOF
    ;;
  list)
    python3 << PYEOF
import json, os
f = "$MEMORY_FILE"
d = json.load(open(f)) if os.path.exists(f) else {}
for k, v in d.items(): print("  %s = %s" % (k, v))
PYEOF
    ;;
  knowledge-store)
    K="$2"; V="$3"
    [[ -z "$K" ]] && { echo "ERROR: Missing key"; exit 1; }
    [[ -z "$V" ]] && { echo "ERROR: Missing value"; exit 1; }
    bash "$SCRIPT_DIR/knowledge-memory.sh" store "$K" "$V"
    ;;
  knowledge-retrieve)
    K="$2"
    [[ -z "$K" ]] && { echo "ERROR: Missing key"; exit 1; }
    bash "$SCRIPT_DIR/knowledge-memory.sh" retrieve "$K"
    ;;
  *)
    echo "ERROR: Unknown action '$ACTION'" >&2
    exit 1
    ;;
esac
