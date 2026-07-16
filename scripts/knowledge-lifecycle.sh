#!/usr/bin/env bash
# knowledge-lifecycle.sh — Knowledge Lifecycle State Machine (H-1)
# Transitions: draft→validated→approved→deprecated
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REGISTRY="$SCRIPT_DIR/artifact-registry.sh"
ACTION="${1:?}"
ID="${2:-}"

# Validate ID: allow only safe characters to prevent injection
if [[ -n "$ID" && ! "$ID" =~ ^[a-zA-Z0-9._:-]+$ ]]; then
    echo "ERROR: Invalid characters in artifact ID"
    exit 1
fi

VALID_TRANSITIONS="draft:validated,validated:approved,any:deprecated"

is_valid_transition() {
  local from="$1" to="$2"
  [ "$to" = "deprecated" ] && return 0
  case "$from:$to" in
    draft:validated|validated:approved) return 0 ;;
    *) return 1 ;;
  esac
}

case "$ACTION" in
  validate)
    [[ -z "$ID" ]] && { echo "ERROR: Missing artifact ID"; exit 1; }
    CURRENT=$(bash "$REGISTRY" get "$ID" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "none")
    if is_valid_transition "$CURRENT" "validated"; then
      bash "$REGISTRY" update-status "$ID" "validated"
    else
      echo "  ERROR: Invalid transition $CURRENT→validated"
      exit 1
    fi
    ;;
  approve)
    [[ -z "$ID" ]] && { echo "ERROR: Missing artifact ID"; exit 1; }
    CURRENT=$(bash "$REGISTRY" get "$ID" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "none")
    if is_valid_transition "$CURRENT" "approved"; then
      bash "$REGISTRY" update-status "$ID" "approved"
    else
      echo "  ERROR: Invalid transition $CURRENT→approved"
      exit 1
    fi
    ;;
  deprecate)
    [[ -z "$ID" ]] && { echo "ERROR: Missing artifact ID"; exit 1; }
    bash "$REGISTRY" update-status "$ID" "deprecated"
    ;;
  check)
    [[ -z "$ID" ]] && { echo "ERROR: Missing artifact ID"; exit 1; }
    CURRENT=$(bash "$REGISTRY" get "$ID" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "none")
    echo "  $ID status: $CURRENT"
    ;;
  transitions)
    echo "  Valid transitions: $VALID_TRANSITIONS"
    ;;
  *)
    echo "Usage: knowledge-lifecycle.sh <validate|approve|deprecate|check|transitions> <id>"
    exit 1
    ;;
esac
