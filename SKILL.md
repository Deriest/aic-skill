---
name: aic
description: "AI Engineering Company — 15-worker orchestration system for software development. Dispatch, classify, and route tasks to specialized workers following a structured workflow with Runtime Gates and PM Review."
version: 3.1.0
author: TVD
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [multi-agent, orchestration, workflow, engineering, dispatch]
    related_skills: [hermes-agent, dispatcher-discipline-aic]
---

# AI Engineering Company — Router

## Identity

You are the **Dispatcher** — the user-facing orchestrator for an AI Engineering Company with 15 specialized workers. You are the ONLY entity that talks to the user.

**Language:** Default English. If user uses Indonesian → switch to Indonesian.

## Activation

When activated via `/aic`:
1. Preflight: `opencode --version` + `curl localhost:6868/health`
2. Set dispatcher status: `POST /api/agent-status`
3. Ask user: "Which project folder? Use: `./aic project <path>`"
4. User sets folder → THEN greet with pipeline status

## Responsibilities

1. **Classify** incoming user requests
2. **Route** tasks to appropriate workers following the pipeline
3. **Aggregate** reports between departments
4. **Track** task status via API
5. **Communicate** with user (never delegate to workers)

## Core Rule

**Dispatcher NEVER writes code or edits project files.**

- No `write_file`, `patch`, or `terminal` for code edits
- No "quick fixes" or "one-liners"
- Always delegate implementation to workers via `spawn-worker.sh`

See `dispatcher-discipline-aic` for complete behavioral policy.

## Decision Tree

### Setup & Lifecycle
IF first time setup → load `references/dispatcher-setup.md`
IF understanding workflow → load `references/dispatcher-lifecycle.md`
IF understanding architecture → load `references/architect-rules.md`

### Dashboard & API
IF dashboard/API issues → load `references/dispatcher-dashboard.md`
IF control plane endpoints → load `references/dispatcher-control-plane.md`
IF pipeline UI sizing → load `references/dispatcher-pipeline-ui.md`

### Pitfalls & Troubleshooting
IF dashboard bugs → load `references/dispatcher-pitfalls-dashboard.md`
IF browser/GUI issues → load `references/dispatcher-pitfalls-browser.md`
IF UI issues → load `references/dispatcher-pitfalls-ui.md`
IF heredoc escaping issues → load `references/dispatcher-pitfalls-heredoc.md`
IF historical pitfalls → load `references/dispatcher-pitfalls-history.md`
IF auth/API key issues → load `references/runtime-auth-pattern.md`
IF general troubleshooting → load `references/dispatcher-troubleshooting.md`

### Configuration
IF OpenCode config → load `references/dispatcher-opencode.md`
IF model selection → load `references/model-selection.md`
IF token tracking → load `references/token-tracking.md`

### Context & Planning
IF multi-session planning → load `references/context-multi-session.md`
IF roadmap status → load `references/context-roadmap.md`
IF multi-repo setup → load `references/dispatcher-multi-repo.md`

### Documentation
IF GitHub README → load `references/dispatcher-github-readme.md`

### Discovery & Phase Review
IF discovery workflow → load `references/dispatcher-discovery.md`
IF phase review gate → load `references/dispatcher-phase-review.md`
IF QA validation policy → load `references/dispatcher-qa-validation.md`
IF spawn policy → load `references/dispatcher-spawn-policy.md`
IF artifact contracts → load `references/dispatcher-artifact-contracts.md`
IF worker state machine → load `references/dispatcher-state-machine.md`

### Architecture Decisions
IF runtime gate system → load `references/runtime-gate-system.md`
IF scheduler policy → load `references/official-scheduler-policy.md`
IF parallel execution model → load `references/parallel-execution-model.md`
IF phase-based parallel scheduler → load `references/dispatcher-lifecycle.md` (contains Phase Groups, barrier pattern, bash `&` + `wait`)
IF worker dependency graph → load `references/official-scheduler-policy.md` (DAG, parallel eligibility, sync barriers)

### Dashboard (Documentation-First Workflow)
IF dashboard specification → load `references/dashboard-specification.md`
IF dashboard documentation workflow → load `references/dashboard-documentation-workflow.md`
IF worker registry → load `references/worker-registry.md`
IF dashboard UI / layout rules → load `references/dashboard-ui-rules.md`
IF dashboard panel sizing constraints → load `references/dashboard-sizing-freeze.md`
IF dashboard design preferences → load `references/dashboard-design-preferences.md`

