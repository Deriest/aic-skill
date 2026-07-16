#!/usr/bin/env bash
# pipeline-orchestrator.sh — Runtime intent client (TASK-* only, FEAT-001)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
API_URL="${AIC_API_URL:-http://localhost:6868}"

TASK_DESC="${1:?Usage: pipeline-orchestrator.sh <task_description> <project_dir>}"
PROJECT_DIR="${2:?Missing project directory}"

source "$SCRIPT_DIR/api-auth.sh"

log() { echo "[$(date +%H:%M:%S)] $1"; }
fail() { log "PIPELINE FAILED: $1"; exit 1; }

log "=== AIC Pipeline (Runtime Engine) ==="
log "Task: $TASK_DESC"
log "Project: $PROJECT_DIR"

# D-07: ensure project dir exists before workers spawn (opencode fails silently on missing cwd)
mkdir -p "$PROJECT_DIR" || fail "cannot create project dir: $PROJECT_DIR"

export _AIC_TASK_DESC="$TASK_DESC"
export _AIC_PROJECT_DIR="$PROJECT_DIR"
TASK_JSON=$(python3 << 'PYEOF'
import json, os, datetime
desc = os.environ["_AIC_TASK_DESC"]
proj = os.environ["_AIC_PROJECT_DIR"]
d = {
    "title": desc,
    "description": f"Pipeline task: {desc} | Workspace: {proj} | Invoked via pipeline-orchestrator.sh at {datetime.datetime.utcnow().isoformat()}Z",
    "type": "feature",
    "projectDir": proj
}
print(json.dumps(d))
PYEOF
)
RESP=$(curl_api -X POST "$API_URL/api/task-start" -H "Content-Type: application/json" -d "$TASK_JSON" 2>&1) || fail "task-start: $RESP"
TASK_ID=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('taskId') or (d.get('currentTask') or {}).get('id',''))" 2>/dev/null || echo "")
log "Engine started task: ${TASK_ID:-unknown}"
log "Pipeline runs asynchronously in Runtime Engine. Poll GET /api/status for progress."
exit 0
