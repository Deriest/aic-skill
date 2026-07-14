#!/usr/bin/env bash
# worker-distributor.sh — Distributed Worker Architecture for AIC
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGETS_FILE="$SKILL_DIR/.aic/worker-targets.json"
ACTION="${1:?Usage: worker-distributor.sh <action> [args]}"
ARG="${2:-}"; ARG2="${3:-}"; ARG3="${4:-}"

[[ -f "$TARGETS_FILE" ]] || echo '[]' > "$TARGETS_FILE"

case "$ACTION" in
  register-target)
    HOST="${ARG:?Missing host}"; USER="${ARG2:-root}"; KEY="${ARG3:-~/.ssh/id_rsa}"
    ID="target-$(date +%s)-$$"
    python3 - "$TARGETS_FILE" "$ID" "$HOST" "$USER" "$KEY" << 'PYEOF'
import json, sys, time
tf, tid, host, user, key = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
targets = json.load(open(tf))
targets.append({"id": tid, "host": host, "user": user, "key_path": key, "status": "registered", "registered_at": time.time()})
json.dump(targets, open(tf, "w"), indent=2)
print(f"Registered: {tid} ({user}@{host})")
PYEOF
    ;;
  list-targets)
    python3 - "$TARGETS_FILE" << 'PYEOF'
import json, sys
targets = json.load(open(sys.argv[1]))
for t in targets:
    print(f"  {t['id']}  {t['status']:10s}  {t['user']}@{t['host']}")
if not targets:
    print("  No targets registered")
PYEOF
    ;;
  spawn-remote)
    TID="${ARG:?Missing target ID}"; PROMPT_FILE="${ARG2:?Missing prompt file}"
    python3 - "$TARGETS_FILE" "$TID" << 'PYEOF'
import json, sys
targets, tid = json.load(open(sys.argv[1])), sys.argv[2]
found = [t for t in targets if t["id"] == tid]
if not found:
    print(f"Error: target {tid} not found"); sys.exit(1)
t = found[0]
print(f"Target: {t['user']}@{t['host']} (key={t['key_path']})")
print("SSH transport: stub (requires SSH key setup)")
PYEOF
    ;;
  health)
    python3 - "$TARGETS_FILE" << 'PYEOF'
import json, sys, subprocess
targets = json.load(open(sys.argv[1]))
for t in targets:
    try:
        subprocess.run(["ssh", "-o", "ConnectTimeout=2", "-o", "StrictHostKeyChecking=no",
                        "-i", t["key_path"], f"{t['user']}@{t['host']}", "echo ok"],
                       capture_output=True, timeout=5, check=True)
        t["status"] = "healthy"
        print(f"  {t['id']}: healthy")
    except:
        t["status"] = "unreachable"
        print(f"  {t['id']}: unreachable")
json.dump(targets, open(sys.argv[1], "w"), indent=2)
PYEOF
    ;;
  *)
    echo "ERROR: Unknown action '$ACTION'" >&2; exit 1
    ;;
esac
