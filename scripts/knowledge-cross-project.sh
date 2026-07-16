#!/usr/bin/env bash
# knowledge-cross-project.sh — Cross-project Knowledge (H-8)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
XREF="$SKILL_DIR/.aic/knowledge/cross-project.json"
mkdir -p "$(dirname "$XREF")"
[ -f "$XREF" ] || echo '{"references":[]}' > "$XREF"

ACTION="${1:?}"
ID="${2:-}"
PROJECT="${3:-}"
RELATIONSHIP="${4:-}"

# Validate inputs: prevent injection
for _v in ID PROJECT RELATIONSHIP; do
    eval "_val="$_v""
    if [[ -n "$_val" && ! "$_val" =~ ^[a-zA-Z0-9._:\ /@+-]+$ ]]; then
        echo "ERROR: Invalid characters in $_v" >&2
        exit 1
    fi
done

# Sanitize user input for safe interpolation into Python heredoc strings
ID="${ID//\\/\\\\}"; ID="${ID//\"/\\\"}"
PROJECT="${PROJECT//\\/\\\\}"; PROJECT="${PROJECT//\"/\\\"}"
RELATIONSHIP="${RELATIONSHIP//\\/\\\\}"; RELATIONSHIP="${RELATIONSHIP//\"/\\\"}"

case "$ACTION" in
  add)
    [ -z "$PROJECT" ] && { echo "  Missing target project"; exit 1; }
    [ -z "$RELATIONSHIP" ] && { echo "  Missing relationship"; exit 1; }
    python3 << PYEOF
import json, time
d = json.load(open("$XREF"))
d["references"].append({
    "source_id": "$ID", "target_project": "$PROJECT",
    "relationship": "$RELATIONSHIP",
    "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")
})
json.dump(d, open("$XREF", "w"), indent=2)
print("  Added cross-project ref: %s -> %s (%s)" % ("$ID", "$PROJECT", "$RELATIONSHIP"))
PYEOF
    ;;
  query)
    [ -z "$ID" ] && { echo "  Missing artifact ID"; exit 1; }
    python3 << PYEOF
import json
d = json.load(open("$XREF"))
refs = [r for r in d["references"] if r["source_id"] == "$ID"]
print("  %s has %d cross-project references:" % ("$ID", len(refs)))
for r in refs:
    print("    -> %s (%s)" % (r["target_project"], r["relationship"]))
PYEOF
    ;;
  list)
    python3 << PYEOF
import json
d = json.load(open("$XREF"))
print("  %d cross-project references:" % len(d["references"]))
for r in d["references"]:
    print("    %s -> %s (%s)" % (r["source_id"], r["target_project"], r["relationship"]))
PYEOF
    ;;
  *)
    echo "Usage: knowledge-cross-project.sh <add|query|list> [id] [project] [relationship]"
    exit 1
    ;;
esac