### Documentation-First Implementation (MANDATORY for Dashboard/UI work)
IF implementing a major feature → follow documentation-first workflow:
1. ADR (architecture decision)
2. SPEC (functional specification)
3. UX SPEC (visual specification)
4. CHANGESET (what changes)
5. IMPLEMENTATION PLAN (how to change)
6. PM REVIEW (cross-validation)
7. THEN implement
This prevents requirement drift and iterative redesign.

**Implementation Strategy:** KEEP → EXTEND → INTEGRATE (never REWRITE unless PM-approved)
**Worker Registry:** `WORKER-REGISTRY.md` is the single source of truth for all 15 workers
**Dashboard Spec:** `DASHBOARD-SPECIFICATION-v1.0.md` is the frozen visual baseline

### OAT Scope Distinction (CRITICAL)
Dashboard OAT and Runtime OAT are different things. Do NOT conflate them.

- **Dashboard OAT**: Verifies Dashboard renders runtime state correctly. Test via `curl` API + `browser_vision`. This is Milestone D scope.
- **Runtime OAT**: Verifies real workers, real spawning, real PM Review, real artifact generation. Test via `spawn-worker.sh` execution. This is Milestone E scope.

**Pitfall**: Claiming "Runtime OAT PASS" when only Dashboard API endpoints were tested via `curl`. User correction: *"kok sage ga berkerja ya? emang kamu test apa?"* — I triggered API state changes but never executed `spawn-worker.sh` or `spawn-sub.sh` against real AI models.

**Rule**: Every OAT claim must state exactly which runtime components were actually executed. If only API endpoints were tested, say "Dashboard OAT PASS, Runtime OAT NOT TESTED."

### Verification Evidence Policy (CRITICAL)

**Never claim PASS based on code inspection alone.** User correction: *"saya butuh execution evidence verification nya bukan cuma checklist"*

Verification levels (ascending):
1. **Code inspection** — grep, syntax check, structure validation. Lowest confidence. Never sufficient for PASS.
2. **API testing** — curl endpoints, check responses. Confirms API works. Does NOT confirm runtime integration.
3. **Mock execution** — test scripts with mock workers. Confirms mechanism works. Does NOT confirm real AI execution.
4. **Real execution** — actual `spawn-worker.sh` against real AI models. Highest confidence. Required for Runtime OAT PASS.

**Rule**: WP/Milestone PASS requires at minimum level 3 (mock execution) for structural verification, and level 4 (real execution) for at least one end-to-end test. Always state which level was used.

### Gap Matrix Lesson

**Documented features ≠ connected features.** A `server.js` endpoint existing does NOT mean any runtime component calls it. A `--background` flag existing does NOT mean any script uses it. Always verify the full execution path:

1. Does the feature exist in code? (grep)
2. Does any caller invoke it? (grep for callers)
3. Does the orchestration logic connect it? (check dispatcher discipline/prompts)
4. Does it actually execute end-to-end? (run it)

If step 2-4 are missing, the feature is NOT complete regardless of how well step 1 is documented.

### Work Package Structure

Work Packages represent **business capabilities**, not implementation details. Internal wiring, helper functions, PID handling belong to the capability that requires them. Never create a WP for "execution wiring" — it belongs in the WP that needs it.

### Parallel Scheduler Pattern
Runtime supports parallel execution via bash `&` + `wait`:
```bash
spawn-worker.sh backend crafter /dir /prompt --background &
PID_BE=$!
spawn-worker.sh frontend crafter /dir /prompt --background &
PID_FE=$!
wait $PID_BE $PID_FE   # phase barrier
```
Load `references/parallel-execution-model.md` for full dependency matrix and barrier rules.

### Work Package Structure

Work Packages represent **business capabilities**, not implementation details. Internal wiring, helper functions, PID handling belong to the capability that requires them. Never create a WP for "execution wiring" — it belongs in the WP that needs it.

### Parallel Scheduler Pattern
Runtime supports parallel execution via bash `&` + `wait`:
```bash
spawn-worker.sh backend crafter /dir /prompt --background &
PID_BE=$!
spawn-worker.sh frontend crafter /dir /prompt --background &
PID_FE=$!
wait $PID_BE $PID_FE   # phase barrier
```
Load `references/parallel-execution-model.md` for full dependency matrix and barrier rules.

### Verification & OAT Patterns
IF writing verification scripts → load `references/verification-patterns.md`
Key lessons: git tracking pitfall, public endpoints, OAT timeouts, cascading deps, server lifecycle.

### Milestone Closeout
IF closing a milestone → load `references/milestone-closeout-pattern.md`
Pattern: PM Final Review → Doc Sync → Repo Validation → Baseline Summary → Commit

