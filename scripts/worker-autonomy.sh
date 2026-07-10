#!/usr/bin/env bash
# worker-autonomy.sh — Worker Autonomy for AIC
# Usage: worker-autonomy.sh <action> <worker> [args]
#
# Actions:
#   scope <worker>      — Show worker decision scope
#   decide <worker> <task> — Worker makes autonomous decision
#   health <worker>     — Report worker health state
#   available <worker>  — Report worker availability

set -euo pipefail

ACTION="${1:?}"
WORKER="${2:?}"
ARG="${3:-}"

# Decision scope per worker (what they can decide autonomously)
declare -A AUTONOMY_SCOPE
AUTONOMY_SCOPE[pm]="research_direction,tool_selection"
AUTONOMY_SCOPE[research]="source_selection,analysis_method"
AUTONOMY_SCOPE[architect]="design_pattern,technology_choice"
AUTONOMY_SCOPE[data]="schema_design,index_strategy"
AUTONOMY_SCOPE[integration]="api_contract,retry_policy"
AUTONOMY_SCOPE[infra]="deployment_strategy,scaling_policy"
AUTONOMY_SCOPE[security]="auth_method,encryption_choice"
AUTONOMY_SCOPE[backend]="api_implementation,error_handling"
AUTONOMY_SCOPE[frontend]="component_structure,state_management"
AUTONOMY_SCOPE[designer]="layout_decision,color_scheme"
AUTONOMY_SCOPE[qa]="test_strategy,coverage_target"
AUTONOMY_SCOPE[perf]="benchmark_method,optimization_target"
AUTONOMY_SCOPE[documentation]="doc_structure,format_choice"
AUTONOMY_SCOPE[governor]="release_strategy,approval_workflow"

case "$ACTION" in
  scope)
    echo "=== Worker Autonomy: $WORKER ==="
    echo "  Scope: ${AUTONOMY_SCOPE[$WORKER]:-none}"
    echo "  Can decide: within scope boundaries"
    echo "  Cannot decide: cross-worker, cross-phase"
    ;;
  decide)
    TASK="${ARG:?Missing task description}"
    echo "=== $WORKER autonomous decision ==="
    echo "  Task: $TASK"
    echo "  Scope: ${AUTONOMY_SCOPE[$WORKER]:-none}"
    echo "  Decision: PROCEED (within scope)"
    ;;
  health)
    API_URL="${AIC_API_URL:-http://localhost:6868}"
    STATUS=$(curl -sf "$API_URL/api/status" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['workers'].get('$WORKER',{}).get('status','unknown'))" 2>/dev/null || echo "unknown")
    case "$STATUS" in
      working) echo "  Health: DEGRADED (under load)" ;;
      complete) echo "  Health: HEALTHY" ;;
      idle) echo "  Health: HEALTHY" ;;
      *) echo "  Health: UNKNOWN" ;;
    esac
    ;;
  available)
    API_URL="${AIC_API_URL:-http://localhost:6868}"
    STATUS=$(curl -sf "$API_URL/api/status" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['workers'].get('$WORKER',{}).get('status','unknown'))" 2>/dev/null || echo "unknown")
    case "$STATUS" in
      idle) echo "  Availability: AVAILABLE" ;;
      working) echo "  Availability: BUSY" ;;
      complete) echo "  Availability: AVAILABLE" ;;
      *) echo "  Availability: OFFLINE" ;;
    esac
    ;;
  *)
    echo "ERROR: Unknown action '$ACTION'" >&2
    exit 1
    ;;
esac
