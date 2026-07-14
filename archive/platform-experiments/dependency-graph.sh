#!/usr/bin/env bash
# dependency-graph.sh — Worker Dependency Graph for AIC
# Usage: dependency-graph.sh <phase> [--json]
#
# Outputs dependency graph for workers in a phase.

set -euo pipefail

PHASE="${1:?Usage: dependency-graph.sh <phase> [--json]}"
OUTPUT_JSON="${2:-}"

# Phase dependency definitions (worker → depends_on)
declare -A DEPS

case "$PHASE" in
  Investigate)
    DEPS[pm]=""
    DEPS[research]="pm"
    ;;
  Planning)
    DEPS[architect]=""
    DEPS[data]="architect"
    DEPS[integration]="architect"
    DEPS[infra]="architect"
    DEPS[security]="architect"
    ;;
  Implementation)
    DEPS[backend]="architect"
    DEPS[frontend]="architect"
    DEPS[designer]="architect"
    ;;
  Verification)
    DEPS[qa]="backend,frontend"
    DEPS[perf]="backend,frontend"
    ;;
  Closeout)
    DEPS[documentation]="qa,perf"
    DEPS[governor]="documentation"
    ;;
  *)
    echo "ERROR: Unknown phase '$PHASE'" >&2
    exit 1
    ;;
esac

if [[ "$OUTPUT_JSON" == "--json" ]]; then
  echo "{"
  echo "  "phase": "$PHASE","
  echo "  "dependencies": {"
  first=true
  for worker in "${!DEPS[@]}"; do
    $first || echo ","
    echo -n "    "$worker": "${DEPS[$worker]}""
    first=false
  done
  echo ""
  echo "  }"
  echo "}"
else
  echo "=== Dependency Graph: $PHASE ==="
  for worker in "${!DEPS[@]}"; do
    dep="${DEPS[$worker]}"
    if [[ -z "$dep" ]]; then
      echo "  $worker → (no dependencies)"
    else
      echo "  $worker → depends on: $dep"
    fi
  done
fi