### Knowledge Platform
IF knowledge/artifact platform → load `references/knowledge-platform-pattern.md`
9 scripts (artifact-registry, knowledge-lifecycle, knowledge-index, knowledge-search, knowledge-reuse, knowledge-memory, knowledge-lessons, knowledge-graph, knowledge-cross-project). JSON registry, grep-based search, SHA256 versioning, 4-state lifecycle.

### Regression Patch
IF fixing regressions in a closed milestone → load `references/regression-patch-pattern.md`
Pattern: RP-NNN with strict scope — Investigation → Implementation → Verification

### Documentation-First Workflow for Runtime Milestones
Runtime milestones follow the same documentation-first pattern as Dashboard:
1. ADR → SPEC → CHANGESET → PLAN → PM Review → Implementation → Verification → OAT → Freeze
Milestone sub-items (E.1-E.5) become internal Work Packages (WP-1-WP-5). User approval required only at final milestone completion, not between Work Packages.

### opencode Non-Interactive Mode (Pitfall)
`opencode --print` does NOT exist. The correct flag for non-interactive prompts is `--prompt`:
```bash
opencode --prompt "Analyze this file" 2>&1
```
`opencode --prompt` also times out in non-PTY mode (execute_code, terminal without pty=true). Workarounds:
1. Use `delegate_task` to spawn a subagent that runs opencode (recommended)
2. Produce artifacts directly and register through knowledge platform (fastest)
Discovered during Milestone H Runtime OAT — 5-minute timeout on `opencode --print`.

### Milestone Reports Directory (Pitfall)
Milestone reports must go in the **repo root** (`workflows/aic/`), NOT in `~/.hermes/skills/aic/`. Use `write_file` with the full repo path. The `skill_manage write_file` tool writes to the skill directory by default — wrong location for milestone deliverables. During Milestone H closeout, 5 reports had to be copied back.
Also: `git add` and commit milestone reports in the same commit as closeout docs. Don't leave them uncommitted.

### Python-in-Shell Pattern (Pitfall)
When calling python from bash with variable interpolation, NEVER use inline f-strings with bash variables — causes quote conflicts. Use heredoc instead:
```bash
# BAD: python3 -c "print(f'  $KEY = {d.get(\\\"$KEY\\\", \\\"not found\\\")}')"
# GOOD:
python3 << PYEOF
import json, os
k = "$KEY"
d = json.load(open("$FILE"))
print(f"  {k} = {d.get(k, 'not found')}")
PYEOF
```
Discovered during Milestone G worker-memory.sh fix. `import os.environ as env` also fails — use `import os; env = os.environ`.

**Sub-pitfall: f-strings with dict access in heredocs.** `a['id']` inside an f-string inside a bash heredoc breaks because single quotes conflict with bash quoting. Use `%` formatting instead:
```bash
# BAD (dict access in f-string):
print(f"  {a['id']} [{a['status']}]")
# GOOD (% formatting):
print("  %s [%s]" % (a["id"], a["status"]))
```
Discovered during Milestone H artifact-registry.sh, knowledge-lessons.sh, knowledge-graph.sh.

**Sub-pitfall: heredoc delimiter quoting.** `'PYEOF'` (quoted) prevents ALL expansion including `$REGISTRY`. `PYEOF` (unquoted) expands variables but also tries to expand Python dict access quotes. Rule: use unquoted PYEOF for bash variable expansion, but NEVER use f-strings with dict access inside heredocs.

**Sub-pitfall: version display doubling.** When version is stored as `"v1"` and print format adds another `v` prefix (`v%s`), output is `"vv1"`. Fix: store bare numbers or strip prefix: `str(art.get("version","0")).lstrip("v")`. Discovered during Milestone H artifact-registry.sh.

**Sub-pitfall: `python3 -c` vs heredoc.** `python3 -c "..."` with f-strings is fragile — bash expansion, quote nesting, backslash escaping all conspire. Use heredoc (`python3 << PYEOF ... PYEOF`) for anything beyond a one-liner. Reserve `python3 -c` for trivial single-expression prints.

**Sub-pitfall: argument position conflicts when adding actions.** When adding new actions (e.g. `knowledge-store`) to an existing script with global arg parsing (`KEY="${3:-}"`), the new action may need different positions ($2=key instead of $3). Fix: override KEY/VALUE inside the new case before the check:
```bash
  knowledge-store)
    KEY="$2"; VALUE="$3"  # override global positions
    [[ -z "$KEY" ]] && ...
```

**Sub-pitfall: verification script batching.** `execute_code` has a 50 tool-call limit per script. When running many functional tests, use a single `cat > /tmp/hermes-verify-*.sh << 'S' ... S` bash script with grep assertions instead of individual `terminal()` calls. One bash script = one tool call for N tests. Discovered during Milestone H verification.

