#!/usr/bin/env bash
# project-manager.sh — Multi-project Management for AIC
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REGISTRY="$SKILL_DIR/.aic/projects.json"
ACTION="${1:?Usage: project-manager.sh <action> [args]}"
ARG="${2:-}"; ARG2="${3:-}"

[[ -f "$REGISTRY" ]] || echo '[]' > "$REGISTRY"

case "$ACTION" in
  register)
    NAME="${ARG:?Missing project name}"; DIR="${ARG2:-$PWD}"
    ID="proj-$(date +%s)-$$"
    python3 - "$REGISTRY" "$ID" "$NAME" "$DIR" << 'PYEOF'
import json, sys
f, pid, name, d = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
projects = json.load(open(f))
projects.append({"id": pid, "name": name, "dir": d, "status": "active", "created_at": __import__("time").time()})
json.dump(projects, open(f, "w"), indent=2)
print(f"Registered: {pid} ({name})")
PYEOF
    ;;
  list)
    python3 - "$REGISTRY" << 'PYEOF'
import json, sys
projects = json.load(open(sys.argv[1]))
for p in projects:
    print(f"  {p['id']}  {p['status']:8s}  {p['name']}  {p['dir']}")
PYEOF
    ;;
  select)
    ID="${ARG:?Missing project ID}"
    python3 - "$REGISTRY" "$ID" "$SKILL_DIR/.aic/active-project.json" << 'PYEOF'
import json, sys
rid, pid, apf = sys.argv[1], sys.argv[2], sys.argv[3]
projects = json.load(open(rid))
found = [p for p in projects if p["id"] == pid]
if not found:
    print(f"Error: project {pid} not found"); sys.exit(1)
p = found[0]
ap = {"project_dir": p["dir"], "task_type": "feature", "timestamp": __import__("time").time(), "branch": "main", "project_id": p["id"]}
json.dump(ap, open(apf, "w"), indent=2)
print(f"Selected: {pid} ({p['name']})")
PYEOF
    ;;
  archive)
    ID="${ARG:?Missing project ID}"
    python3 - "$REGISTRY" "$ID" << 'PYEOF'
import json, sys
rid, pid = sys.argv[1], sys.argv[2]
projects = json.load(open(rid))
for p in projects:
    if p["id"] == pid:
        p["status"] = "archived"; print(f"Archived: {pid}"); break
else:
    print(f"Error: project {pid} not found"); sys.exit(1)
json.dump(projects, open(rid, "w"), indent=2)
PYEOF
    ;;
  status)
    python3 - "$SKILL_DIR/.aic/active-project.json" << 'PYEOF'
import json, sys
ap = json.load(open(sys.argv[1]))
print(f"Active: {ap.get('project_id', 'none')}  dir={ap['project_dir']}  branch={ap.get('branch','main')}")
PYEOF
    ;;
  *)
    echo "ERROR: Unknown action '$ACTION'" >&2; exit 1
    ;;
esac
