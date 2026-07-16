#!/usr/bin/env bash
# knowledge-index.sh — Knowledge Indexing (H-2)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REGISTRY="$SKILL_DIR/.aic/knowledge/registry.json"
INDEX="$SKILL_DIR/.aic/knowledge/index.json"
mkdir -p "$(dirname "$REGISTRY")"

ACTION="${1:?}"
FIELD="${2:-}"

# Validate inputs: prevent injection
if [[ -n "$FIELD" && ! "$FIELD" =~ "^[a-zA-Z0-9._:/@ -]+$" ]]; then
    echo "ERROR: Invalid characters in FIELD" >&2
    exit 1
fi

# Sanitize user input for safe interpolation into Python heredoc strings
FIELD="${FIELD//\\/\\\\}"; FIELD="${FIELD//\"/\\\"}"

case "$ACTION" in
  rebuild)
    [ -f "$REGISTRY" ] || { echo "  No registry found"; exit 1; }
    python3 << PYEOF
import json
reg = json.load(open("$REGISTRY"))
idx = {"by_type": {}, "by_tag": {}, "by_worker": {}, "by_status": {}}
total = 0
for a in reg["artifacts"].values():
    total += 1
    idx["by_type"].setdefault(a["type"], []).append(a["id"])
    idx["by_status"].setdefault(a["status"], []).append(a["id"])
    idx["by_worker"].setdefault(a.get("created_by", "unknown"), []).append(a["id"])
    for tag in a.get("tags", []): idx["by_tag"].setdefault(tag, []).append(a["id"])
json.dump(idx, open("$INDEX", "w"), indent=2)
print("  Indexed %d artifacts" % total)
print("  Types: %s" % list(idx["by_type"].keys()))
print("  Tags: %s" % list(idx["by_tag"].keys()))
PYEOF
    ;;
  query)
    [ -f "$INDEX" ] || { echo "  No index found — run rebuild first"; exit 1; }
    VALUE="${3:-}"
    VALUE="${VALUE//\\/\\\\}"; VALUE="${VALUE//\"/\\\"}"
    [ -z "$FIELD" ] && { echo "  Usage: knowledge-index.sh query <type|tag|status> <value>"; exit 1; }
    python3 << PYEOF
import json
idx = json.load(open("$INDEX"))
section = idx.get("by_" + "$FIELD", {})
ids = section.get("$VALUE", [])
print("  %s=%s: %d artifacts" % ("$FIELD", "$VALUE", len(ids)))
for i in ids: print("    - %s" % i)
PYEOF
    ;;
  stats)
    [ -f "$INDEX" ] || { echo "  No index found — run rebuild first"; exit 1; }
    python3 << PYEOF
import json
idx = json.load(open("$INDEX"))
print("  Types: %d (%s)" % (len(idx["by_type"]), list(idx["by_type"].keys())))
print("  Tags: %d (%s)" % (len(idx["by_tag"]), list(idx["by_tag"].keys())))
print("  Workers: %d (%s)" % (len(idx["by_worker"]), list(idx["by_worker"].keys())))
print("  Statuses: %d (%s)" % (len(idx["by_status"]), list(idx["by_status"].keys())))
total = len(set(i for ids in idx["by_type"].values() for i in ids))
print("  Total artifacts: %d" % total)
PYEOF
    ;;
  *)
    echo "Usage: knowledge-index.sh <rebuild|query|stats>"
    exit 1
    ;;
esac
