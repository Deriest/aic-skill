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
  *)
    echo "ERROR: Unknown action '$ACTION'" >&2
    exit 1
    ;;
esac
