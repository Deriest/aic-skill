#!/usr/bin/env bash
# dispatcher-orchestrator.sh — Multi-dispatcher Management for AIC
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REGISTRY="$SKILL_DIR/.aic/dispatcher-registry.json"
ACTION="${1:?Usage: dispatcher-orchestrator.sh <action> [args]}"
ARG="${2:-}"; ARG2="${3:-}"; ARG3="${4:-}"

[[ -f "$REGISTRY" ]] || echo '[]' > "$REGISTRY"

case "$ACTION" in
  register)
    NAME="${ARG:?Missing dispatcher name}"; PORT="${ARG2:-6868}"
    ID="disp-$(date +%s)-$$"
    python3 - "$REGISTRY" "$ID" "$NAME" "$PORT" << 'PYEOF'
import json, sys, time
regf, did, name, port = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
reg = json.load(open(regf))
reg.append({"id": did, "name": name, "port": int(port), "projects": [], "status": "active", "registered_at": time.time()})
json.dump(reg, open(regf, "w"), indent=2)
print(f"Registered: {did} ({name}) port={port}")
PYEOF
    ;;
  list)
    python3 - "$REGISTRY" << 'PYEOF'
import json, sys
reg = json.load(open(sys.argv[1]))
for d in reg:
    print(f"  {d['id']}  {d['status']:8s}  {d['name']}  port={d['port']}  projects={len(d.get('projects',[]))}")
if not reg:
    print("  No dispatchers registered")
PYEOF
    ;;
  assign)
    DID="${ARG:?Missing dispatcher ID}"; PROJ="${ARG2:?Missing project ID}"
    python3 - "$REGISTRY" "$DID" "$PROJ" << 'PYEOF'
import json, sys
regf, did, pid = sys.argv[1], sys.argv[2], sys.argv[3]
reg = json.load(open(regf))
for d in reg:
    if d["id"] == did:
        if pid not in d.get("projects", []):
            d.setdefault("projects", []).append(pid)
        print(f"Assigned: {pid} → {did}")
        break
else:
    print(f"Error: dispatcher {did} not found"); sys.exit(1)
json.dump(reg, open(regf, "w"), indent=2)
PYEOF
    ;;
  status)
    DID="${ARG:?Missing dispatcher ID}"
    python3 - "$REGISTRY" "$DID" << 'PYEOF'
import json, sys
reg, did = json.load(open(sys.argv[1])), sys.argv[2]
for d in reg:
    if d["id"] == did:
        print(json.dumps(d, indent=2)); break
else:
    print(f"Error: dispatcher {did} not found"); sys.exit(1)
PYEOF
    ;;
  health)
    python3 - "$REGISTRY" << 'PYEOF'
import json, sys, urllib.request
reg = json.load(open(sys.argv[1]))
for d in reg:
    try:
        r = urllib.request.urlopen(f"http://localhost:{d['port']}/health", timeout=2)
        print(f"  {d['id']}: healthy (port {d['port']})")
    except:
        print(f"  {d['id']}: unreachable (port {d['port']})")
if not reg:
    print("  No dispatchers")
PYEOF
    ;;
  *)
    echo "ERROR: Unknown action '$ACTION'" >&2; exit 1
    ;;
esac
