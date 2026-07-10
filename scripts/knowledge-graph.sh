#!/usr/bin/env bash
# knowledge-graph.sh — Knowledge Graph (H-7)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
GRAPH="$SKILL_DIR/.aic/knowledge/graph.json"
mkdir -p "$(dirname "$GRAPH")"
[ -f "$GRAPH" ] || echo '{"nodes":[],"edges":[]}' > "$GRAPH"

ACTION="${1:?}"
ID="${2:-}"

case "$ACTION" in
  add-node)
    TYPE="${3:?Missing node type}"; LABEL="${4:?Missing label}"
    python3 << PYEOF
import json
g = json.load(open("$GRAPH"))
if any(n["id"] == "$ID" for n in g["nodes"]):
    print("  Node $ID already exists")
else:
    g["nodes"].append({"id": "$ID", "type": "$TYPE", "label": "$LABEL"})
    json.dump(g, open("$GRAPH", "w"), indent=2)
    print("  Added node: $ID ($TYPE)")
PYEOF
    ;;
  add-edge)
    TO="${3:?Missing target}"; TYPE="${4:?Missing edge type}"
    python3 << PYEOF
import json
g = json.load(open("$GRAPH"))
g["edges"].append({"from": "$ID", "to": "$TO", "type": "$TYPE"})
json.dump(g, open("$GRAPH", "w"), indent=2)
print("  Added edge: $ID -$TYPE-> $TO")
PYEOF
    ;;
  query)
    python3 << PYEOF
import json
g = json.load(open("$GRAPH"))
related = [e for e in g["edges"] if e["from"] == "$ID" or e["to"] == "$ID"]
print("  Node $ID has %d relationships:" % len(related))
for e in related:
    print("    %s -%s-> %s" % (e["from"], e["type"], e["to"]))
PYEOF
    ;;
  stats)
    python3 << PYEOF
import json
g = json.load(open("$GRAPH"))
print("  Nodes: %d" % len(g["nodes"]))
print("  Edges: %d" % len(g["edges"]))
types = {}
for n in g["nodes"]: types[n["type"]] = types.get(n["type"], 0) + 1
for t, c in types.items(): print("    %s: %d" % (t, c))
PYEOF
    ;;
  *)
    echo "Usage: knowledge-graph.sh <add-node|add-edge|query|stats> ..."
    exit 1
    ;;
esac
