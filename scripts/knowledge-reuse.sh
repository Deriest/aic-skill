#!/usr/bin/env bash
# knowledge-reuse.sh — Knowledge Reuse (H-4)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REGISTRY="$SKILL_DIR/.aic/knowledge/registry.json"
mkdir -p "$(dirname "$REGISTRY")"

ACTION="${1:?}"
KEYWORD="${2:-}"

# Validate inputs: prevent injection
if [[ -n "$KEYWORD" && ! "$KEYWORD" =~ "^[a-zA-Z0-9._:/@ +-]+$" ]]; then
    echo "ERROR: Invalid characters in KEYWORD" >&2
    exit 1
fi

# Sanitize user input for safe interpolation into Python heredoc strings
KEYWORD="${KEYWORD//\\/\\\\}"; KEYWORD="${KEYWORD//\"/\\\"}"

case "$ACTION" in
  suggest)
    [ -f "$REGISTRY" ] || { echo "  No registry found"; exit 1; }
    python3 << PYEOF
import json
reg = json.load(open("$REGISTRY"))
eligible = [a for a in reg["artifacts"].values() if a["status"] == "approved"]
if not eligible:
    print("  No approved artifacts for reuse")
    exit(0)
scored = []
for a in eligible:
    score = 0
    if "$KEYWORD" and "$KEYWORD" in a.get("title", ""): score += 3
    if "$KEYWORD" and "$KEYWORD" in " ".join(a.get("tags", [])): score += 2
    scored.append((score, a))
scored.sort(key=lambda x: -x[0])
print("  %d approved artifacts available:" % len(scored))
for s, a in scored[:5]:
    print("    [%s] %s — %s (score:%d)" % (a["type"], a["id"], a["title"], s))
PYEOF
    ;;
  eligible)
    [ -f "$REGISTRY" ] || { echo "  No registry found"; exit 1; }
    python3 << PYEOF
import json
reg = json.load(open("$REGISTRY"))
approved = [a for a in reg["artifacts"].values() if a["status"] == "approved"]
print("  %d approved artifacts eligible for reuse:" % len(approved))
for a in approved:
    print("    %s — %s" % (a["id"], a["title"]))
PYEOF
    ;;
  *)
    echo "Usage: knowledge-reuse.sh <suggest|eligible> [keyword]"
    exit 1
    ;;
esac
