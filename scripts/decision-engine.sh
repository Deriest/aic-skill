#!/usr/bin/env bash
# decision-engine.sh — Dispatcher Decision Engine for AIC
# Usage: decision-engine.sh <task_type> <project_dir>
#
# Routes tasks to appropriate workers based on task type and phase groups.
# Supports Active Project Context, Project Selection, and Session Resume.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
API_URL="${AIC_API_URL:-http://localhost:6868}"

TASK_TYPE="${1:?Usage: decision-engine.sh <task_type> <project_dir>}"
PROJECT_DIR="${2:?Missing project directory}"

# Active Project Context
CONTEXT_FILE="$SKILL_DIR/.aic/active-project.json"
mkdir -p "$SKILL_DIR/.aic"

# Project Selection / Session Resume
if [[ -f "$CONTEXT_FILE" ]]; then
  PREV_PROJECT=$(python3 -c "import json; d=json.load(open('$CONTEXT_FILE')); print(d.get('project_dir',''))" 2>/dev/null || echo "")
  if [[ "$PREV_PROJECT" == "$PROJECT_DIR" ]]; then
    echo "=== Session Resume: $PROJECT_DIR ==="
  else
    echo "=== Project Switch: $PREV_PROJECT → $PROJECT_DIR ==="
  fi
fi

# Save Active Project Context
cat > "$CONTEXT_FILE" << CTX
{
  "project_dir": "$PROJECT_DIR",
  "task_type": "$TASK_TYPE",
  "timestamp": $(date +%s),
  "branch": "$(cd "$PROJECT_DIR" && git branch --show-current 2>/dev/null || echo 'unknown')"
}
CTX

# Decision Table: task_type → phase_groups
case "$TASK_TYPE" in
  feature|bugfix|refactor)
    PHASES=("Investigate:pm,thinker" "Planning:architect,thinker data,thinker integration,thinker infra,crafter security,crafter" "Implementation:backend,crafter frontend,crafter designer,crafter" "Verification:qa,sprinter perf,sprinter" "Closeout:documentation,sprinter governor,sprinter")
    ;;
  research)
    PHASES=("Investigate:pm,thinker research,thinker")
    ;;
  review)
    PHASES=("Verification:qa,sprinter perf,sprinter")
    ;;
  *)
    echo "ERROR: Unknown task type '$TASK_TYPE'" >&2
    exit 1
    ;;
esac

echo "=== Decision Engine: $TASK_TYPE ==="
echo "=== Phases: ${#PHASES[@]} ==="

# Output execution plan
for phase_def in "${PHASES[@]}"; do
  IFS=':' read -r phase workers <<< "$phase_def"
  echo "  Phase: $phase"
  echo "    Workers: $workers"
done

echo ""
echo "=== Execution Plan Ready ==="
