#!/usr/bin/env bash
# phase-runner.sh — Parallel phase under Runtime Engine (no task-status mutation)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SKILL_DIR/.env"
API_URL="${AIC_API_URL:-http://localhost:6868}"

PHASE="${1:?Usage: phase-runner.sh <phase> <project_dir> <worker,tier> ...}"
PROJECT_DIR="${2:?Missing project directory}"
shift 2

if [[ $# -eq 0 ]]; then
  echo "ERROR: No workers specified." >&2
  exit 2
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE" 2>/dev/null || true; set +a
  source "$(dirname "$0")/api-auth.sh"
fi

export AIC_TASK_ID="${AIC_TASK_ID:-}"
export AIC_PIPELINE_PHASE="${AIC_PIPELINE_PHASE:-}"
export AIC_PM_REPAIR="${AIC_PM_REPAIR:-}"
export AIC_PM_VERDICT_FILE="${AIC_PM_VERDICT_FILE:-}"
export AIC_PM_REPAIR_WORKERS="${AIC_PM_REPAIR_WORKERS:-}"
export AIC_CONTEXT_FILE="${AIC_CONTEXT_FILE:-}"
export AIC_REPAIR_ATTEMPT="${AIC_REPAIR_ATTEMPT:-}"
export AIC_EXECUTION_PLAN="${AIC_EXECUTION_PLAN:-}"

# ── Execution Plan injection for downstream PLANNING workers ──
EXECUTION_PLAN_BLOCK=""
SIBLING_ARTIFACTS_BLOCK=""
if [[ "${PHASE,,}" == "planning" && -n "$AIC_TASK_ID" ]]; then
  EXECUTION_PLAN_PATH="$SKILL_DIR/.aic/tasks/$AIC_TASK_ID/reports/execution-plan.md"
  if [[ -f "$EXECUTION_PLAN_PATH" ]] && [[ "${AIC_EXECUTION_PLAN:-}" == "1" || "${AIC_PM_REPAIR:-}" == "1" ]]; then
    EP_WORDS=$(wc -w < "$EXECUTION_PLAN_PATH" 2>/dev/null || echo 0)
    if [[ "$EP_WORDS" -gt 10 ]]; then
      EXECUTION_PLAN_BLOCK=$(cat << EPEOF
EXECUTION PLAN (single source of truth — produced by PM)

You MUST align your output with this execution plan.
Every deliverable, constraint, and acceptance criterion below is mandatory.
Do not contradict the execution plan. If you disagree, explain why in a dedicated section.

$(cat "$EXECUTION_PLAN_PATH")
EPEOF
)
      echo "=== Execution Plan injected into $worker prompt ($EP_WORDS words) ==="
    fi
  fi
fi

# M3 WP-3.1: Canonical Spec injection for Planning phase
CANONICAL_SPEC_BLOCK=""
if [[ "${PHASE,,}" == "planning" && "${AIC_SKIP_SPEC:-0}" != "1" ]]; then
  SPEC_ARTIFACT="$SKILL_DIR/.aic/tasks/$AIC_TASK_ID/reports/spec-output.md"
  if [[ -f "$SPEC_ARTIFACT" ]]; then
    SPEC_WORDS=$(wc -w < "$SPEC_ARTIFACT" 2>/dev/null || echo 0)
    if [[ "$SPEC_WORDS" -gt 10 ]]; then
      CANONICAL_SPEC_BLOCK=$(cat << SPECEOF
CANONICAL SPECIFICATION (frozen — all architectural decisions below are mandatory)

You MUST align your output with every technology choice, directory structure, and constraint listed in this spec.
Do not contradict, override, or substitute any spec decision. If the spec says Tailwind v3, use v3.

$(cat "$SPEC_ARTIFACT")
SPECEOF
)
      echo "=== M3: Canonical Spec injected into Planning prompts ($SPEC_WORDS words) ==="
    else
      echo "=== M3: Canonical Spec too short ($SPEC_WORDS words), skipped ==="
    fi
  else
    echo "=== M3: Canonical Spec not yet generated (skipped) ==="
  fi
fi

TASK_SCOPE=""
PLANNING_AUTHORITY_BLOCK=""
CTX=""
if [[ -n "$AIC_TASK_ID" ]]; then
  CTX="$SKILL_DIR/.aic/tasks/$AIC_TASK_ID/context.json"
  if [[ -f "$CTX" ]]; then
    TASK_SCOPE=$(python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print('Task ID: '+d.get('taskId','')+'\nTitle: '+d.get('title','')+'\nDescription / deliverables:\n'+d.get('description',''))" "$CTX" 2>/dev/null || true)
    if [[ "${PHASE,,}" == "planning" ]]; then
      PLANNING_AUTHORITY_BLOCK=$(python3 -c "
import json, sys
d = json.load(open(sys.argv[1]))
title = d.get('title', '')
desc = d.get('description', '')
print('''CURRENT TASK AUTHORITY

The only work you may plan is the Runtime task described below.
Task Title and Task Description from context.json are authoritative.

Do not rename the task.
Do not expand into another roadmap.
Do not substitute another work package.
Do not plan future epics.
Do not plan architecture outside this task.
If your output is not explicitly about this task, it is incorrect.

Every objective, milestone, acceptance criterion, risk, and dependency must derive from this task only.
If you cannot relate a section to this Runtime task, omit that section.

Your report MUST begin with this exact block (verbatim title and description, no paraphrasing):

## Task Authority (verbatim)
Task Title: ''' + title + '''
Task Description: ''' + desc + '''
''')
" "$CTX" 2>/dev/null || true)
    fi
  fi
fi

TRIVIAL_TASK_BLOCK=""
IMPLEMENTATION_TRIVIAL_BLOCK=""
if [[ -f "${CTX:-}" ]]; then
  TRIVIAL_TASK_BLOCK=$(python3 "$SCRIPT_DIR/trivial-task-prompt.py" classify-and-guidance "$CTX" 2>/dev/null || true)
  if [[ "${PHASE,,}" == "implementation" ]]; then
    if python3 "$SCRIPT_DIR/trivial-task-classifier.py" "$CTX" 2>/dev/null | python3 -c "import sys,json; print('yes' if json.load(sys.stdin).get('trivial') else 'no')" | grep -q yes; then
      IMPLEMENTATION_TRIVIAL_BLOCK=$(python3 "$SCRIPT_DIR/trivial-task-prompt.py" implementation 2>/dev/null || true)
    fi
  fi
fi

echo "=== Phase: $PHASE (task=${AIC_TASK_ID:-none}) ==="
echo "=== Spawning $# workers ==="

declare -A PIDS
for worker_arg in "$@"; do
  IFS=',' read -r worker tier <<< "$worker_arg"
  if [[ -z "$worker" ]] || [[ -z "$tier" ]]; then
    echo "ERROR: Invalid worker format '$worker_arg'." >&2
    exit 2
  fi
  PROMPT_FILE="${TMPDIR:-/tmp}/aic-phase-${AIC_TASK_ID:-none}-${PHASE}-${worker}.txt"
  CONTRACT_BLOCK=$(python3 "$SCRIPT_DIR/phase-contract-loader.py" prompt-block "$SKILL_DIR" "$PHASE" "$worker" 2>/dev/null || true)
  COMPLETION_BLOCK=$("$SCRIPT_DIR/worker-completion-contract.sh")
  PM_REPAIR_BLOCK=""
  if [[ "${AIC_PM_REPAIR:-}" == "1" && -n "${AIC_PM_VERDICT_FILE:-}" && -f "${AIC_PM_VERDICT_FILE}" ]]; then
    if [[ ",${AIC_PM_REPAIR_WORKERS:-}," == *",$worker,"* ]]; then
      PM_REPAIR_BLOCK=$(node "$SCRIPT_DIR/pm-repair-respawn.js" repair-block "$worker" "$AIC_PM_VERDICT_FILE" "${CTX:-${AIC_CONTEXT_FILE:-}}" || true)
    fi
  fi

  # ── Collaborative Repair: inject sibling artifacts for PLANNING repair workers ──
  if [[ "${AIC_PM_REPAIR:-}" == "1" && "${PHASE,,}" == "planning" ]]; then
    SIBLING_ARTIFACTS_BLOCK=""
    REPORT_DIR="$SKILL_DIR/.aic/tasks/$AIC_TASK_ID/reports"
    for sibling_worker in architect research designer; do
      [[ "$sibling_worker" == "$worker" ]] && continue
      sib_art="$REPORT_DIR/${sibling_worker}-output.md"
      if [[ -f "$sib_art" ]]; then
        sib_bytes=$(wc -c < "$sib_art" 2>/dev/null || echo 0)
        if [[ "$sib_bytes" -gt 50 ]]; then
          SIBLING_ARTIFACTS_BLOCK+="
SIBLING ARTIFACT: ${sibling_worker}-output.md (peer worker output you must consider)
$(cat "$sib_art")

"
        fi
      fi
    done
    if [[ -n "$SIBLING_ARTIFACTS_BLOCK" ]]; then
      echo "=== Collaborative Repair: sibling artifacts injected for $worker ==="
    fi
  fi
  RESEARCH_PLANNING_BLOCK=""
  if [[ "${PHASE,,}" == "planning" && "$worker" == "research" && -f "${CTX:-}" ]]; then
    RESEARCH_PLANNING_BLOCK=$(python3 -c "
import json, sys
d = json.load(open(sys.argv[1]))
title = d.get('title', '')
desc = d.get('description', '')
print('''PLANNING RESEARCH DELIVERABLE (mandatory — same CURRENT TASK AUTHORITY as pm/architect)

Your report MUST begin with exactly this structure (verbatim title and description):

# Planning Research

## Task Authority
Task Title: ''' + title + '''
Task Description: ''' + desc + '''

Research findings must support ONLY this Runtime task. Every section must tie directly to the Task Description above.

Forbidden in this report:
- Router roadmap or AIC Router SOTA unrelated to this task
- LangGraph / dynamic-router / generic routing platform planning unless required by the Task Description
- Future epics, memory-layer surveys, orchestrator build-decompose-dispatch, or other work packages
- Any topic you cannot connect in one sentence to the Task Description above

If you cannot relate a finding to this task, omit it.''')
" "$CTX" 2>/dev/null || true)
  fi
  IMPLEMENTATION_SKELETON_BLOCK=""
  if [[ "${PHASE,,}" == "implementation" && ( "$worker" == "backend" || "$worker" == "frontend" ) ]]; then
    IMPLEMENTATION_SKELETON_BLOCK=$(python3 -c "
import subprocess, sys
skill, worker = sys.argv[1], sys.argv[2]
r = subprocess.run(
    [sys.executable, skill + '/scripts/phase-contract-loader.py', 'load', skill, 'Implementation'],
    capture_output=True, text=True, check=False,
)
import json
d = json.loads(r.stdout or '{}')
rc = (d.get('roles') or {}).get(worker) or {}
heads = rc.get('requiredSections') or []
if not heads:
    sys.exit(0)
h1 = heads[0]
label = 'Backend' if worker == 'backend' else 'Frontend'
print(f'''IMPLEMENTATION DELIVERABLE (mandatory — FIX-017)

Your entire output MUST be ONLY the engineering report markdown. No preamble, no planning prose, no architecture survey, no diary, no \"Exploring\" or \"Reading\" narration.

The first line of substantive content MUST be exactly:
{h1}

Use EXACTLY these headings once each (copy character-for-character; no synonyms):
''' + '\\n'.join(heads) + f'''

Forbidden:
- Alternate titles (e.g. \"# {label} Changes\", \"## Files changed\")
- Planning / architect / research content unrelated to code changes in this task
- Tool transcripts or session dumps

Populate every section with real {label.lower()} work for the current task scope.''')
" "$SKILL_DIR" "$worker" 2>/dev/null || true)
  fi
  CLOSEOUT_CONTEXT_BLOCK=""
  if [[ "${PHASE,,}" == "closeout" && -n "${AIC_TASK_ID:-}" ]]; then
    CLOSEOUT_CONTEXT_BLOCK=$(python3 "$SCRIPT_DIR/closeout-context-block.py" "$SKILL_DIR" "$AIC_TASK_ID" "${CTX:-}" 2>/dev/null || true)
  fi

  # ── PM Execution Plan instruction (PM in PLANNING must produce execution-plan.md) ──
  PM_EXECUTION_PLAN_BLOCK=""
  if [[ "${PHASE,,}" == "planning" && "$worker" == "pm" && -n "${AIC_TASK_ID:-}" ]]; then
    EP_REPORTS_DIR="$SKILL_DIR/.aic/tasks/$AIC_TASK_ID/reports"
    PM_EXECUTION_PLAN_BLOCK=$(cat << EPIEOF
MANDATORY DELIVERABLE: execution-plan.md

You MUST produce a file at: ${EP_REPORTS_DIR}/execution-plan.md

Use this exact structure:

# Execution Plan

## Objective
[What this task achieves — one paragraph]

## Scope
[What IS included — bullet list]

## Non-Scope  
[What is explicitly OUT of scope — bullet list]

## Assumptions
[Technical assumptions — bullet list]

## Constraints
[Technical/business constraints — bullet list]

## Deliverables
[Concrete outputs per worker — table: Worker | Deliverable | Acceptance Criteria]

## Risks
[Known risks with mitigation — table: Risk | Impact | Mitigation]

## Acceptance Criteria
[Measurable criteria for task completion — numbered list]

This file is the SINGLE SOURCE OF TRUTH for all downstream workers.
Every worker (architect, research, designer) will read this plan and align their work to it.
Be specific. Be concrete. No vague statements.

ALSO produce your pm-output.md report as usual.
EPIEOF
)
  fi
  cat > "$PROMPT_FILE" << PROMPT
You are the ${worker} for the AIC.
Phase: ${PHASE}
Execute your assigned tasks for this phase.
Project directory: ${PROJECT_DIR}
${PLANNING_AUTHORITY_BLOCK}
${CANONICAL_SPEC_BLOCK}
${PM_EXECUTION_PLAN_BLOCK}
${EXECUTION_PLAN_BLOCK}
${PM_REPAIR_BLOCK}
${SIBLING_ARTIFACTS_BLOCK}
${CLOSEOUT_CONTEXT_BLOCK}
${TASK_SCOPE}
${TRIVIAL_TASK_BLOCK}
${IMPLEMENTATION_TRIVIAL_BLOCK}
${RESEARCH_PLANNING_BLOCK}
${IMPLEMENTATION_SKELETON_BLOCK}
Produce a complete markdown report artifact for this phase. Address only the task scope above.
${CONTRACT_BLOCK}
${COMPLETION_BLOCK}
PROMPT
  echo "  Spawning: $worker (tier=$tier)"
  bash "$SCRIPT_DIR/spawn-worker.sh" "$worker" "$tier" "$PROJECT_DIR" "$PROMPT_FILE" --no-context &
  PID=$!
  PIDS[$PID]=$worker
done

echo ""
echo "=== Phase Barrier: Waiting for ${#PIDS[@]} workers ==="

FAILED_WORKERS=()
for pid in "${!PIDS[@]}"; do
  worker=${PIDS[$pid]}
  if wait "$pid" 2>/dev/null; then
    if [[ -n "$AIC_TASK_ID" ]]; then
      ART="$SKILL_DIR/.aic/tasks/$AIC_TASK_ID/reports/${worker}-output.md"
      if [[ -f "$ART" ]] && ! python3 "$SCRIPT_DIR/validate-phase-artifact.py" "$SKILL_DIR" "$PHASE" "$worker" "$ART"; then
        echo "  ✗ $worker artifact contract failed" >&2
        FAILED_WORKERS+=("$worker")
        continue
      fi
    fi
    echo "  ✓ $worker completed"
  else
    echo "  ✗ $worker failed" >&2
    FAILED_WORKERS+=("$worker")
  fi
done

if [[ ${#FAILED_WORKERS[@]} -eq 0 ]]; then
  echo "=== Phase $PHASE: ALL WORKERS PASSED ==="
  exit 0
fi
echo "=== Phase $PHASE: FAILED: ${FAILED_WORKERS[*]} ===" >&2
exit 1