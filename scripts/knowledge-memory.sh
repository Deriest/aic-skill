#!/usr/bin/env bash
# knowledge-memory.sh — Semantic Memory (H-5)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MEMORY_DIR="$SKILL_DIR/.aic/knowledge/memory"
mkdir -p "$MEMORY_DIR"
STORE="$MEMORY_DIR/store.json"
[ -f "$STORE" ] || echo '{}' > "$STORE"

ACTION="${1:?}"
KEY="${2:-}"
VALUE="${3:-}"

# Validate inputs: prevent injection
for _v in KEY VALUE; do
    eval "_val="$_v""
    if [[ -n "$_val" && ! "$_val" =~ ^[a-zA-Z0-9._:\ /@+-]+$ ]]; then
        echo "ERROR: Invalid characters in $_v" >&2
        exit 1
    fi
done

# Sanitize user input for safe interpolation into Python heredoc strings
KEY="${KEY//\\/\\\\}"; KEY="${KEY//\"/\\\"}"
VALUE="${VALUE//\\/\\\\}"; VALUE="${VALUE//\"/\\\"}"

case "$ACTION" in
  store)
    [ -z "$KEY" ] && { echo "ERROR: Missing key"; exit 1; }
    [ -z "$VALUE" ] && { echo "ERROR: Missing value"; exit 1; }
    python3 << PYEOF
import json, os, time
d = json.load(open("$STORE"))
d["$KEY"] = {"value": "$VALUE", "stored_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"), "access_count": 0, "tags": []}
json.dump(d, open("$STORE", "w"), indent=2)
print("  Stored: $KEY")
PYEOF
    ;;
  retrieve)
    [ -z "$KEY" ] && { echo "ERROR: Missing key"; exit 1; }
    python3 << PYEOF
import json, os
d = json.load(open("$STORE"))
entry = d.get("$KEY")
if entry:
    entry["access_count"] = entry.get("access_count", 0) + 1
    json.dump(d, open("$STORE", "w"), indent=2)
    print("  %s = %s (accessed %dx)" % ("$KEY", entry["value"], entry["access_count"]))
else:
    print("  Not found: %s" % "$KEY")
PYEOF
    ;;
  list)
    python3 << PYEOF
import json
d = json.load(open("$STORE"))
print("  %d knowledge entries:" % len(d))
for k, v in d.items():
    print("    %s = %s (%d accesses)" % (k, v["value"], v.get("access_count", 0)))
PYEOF
    ;;
  metadata)
    [ -z "$KEY" ] && { echo "ERROR: Missing key"; exit 1; }
    [ -z "$VALUE" ] && { echo "ERROR: Missing tags"; exit 1; }
    python3 << PYEOF
import json
d = json.load(open("$STORE"))
entry = d.get("$KEY")
if entry:
    entry["tags"] = [t.strip() for t in "$VALUE".split(",")]
    json.dump(d, open("$STORE", "w"), indent=2)
    print("  Updated tags for $KEY: %s" % entry["tags"])
else:
    print("  Not found: $KEY")
PYEOF
    ;;
  *)
    echo "Usage: knowledge-memory.sh <store|retrieve|list|metadata> [key] [value]"
    exit 1
    ;;
esac
