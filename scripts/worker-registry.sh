#!/usr/bin/env bash
# worker-registry.sh — Worker Capability Registry for AIC
# Usage: worker-registry.sh <action> [args]
#
# Actions:
#   list                — List all workers
#   capabilities <id>   — Show worker capabilities
#   discover <skill>    — Find workers with skill
#   health              — Show worker health status

set -euo pipefail

ACTION="${1:?Usage: worker-registry.sh <action> [args]}"
ARG="${2:-}"

# Worker registry (mirrors workers.ts)
declare -A WORKER_TIER
declare -A WORKER_PHASE
declare -A WORKER_SECTION

WORKER_TIER[pm]=thinker
WORKER_TIER[research]=thinker
WORKER_TIER[architect]=thinker
WORKER_TIER[data]=thinker
WORKER_TIER[integration]=thinker
WORKER_TIER[infra]=crafter
WORKER_TIER[security]=crafter
WORKER_TIER[backend]=crafter
WORKER_TIER[frontend]=crafter
WORKER_TIER[designer]=crafter
WORKER_TIER[qa]=sprinter
WORKER_TIER[perf]=sprinter
WORKER_TIER[documentation]=sprinter
WORKER_TIER[governor]=sprinter

WORKER_PHASE[pm]=Investigate
WORKER_PHASE[research]=Investigate
WORKER_PHASE[architect]=Planning
WORKER_PHASE[data]=Planning
WORKER_PHASE[integration]=Planning
WORKER_PHASE[infra]=Planning
WORKER_PHASE[security]=Planning
WORKER_PHASE[backend]=Implementation
WORKER_PHASE[frontend]=Implementation
WORKER_PHASE[designer]=Implementation
WORKER_PHASE[qa]=Verification
WORKER_PHASE[perf]=Verification
WORKER_PHASE[documentation]=Closeout
WORKER_PHASE[governor]=Closeout

case "$ACTION" in
  list)
    echo "=== Worker Registry ==="
    for w in "${!WORKER_TIER[@]}"; do
      echo "  $w (tier=${WORKER_TIER[$w]}, phase=${WORKER_PHASE[$w]})"
    done | sort
    ;;
  capabilities)
    [[ -z "$ARG" ]] && { echo "ERROR: Missing worker ID"; exit 1; }
    echo "=== Worker: $ARG ==="
    echo "  Tier: ${WORKER_TIER[$ARG]:-unknown}"
    echo "  Phase: ${WORKER_PHASE[$ARG]:-unknown}"
    ;;
  discover)
    [[ -z "$ARG" ]] && { echo "ERROR: Missing skill/tier"; exit 1; }
    echo "=== Workers with tier=$ARG ==="
    for w in "${!WORKER_TIER[@]}"; do
      [[ "${WORKER_TIER[$w]}" == "$ARG" ]] && echo "  $w"
    done | sort
    ;;
  health)
    echo "=== Worker Health ==="
    API_URL="${AIC_API_URL:-http://localhost:6868}"
    curl -sf "$API_URL/api/status" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
for name,w in sorted(d.get('workers',{}).items()):
    print(f'  {name}: {w.get("status","?")}')
" 2>/dev/null || echo "  API unavailable"
    ;;
  *)
    echo "ERROR: Unknown action '$ACTION'" >&2
    exit 1
    ;;
esac
