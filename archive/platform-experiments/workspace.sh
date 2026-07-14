#!/usr/bin/env bash
# workspace.sh — Workspace Management for AIC
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WS_DIR="$SKILL_DIR/.aic/workspaces"
ACTION="${1:?Usage: workspace.sh <action> [args]}"
ARG="${2:-}"; ARG2="${3:-}"

mkdir -p "$WS_DIR"

case "$ACTION" in
  create)
    NAME="${ARG:?Missing workspace name}"
    ID="ws-$(date +%s)-$$"
    mkdir -p "$WS_DIR/$ID"
    cat > "$WS_DIR/$ID/config.json" << EOF
{"id":"$ID","name":"$NAME","created_at":$(date +%s),"projects":[]}
EOF
    echo "Created: $ID ($NAME)"
    ;;
  list)
    for d in "$WS_DIR"/*/; do
      [[ -f "$d/config.json" ]] && python3 << 'PYEOF' || true
import json, os
cfg = json.load(open(os.path.join("${d}", "config.json")))
print(f"  {cfg['id']}  {cfg['name']}  projects={len(cfg.get('projects',[]))}")
PYEOF
    done
    ;;
  config)
    ID="${ARG:?Missing workspace ID}"
    [[ -f "$WS_DIR/$ID/config.json" ]] && cat "$WS_DIR/$ID/config.json" || echo "Error: workspace $ID not found"
    ;;
  assign-project)
    WS="${ARG:?Missing workspace ID}"; PROJ="${ARG2:?Missing project ID}"
    python3 - "$WS_DIR/$WS/config.json" "$PROJ" << 'PYEOF'
import json, sys
cfg, pid = json.load(open(sys.argv[1])), sys.argv[2]
if pid not in cfg.get("projects", []):
    cfg.setdefault("projects", []).append(pid)
    json.dump(cfg, open(sys.argv[1], "w"), indent=2)
    print(f"Assigned {pid} to workspace")
else:
    print(f"Project {pid} already in workspace")
PYEOF
    ;;
  delete)
    ID="${ARG:?Missing workspace ID}"
    [[ -d "$WS_DIR/$ID" ]] && rm -rf "$WS_DIR/$ID" && echo "Deleted: $ID" || echo "Error: not found"
    ;;
  *)
    echo "ERROR: Unknown action '$ACTION'" >&2; exit 1
    ;;
esac
