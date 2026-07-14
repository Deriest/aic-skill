#!/usr/bin/env bash
# permissions.sh — RBAC Permission Model for AIC
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PERMS_FILE="$SKILL_DIR/.aic/permissions.json"
ACTION="${1:?Usage: permissions.sh <action> [args]}"
ARG="${2:-}"; ARG2="${3:-}"

[[ -f "$PERMS_FILE" ]] || echo '{"roles":{"admin":["*"],"lead":["project.*","worker.*","audit.*","knowledge.*"],"member":["task.*","artifact.*","knowledge.read"],"viewer":["status.read","metrics.read"]},"users":{}}' > "$PERMS_FILE"

case "$ACTION" in
  assign)
    USER="${ARG:?Missing user}"; ROLE="${ARG2:?Missing role (admin|lead|member|viewer)}"
    python3 - "$PERMS_FILE" "$USER" "$ROLE" << 'PYEOF'
import json, sys
perms, user, role = json.load(open(sys.argv[1])), sys.argv[2], sys.argv[3]
valid = ["admin","lead","member","viewer"]
if role not in valid:
    print(f"Error: invalid role '{role}'. Valid: {valid}"); sys.exit(1)
perms.setdefault("users", {})[user] = role
json.dump(perms, open(sys.argv[1], "w"), indent=2)
print(f"Assigned: {user} → {role}")
PYEOF
    ;;
  revoke)
    USER="${ARG:?Missing user}"
    python3 - "$PERMS_FILE" "$USER" << 'PYEOF'
import json, sys
perms, user = json.load(open(sys.argv[1])), sys.argv[2]
perms.get("users", {}).pop(user, None)
json.dump(perms, open(sys.argv[1], "w"), indent=2)
print(f"Revoked: {user}")
PYEOF
    ;;
  check)
    USER="${ARG:?Missing user}"; ACTION_REQ="${ARG2:?Missing action (e.g. task.execute)}"
    python3 - "$PERMS_FILE" "$USER" "$ACTION_REQ" << 'PYEOF'
import json, sys
perms, user, action = json.load(open(sys.argv[1])), sys.argv[2], sys.argv[3]
role = perms.get("users", {}).get(user, "")
allowed = perms.get("roles", {}).get(role, [])
if "*" in allowed or action in allowed or any(action.startswith(a.rstrip(".*")) for a in allowed if a.endswith(".*")):
    print(f"ALLOWED: {user} ({role}) → {action}")
else:
    print(f"DENIED: {user} ({role}) → {action}"); sys.exit(1)
PYEOF
    ;;
  list-roles)
    python3 - "$PERMS_FILE" << 'PYEOF'
import json, sys
perms = json.load(open(sys.argv[1]))
for role, perms_list in perms.get("roles", {}).items():
    print(f"  {role}: {', '.join(perms_list)}")
PYEOF
    ;;
  list-perms)
    python3 - "$PERMS_FILE" << 'PYEOF'
import json, sys
perms = json.load(open(sys.argv[1]))
for user, role in perms.get("users", {}).items():
    print(f"  {user} → {role}")
PYEOF
    ;;
  *)
    echo "ERROR: Unknown action '$ACTION'" >&2; exit 1
    ;;
esac
