#!/usr/bin/env bash
# artifact-registry.sh — Artifact Registration & Versioning (H-1)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REGISTRY="$SKILL_DIR/.aic/knowledge/registry.json"
mkdir -p "$(dirname "$REGISTRY")"

ACTION="${1:?}"
ID="${2:-}"

init_registry() { [ -f "$REGISTRY" ] || echo '{"artifacts":{}}' > "$REGISTRY"; }
compute_hash() { sha256sum "$1" 2>/dev/null | cut -d' ' -f1; }

case "$ACTION" in
  register)
    TYPE="${3:?Missing type}"; TITLE="${4:?Missing title}"; PATH_VAL="${5:?Missing path}"
    WORKER="${6:-system}"; TAGS="${7:-}"
    init_registry
    HASH="sha256:$(compute_hash "$PATH_VAL" 2>/dev/null || echo "none")"
    python3 << PYEOF
import json, os, time
f = "$REGISTRY"
d = json.load(open(f))
art = d["artifacts"].get("$ID", {})
ver = int(str(art.get("version", "0")).lstrip("v")) + 1 if art else 1
d["artifacts"]["$ID"] = {
    "id": "$ID", "type": "$TYPE", "title": "$TITLE",
    "path": "$PATH_VAL", "version": "v" + str(ver), "hash": "$HASH",
    "status": "draft", "created_by": "$WORKER",
    "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
    "tags": [t.strip() for t in "$TAGS".split(",") if t.strip()],
    "metadata": {}
}
json.dump(d, open(f, "w"), indent=2)
print("  Registered: $ID (v" + str(ver) + ", status=draft)")
PYEOF
    ;;
  update-status)
    STATUS="${3:?Missing status}"; init_registry
    python3 << PYEOF
import json
f = "$REGISTRY"
d = json.load(open(f))
art = d["artifacts"].get("$ID")
if not art:
    print("  ERROR: Artifact $ID not found"); exit(1)
old = art["status"]
art["status"] = "$STATUS"
json.dump(d, open(f, "w"), indent=2)
print("  Updated: $ID " + old + " -> $STATUS")
PYEOF
    ;;
  get)
    init_registry
    python3 -c "import json; d=json.load(open('$REGISTRY')); a=d['artifacts'].get('$ID'); print(json.dumps(a,indent=2)) if a else (print('  Not found: $ID'), exit(1))"
    ;;
  list)
    init_registry
    python3 << PYEOF
import json, os
f = "$REGISTRY"
d = json.load(open(f))
for a in d["artifacts"].values():
    print("  %s [%s] %s — %s" % (a["id"], a["status"], a["version"], a["title"]))
PYEOF
    ;;
  query)
    TYPE_FILTER="${2:-}"; STATUS_FILTER="${3:-}"; init_registry
    python3 << PYEOF
import json
d = json.load(open("$REGISTRY"))
for a in d["artifacts"].values():
    if "$TYPE_FILTER" and a["type"] != "$TYPE_FILTER": continue
    if "$STATUS_FILTER" and a["status"] != "$STATUS_FILTER": continue
    print("  %s [%s] %s — %s" % (a["id"], a["status"], a["version"], a["title"]))
PYEOF
    ;;
  *)
    echo "Usage: artifact-registry.sh <register|update-status|get|list|query> ..."
    exit 1
    ;;
esac
