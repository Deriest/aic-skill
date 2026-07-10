#!/usr/bin/env bash
# pipeline-orchestrator.sh — End-to-end AIC Pipeline Orchestration
# Usage: pipeline-orchestrator.sh <task_description> <project_dir>
#
# Chains: task-start -> investigate -> planning -> implementation -> verification -> closeout
# Stops on failure. Reports completion.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
API_URL="${AIC_API_URL:-http://localhost:6868}"

TASK_DESC="${1:?Usage: pipeline-orchestrator.sh <task_description> <project_dir>}"
PROJECT_DIR="${2:?Missing project directory}"

KEY=$(python3 -c "import json; print(json.load(open('$SKILL_DIR/.aic/auth.json'))['apiKeys'][0]['key'])" 2>/dev/null || echo "")

api_post() {
  local path="$1" data="$2"
  curl -sf -H "X-API-Key: $KEY" -X POST -H "Content-Type: application/json" -d "$data" "$API_URL$path"
}

api_get() {
  local path="$1"
  curl -sf -H "X-API-Key: $KEY" "$API_URL$path"
}

log() { echo "[$(date +%H:%M:%S)] $1"; }
fail() { log "PIPELINE FAILED: $1"; exit 1; }

log "=== AIC Pipeline Start ==="
log "Task: $TASK_DESC"
log "Project: $PROJECT_DIR"

# Step 1: Task Start
log "--- Task Start ---"
TASK_DATA=$(python3 -c "import json; print(json.dumps({'title': '''$TASK_DESC''', 'type': 'feature'}))")
api_post "/api/task-start" "$TASK_DATA" || fail "task-start"
log "Task started"

# Step 2: Save task state
TASK_ID="task-$(date +%s)"
TASK_DIR="$SKILL_DIR/.aic/tasks/$TASK_ID"
mkdir -p "$TASK_DIR"
python3 -c "import json,time; json.dump({'id':'$TASK_ID','description':'''$TASK_DESC''','project_dir':'$PROJECT_DIR','phase':'investigate','status':'running','started_at':time.time()}, open('$TASK_DIR/state.json','w'), indent=2)"
log "Task state: $TASK_ID"

# Step 3: Execute phases
declare -a PHASES=(investigate planning implementation verification closeout)
declare -A PHASE_WORKERS=(
  [investigate]="pm,thinker"
  [planning]="pm,thinker architect,thinker research,thinker"
  [implementation]="backend,crafter frontend,crafter"
  [verification]="qa,crafter"
  [closeout]="pm,thinker"
)

for PHASE in "${PHASES[@]}"; do
  log "--- Phase: $PHASE ---"
  python3 -c "import json,time; f='$TASK_DIR/state.json'; d=json.load(open(f)); d['phase']='$PHASE'; d['updated_at']=time.time(); json.dump(d,open(f,'w'),indent=2)"

  WORKERS="${PHASE_WORKERS[$PHASE]}"
  IFS=' ' read -ra WORKER_LIST <<< "$WORKERS"
  ARGS=()
  for wt in "${WORKER_LIST[@]}"; do
    ARGS+=("$wt")
  done

  log "  Workers: ${ARGS[*]}"
  bash "$SCRIPT_DIR/phase-runner.sh" "$PHASE" "$PROJECT_DIR" "${ARGS[@]}" || fail "phase $PHASE failed"
  log "  Phase $PHASE: COMPLETE"
done

# Step 4: Knowledge Auto-Update (via task-complete which triggers RP-003.3)
log "--- Knowledge Update ---"
python3 -c "import json,time; f='$TASK_DIR/state.json'; d=json.load(open(f)); d['phase']='knowledge'; d['updated_at']=time.time(); json.dump(d,open(f,'w'),indent=2)"
api_post "/api/task-complete" "{\"taskId\":\"$TASK_ID\"}" || log "  Knowledge trigger: best-effort"
log "  Knowledge: triggered"

# Step 5: Finalize
python3 -c "import json,time; f='$TASK_DIR/state.json'; d=json.load(open(f)); d['phase']='complete'; d['status']='done'; d['completed_at']=time.time(); json.dump(d,open(f,'w'),indent=2)"
log "=== Pipeline COMPLETE: $TASK_ID ==="
