# Runtime Scripts Reference

Created during Milestone E (Runtime Core) and Milestone F (Dispatcher Intelligence).

## Milestone E — Runtime Core

| Script | Purpose | Usage |
|--------|---------|-------|
| `phase-runner.sh` | Parallel phase scheduler | `phase-runner.sh <phase> <project_dir> <worker,tier> ...` |
| `pm-review.sh` | PM Review automation | `pm-review.sh <phase> <project_dir> <artifact1> ...` |
| `rework-handler.sh` | REWORK loop | `rework-handler.sh <phase> <project_dir> <max_retries> <worker,tier> ...` |

### phase-runner.sh

Runs all workers in a phase concurrently using bash `&` + `wait`.

- Spawns each worker with `spawn-worker.sh` in background
- Collects PIDs via `$!`
- Waits for all PIDs (phase barrier)
- Reports completion/failure
- Exit 0 = all passed, Exit 1 = some failed

### pm-review.sh

Automates PM Review after phase barrier completes.

- Generates PM Review prompt from artifact files
- Invokes PM via opencode (or mock if unavailable)
- Parses verdict: PASS/REWORK/BLOCKED/UNKNOWN
- Calls `/api/pm-review` with results
- Exit codes: 0=PASS, 1=REWORK, 2=BLOCKED, 3=UNKNOWN, 4=ERROR

### rework-handler.sh

Handles REWORK loop with retry protection.

- Reads PM Review verdict
- Respawns only affected workers via phase-runner.sh
- Collects new artifacts
- Re-runs PM Review
- Enforces max retry count
- Escalates to BLOCKED after limit exceeded

## Milestone F — Dispatcher Intelligence

| Script | Purpose | Usage |
|--------|---------|-------|
| `decision-engine.sh` | Task routing + Active Project Context | `decision-engine.sh <task_type> <project_dir>` |
| `task-decomposer.sh` | Auto-split tasks into work packages | `task-decomposer.sh <task_file> <project_dir>` |
| `dependency-graph.sh` | Worker dependency DAG per phase | `dependency-graph.sh <phase> [--json]` |
| `worker-registry.sh` | Capability registry + discovery | `worker-registry.sh <action> [args]` |
| `dynamic-router.sh` | Escalation + alternatives + retry | `dynamic-router.sh <action> <worker>` |
| `security-governance.sh` | Scope check + audit log | `security-governance.sh <action> [args]` |

### decision-engine.sh

Routes tasks to appropriate workers based on task type.

- Supports task types: feature, bugfix, refactor, research, review
- Saves Active Project Context to `.aic/active-project.json`
- Supports Session Resume (detects previous project)
- Outputs execution plan with phase groups and workers

### dependency-graph.sh

Outputs dependency graph for workers in a phase.

- Supports all 5 phases: Investigate, Planning, Implementation, Verification, Closeout
- Output format: text (default) or JSON (`--json`)
- Shows worker→dependency mapping

### worker-registry.sh

Worker capability registry and discovery.

- Actions: list, capabilities, discover, health
- Mirrors workers.ts definitions
- Supports tier-based discovery (thinker/crafter/sprinter)
- Health check via API

### dynamic-router.sh

Dynamic routing for failure handling.

- Actions: escalate, alternative, retry
- Escalation paths: thinker→sprinter, crafter→thinker
- Alternatives: same-phase workers
- Retry with exponential backoff

### security-governance.sh

Security and governance enforcement.

- Actions: scope-check, audit-log, approval-check
- Scope validation for worker-task pairs
- Audit trail logging
- Approval requirement checking
