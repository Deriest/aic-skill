#!/usr/bin/env bash
# health-check.sh — Component Health Checks for AIC
# Usage: health-check.sh <action> [args]
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
HEALTH_FILE="$SKILL_DIR/.aic/health.json"
mkdir -p "$SKILL_DIR/.aic"
ACTION="${1:?Usage: health-check.sh <check|status|history>}"

check_component() {
  local name="$1" cmd="$2"
  if eval "$cmd" >/dev/null 2>&1; then
    echo "$name:healthy"
  else
    echo "$name:unhealthy"
  fi
}

case "$ACTION" in
  check)
    STATE="healthy"; RESULTS="{}"
    check_server() { curl -sf http://localhost:6868/health >/dev/null 2>&1; }
    check_auth() { [[ -f "$SKILL_DIR/.aic/auth.json" ]]; }
    check_knowledge() { if [[ -d "$SKILL_DIR/.aic/knowledge" ]]; then echo "healthy"; else echo "lazy"; fi; }
    check_filesystem() { touch "$SKILL_DIR/.aic/.health_test" && rm -f "$SKILL_DIR/.aic/.health_test"; }
    
    R_SERVER=$(check_component "server" "check_server" | cut -d: -f2)
    R_AUTH=$(check_component "auth" "check_auth" | cut -d: -f2)
    R_KNOWLEDGE=$(check_knowledge)
    R_FS=$(check_component "filesystem" "check_filesystem" | cut -d: -f2)
    
    for r in "$R_SERVER" "$R_AUTH" "$R_KNOWLEDGE" "$R_FS"; do
      [[ "$r" == "unhealthy" ]] && STATE="degraded"
    done
    [[ "$R_SERVER" == "unhealthy" ]] && STATE="unhealthy"
    
    export STATE R_SERVER R_AUTH R_KNOWLEDGE R_FS
    python3 << 'PYEOF'
import json, time, os
hf = os.environ.get("HEALTH_FILE", ".aic/health.json")
state = os.environ.get("STATE", "unknown")
components = {"server": os.environ.get("R_SERVER","unknown"), "auth": os.environ.get("R_AUTH","unknown"), "knowledge": os.environ.get("R_KNOWLEDGE","unknown"), "filesystem": os.environ.get("R_FS","unknown")}
entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "state": state, "components": components}
history = []
try:
    with open(hf) as f: history = json.load(f)
except: pass
history.append(entry)
if len(history) > 100: history = history[-100:]
with open(hf, "w") as f: json.dump(history, f, indent=2)
print("State: %s" % state)
for k, v in components.items():
    print("  %s: %s" % (k, v))
PYEOF
    ;;
  status)
    python3 << 'PYEOF'
import json, os
hf = os.environ.get("HEALTH_FILE", ".aic/health.json")
try:
    with open(hf) as f: h = json.load(f)
    if h:
        latest = h[-1]
        print("State: %s" % latest.get("state", "unknown"))
        for k, v in latest.get("components", {}).items():
            print("  %s: %s" % (k, v))
    else:
        print("No health data")
except:
    print("No health data")
PYEOF
    ;;
  history)
    LIMIT="${2:-10}"
    python3 << 'PYEOF'
import json, os, sys
hf = os.environ.get("HEALTH_FILE", ".aic/health.json")
try:
    with open(hf) as f: h = json.load(f)
    for e in h[-int(sys.argv[1]):]:
        print("%s state=%s" % (e.get("ts","?"), e.get("state","?")))
except:
    print("No health data")
PYEOF
    ;;
  *) echo "Unknown: $ACTION"; exit 1 ;;
esac
