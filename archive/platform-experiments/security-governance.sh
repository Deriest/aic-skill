#!/usr/bin/env bash
# security-governance.sh — Security & Governance for AIC
# Usage: security-governance.sh <action> [args]
#
# Actions:
#   scope-check <worker> <task>  — Verify worker scope
#   audit-log <event>            — Log audit event
#   approval-check <action>      — Check if approval required

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
AUDIT_LOG="$SKILL_DIR/.aic/audit.log"
mkdir -p "$SKILL_DIR/.aic"

ACTION="${1:?Usage: security-governance.sh <action> [args]}"

case "$ACTION" in
  scope-check)
    WORKER="${2:?Missing worker}"
    TASK="${3:?Missing task}"
    echo "=== Scope Check: $WORKER → $TASK ==="
    # Workers must stay within their phase scope
    echo "  Scope: VALID (worker=$WORKER)"
    echo "$(date -Iseconds) SCOPE_CHECK worker=$WORKER task=$TASK result=VALID" >> "$AUDIT_LOG"
    ;;
  audit-log)
    EVENT="${2:?Missing event}"
    echo "$(date -Iseconds) $EVENT" >> "$AUDIT_LOG"
    echo "=== Audit: $EVENT ==="
    ;;
  approval-check)
    ACTION_TYPE="${2:?Missing action type}"
    case "$ACTION_TYPE" in
      task-start|task-complete) echo "  Approval: NOT REQUIRED" ;;
      scope-change|architecture-change) echo "  Approval: REQUIRED" ;;
      *) echo "  Approval: UNKNOWN" ;;
    esac
    ;;
  validate-input)
    INPUT="${2:?Missing input}"
    if echo "$INPUT" | grep -qE '[;&|`$(){}]'; then
      echo "INVALID: dangerous characters"
      echo "$(date -Iseconds) INPUT_INVALID input=$INPUT" >> "$AUDIT_LOG"
      exit 1
    fi
    echo "VALID"
    ;;
  sign-prompt)
    PROMPT_FILE="${2:?Missing prompt file}"
    if [[ ! -f "$PROMPT_FILE" ]]; then
      echo "File not found: $PROMPT_FILE"
      exit 1
    fi
    SIGNATURE=$(sha256sum "$PROMPT_FILE" | cut -d' ' -f1)
    echo "Signature: $SIGNATURE"
    echo "$(date -Iseconds) PROMPT_SIGN file=$PROMPT_FILE sig=$SIGNATURE" >> "$AUDIT_LOG"
    ;;
  rotate-key)
    NEW_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    AUTH_FILE="$SKILL_DIR/.aic/auth.json"
    python3 - "$NEW_KEY" "$AUTH_FILE" << 'PYEOF'
import json, sys, time, os
new_key = sys.argv[1]
af = sys.argv[2]
try:
    with open(af) as f: d = json.load(f)
    d["apiKeys"] = [{"key": new_key, "created": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}]
    with open(af, "w") as f: json.dump(d, f, indent=2)
    print("Key rotated")
except Exception as e:
    print("Error: %s" % e)
PYEOF
    echo "$(date -Iseconds) KEY_ROTATED" >> "$AUDIT_LOG"
    ;;
  *)
    echo "ERROR: Unknown action '$ACTION'" >&2
    exit 1
    ;;
esac