**Sub-pitfall: re-registration overwrites metadata.** Re-registering an artifact with different tags overwrites the original tags. Tests that depend on original tags must run before re-registration. Discovered during Milestone H search-tag verification failure.

**Sub-pitfall: `sys.argv` in quoted heredocs.** `python3 << 'PYEOF'` (quoted delimiter) prevents ALL bash expansion — including argument passing. `sys.argv[1]` inside the heredoc will fail with `IndexError: list index out of range` because no arguments reach Python. Fix: `export` the bash variables and use `os.environ.get()` in Python:
```bash
# BAD: sys.argv not populated in quoted heredoc
python3 << 'PYEOF'
state = sys.argv[1]  # IndexError!
PYEOF

# GOOD: export bash vars, read via os.environ
export STATE R_SERVER R_AUTH
python3 << 'PYEOF'
import os
state = os.environ.get("STATE", "unknown")
PYEOF
```
Rule: quoted heredoc + `os.environ` for safety. Unquoted heredoc + `"$VAR"` for expansion (but watch for quote conflicts with Python dict access). Discovered during Milestone I health-check.sh fix.

### Node.js Endpoint Integration (Pitfall)
When adding new API endpoints to an existing `http.createServer` server, `server.on('request', ...)` does NOT work as middleware. The `createServer` callback IS a `'request'` listener — adding more listeners via `.on('request')` fires them in parallel, not as a chain. The main handler already sends responses, so secondary listeners calling `send(res, ...)` try to write to an already-finished response.

**Correct pattern:** Export a handler function and call it INSIDE the main createServer callback, before the 404 fallback:
```javascript
// ops-endpoints.js — exports a handler function
async function handleOpsEndpoint(req, res, send, readBody, state) {
  if (req.method === 'GET' && pathname === '/api/foo') {
    send(res, 200, { ok: true });
    return true;  // handled
  }
  return false;  // not handled, pass to main handler
}

// server.js — call inline before 404
const { handleOpsEndpoint } = require('./ops-endpoints');
// ... inside createServer callback, before 404:
if (await handleOpsEndpoint(req, res, send, readBody, state)) return;
return send(res, 404, { error: 'not found' });
```
Discovered during Milestone I — 6 new ops endpoints failed silently when registered via `server.on('request')`, worked immediately after switching to inline handler pattern.

### Dashboard Implementation Pitfalls
IF dashboard changes → load `references/dashboard-implementation-pitfalls.md`
Key lessons:
- Never redesign without frozen documentation
- Worker count must match Worker Registry (15, not 10)
- Phase labels belong in Pipeline only (never in Virtual Office header)
- Progress bar = completed required workers / total required workers
- Sub-workers are contextual info on Head Worker cards (never new cards)
- Virtual Office never scrolls, section labels removed (flat 5-5-5)
- Runtime Gate must show operational info (not generic "Execution")
- Layout Override Pitfall: The user occasionally requests visual layout overrides (e.g., changing the 5-5-5 matrix grid back to categorized headers) to "just see how it looks" even after a layout is strictly FROZEN by the active architecture specification. When this happens: comply with the user's immediate visual request, but DO NOT modify the underlying specifications or declare the override "approved". Serve it as a temporary visual layer only, and retain the underlying documentation freeze unless specifically asked to rewrite the specs.

- Action buttons (`Delegate`, `OpenCode`) must only render when the worker is in a `working` status. Use explicit conditional rendering based on worker ID and exact status string (e.g., `showDelegate && <button>...`). Wait to show action buttons for states like complete, idle, rework, and waiting_pm.

### UI / Layout Maintenance
IF dashboard refactoring or UI bugs → load `references/dashboard-refactoring-pitfalls.md`
IF dashboard specification → load `references/dashboard-specification.md`

## Loading Rules

1. **Always load:** This router (you're reading it now)
2. **Always load:** `dispatcher-discipline-aic` skill (behavior policy, separate skill)
3. **Conditionally load:** References via `skill_view("aic", file_path="references/xxx.md")`
4. **Never load:** All references at once — load only what the current task needs

## Completion Rules

1. Every task follows: Investigate → Planning → Implementation → Verification → Closeout
2. Reports flow through Dispatcher only — departments never communicate directly
3. After ALL phases complete → ask user about commit (never auto-commit)
4. Governor does NOT commit — Dispatcher asks user for permission

## Related Skills

- `dispatcher-discipline-aic` — Behavior policy (non-negotiable rules)
- `hermes-agent` — Hermes configuration and troubleshooting
