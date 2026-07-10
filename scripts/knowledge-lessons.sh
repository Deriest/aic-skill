#!/usr/bin/env bash
# knowledge-lessons.sh — Lessons Learned (H-6)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LESSONS_DIR="$SKILL_DIR/.aic/knowledge/lessons"
mkdir -p "$LESSONS_DIR"
LESSONS_FILE="$LESSONS_DIR/lessons.json"
[ -f "$LESSONS_FILE" ] || echo '{"lessons":[]}' > "$LESSONS_FILE"

ACTION="${1:?}"
TOPIC="${2:-}"

case "$ACTION" in
  capture)
    TYPE="${3:?Missing type}"; DESC="${4:?Missing description}"; WORKER="${5:-system}"
    python3 << PYEOF
import json, time
f = "$LESSONS_FILE"
d = json.load(open(f))
d["lessons"].append({
    "id": "lesson-%03d" % (len(d["lessons"])+1),
    "topic": "$TOPIC", "type": "$TYPE",
    "description": "$DESC", "captured_by": "$WORKER",
    "captured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
    "references": []
})
json.dump(d, open(f, "w"), indent=2)
print("  Captured: $TYPE lesson on $TOPIC")
PYEOF
    ;;
  query)
    python3 << PYEOF
import json
d = json.load(open("$LESSONS_FILE"))
lessons = d["lessons"]
if "$TOPIC": lessons = [l for l in lessons if "$TOPIC" in l["topic"] or "$TOPIC" in l["description"]]
print("  %d lessons found:" % len(lessons))
for l in lessons[-10:]:
    print("    [%s] %s: %s" % (l["type"], l["id"], l["description"][:80]))
PYEOF
    ;;
  list)
    python3 << PYEOF
import json
d = json.load(open("$LESSONS_FILE"))
patterns = [l for l in d["lessons"] if l["type"] == "pattern"]
anti = [l for l in d["lessons"] if l["type"] == "anti-pattern"]
print("  Total: %d (%d patterns, %d anti-patterns)" % (len(d["lessons"]), len(patterns), len(anti)))
for l in d["lessons"][-10:]:
    print("    [%s] %s: %s" % (l["type"], l["topic"], l["description"][:60]))
PYEOF
    ;;
  *)
    echo "Usage: knowledge-lessons.sh <capture|query|list> [topic] [type] [desc] [worker]"
    exit 1
    ;;
esac
