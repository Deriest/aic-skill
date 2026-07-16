# Dispatcher Core

> **Consolidated from 8 files.** Originals archived in `references/archive/`.

**Original files merged:**
- `dispatcher-setup.md`
- `dispatcher-state-machine.md`
- `dispatcher-lifecycle.md`
- `dispatcher-discovery.md`
- `dispatcher-control-plane.md`
- `dispatcher-spawn-policy.md`
- `dispatcher-multi-repo.md`
- `dispatcher-artifact-contracts.md`

---

---

## Source: `dispatcher-setup.md`

# AI Engineering Company (AIC) — Setup Guide

## Quick Install

```bash
# 1. Install OpenCode (requires Node.js >= 18)
npm install -g opencode-ai@latest

# 2. Run setup script (auto-detects models from API)
bash ~/.hermes/skills/workflows/aic/scripts/setup.sh
```

## Setup Options

| # | Option | What it does |
|---|--------|-------------|
| 1 | **Connect to API** | URL → API key → auto-fetch /v1/models → pick Thinker/Crafter/Sprinter |
| 2 | **Free models** | No auth, uses deepseek-v4-flash-free (rate-limited) |
| 3 | **Skip** | Manual config |

Option 1 works with **any** OpenAI-compatible API: OpenRouter, Anthropic, OpenAI, local proxies, LiteLLM, etc.

## Setup Flow (Option 1: API)

1. Enter **Base URL** (e.g. `https://openrouter.ai/api/v1` or `http://192.168.2.11:20128/v1`)
2. Enter **API Key**
3. Enter **Provider ID** (short name, e.g. `openrouter`, `tvd`)
4. Script auto-fetches models from `{BASE_URL}/models`
5. Pick 3 models by number:
   - **Thinker** (PM, Architect, complex reasoning) — default: #1
   - **Crafter** (Engineers, standard coding) — default: #2
   - **Sprinter** (QA, fast/lightweight) — default: #3
6. Auto-generates `opencode.jsonc` + `.env`

## Config Files Generated

### `~/.config/opencode/opencode.jsonc`
```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "myprovider": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "myprovider",
      "options": {
        "baseURL": "https://openrouter.ai/api/v1",
        "apiKey": "sk-..."
      },
      "models": {
        "Thinker": { "name": "anthropic/claude-opus-4", "limit": { "context": 800000, "output": 64000 } },
        "Crafter": { "name": "anthropic/claude-sonnet-4", "limit": { "context": 512000, "output": 32000 } },
        "Sprinter": { "name": "anthropic/claude-haiku-3.5", "limit": { "context": 256000, "output": 16000 } }
      }
    }
  }
}
```

**Key:** `Thinker`/`Crafter`/`Sprinter` are OpenCode model keys (used in `--model provider/Thinker`). The `name` field holds the actual API model ID. The `limit` field sets context window + output caps per tier.

## Context Limits Per Tier

| Tier | Context Window | Output | Workers | context-gather.sh |
|------|---------------|--------|---------|-------------------|
| Thinker | 800K tokens | 64K | PM, Architect | `--tier thinker` → 128KB, depth 4 |
| Crafter | 512K tokens | 32K | Engineers, Governor | `--tier crafter` → 64KB, depth 3 |
| Sprinter | 256K tokens | 16K | QA | `--tier sprinter` → 32KB, depth 2 |

Even if the underlying model supports 1M tokens, `limit.context` constrains OpenCode per tier. Thinker gets more room for analysis, Sprinter stays fast.

### `~/.hermes/skills/workflows/aic/.env`
```
PROVIDER_ID=myprovider
MODEL_THINKER=Thinker
MODEL_CRAFTER=Crafter
MODEL_SPRINTER=Sprinter
```

## Usage

```bash
# Via Hermes
/aic
build a REST API for user auth

# Direct OpenCode
opencode run "implement auth" --model myprovider/Crafter
opencode run "design system architecture" --model myprovider/Thinker
opencode run "run tests" --model myprovider/Sprinter
```

## Troubleshooting

| Error | Fix |
|---|---|
| `opencode: command not found` | `npm install -g opencode-ai@latest` |
| `Node.js >= 18 required` | Upgrade Node.js from https://nodejs.org/ |
| `Failed to fetch models` | Check Base URL and API key; script falls back to manual model entry |
| `No active credentials for provider: openai` | Known OpenCode bug with custom providers in `run` mode. Use `delegate_task` as fallback. |
| Config not found | Run `/aic` to complete first-run setup |

---

## Source: `dispatcher-state-machine.md`

# Dispatcher Worker State Machine

## States

| State | Description |
|-------|-------------|
| Idle | Worker available, no task |
| Assigned | Task received, context not loaded |
| Running | Actively executing |
| Waiting | Blocked on external input |
| Blocked | Cannot proceed (missing dependency) |
| Sub-spawn | Head waiting for sub-workers |
| Self-Validation | Checking own output |
| Completed | Artifact generated, handoff ready |
| Failed | Non-recoverable error |
| Cancelled | Task cancelled |

## Transitions

| From | To | Trigger |
|------|----|---------|
| Idle | Assigned | Task assigned |
| Assigned | Running | Context loaded |
| Running | Waiting | External dependency |
| Waiting | Running | Dependency resolved |
| Running | Blocked | Missing dependency |
| Blocked | Running | Dependency provided |
| Running | Sub-spawn | Scope exceeds capacity |
| Sub-spawn | Running | Sub-workers complete |
| Running | Self-Validation | Execution complete |
| Self-Validation | Running | Rework needed |
| Self-Validation | Completed | Validation passes |
| Running | Failed | Non-recoverable error |
| Any | Cancelled | User/Dispatcher cancels |
| Failed | Running | Retry triggered |

## Logging

Format: `[TIMESTAMP] [WORKER] [STATE] [MESSAGE]`

Location: `.aic/tasks/TASK-XXX/logs/`

## Recovery

- Recoverable: retry same tier (max 3), then escalate tier
- Non-recoverable: enter FAILED, escalate to Head Worker/Dispatcher
- Blocked: wait for dependency, escalate if unresolved after 5 minutes

---

## Source: `dispatcher-lifecycle.md`

# Dispatcher Lifecycle & Execution Model

## Rule of 5 (Business Workflow)

The AIC organization follows a fixed 5-phase governance pipeline:

```
User
  ↓
Dispatcher (classify, route)
  ↓
PM (Discovery, requirements)
  ↓
Architect (technical design)
  ↓
Engineering (implementation)
  ↓
QA (verification)
  ↓
Governor (compliance, release)
  ↓
Dispatcher (deliver to user)
  ↓
User
```

Rule of 5 defines **who does what**. It does NOT define execution order within a phase.

---

## Execution Model (Scheduler Behavior)

Rule of 5 is executed through the Phase-Based Parallel Scheduler:

```
Investigate (Serial)
  → PM
  ↓
Planning (Serial then Parallel)
  → Architect (first)
  → THEN [Data, Integration, Infrastructure, Security] (concurrent)
  ↓
Implementation (Parallel)
  → [Backend, Frontend, Designer] (concurrent)
  ↓
Verification (Parallel)
  → [QA, Performance] (concurrent)
  ↓
Closeout (Serial)
  → Documentation (first)
  → THEN Governor
```

Execution Model defines **how workers run**. It is NOT Rule of 5.

---

## Phase Groups

### Investigate (Serial)
| Worker | Prerequisite | Parallel |
|--------|-------------|----------|
| PM | Dispatcher assignment | NO |
| Research | PM assignment | Conditional |

### Planning (Serial then Parallel)
| Worker | Prerequisite | Parallel |
|--------|-------------|----------|
| Architect | PM Discovery + PM PASS | NO (must complete first) |
| Data | Architecture Specification | YES |
| Integration | Architecture Specification | YES |
| Infrastructure | Architecture Specification | YES |
| Security | Architecture Specification | YES |

### Implementation (Parallel)
| Worker | Prerequisite | Parallel |
|--------|-------------|----------|
| Backend | Architecture Spec + Work Package + PM PASS | YES |
| Frontend | Architecture Spec + Work Package + PM PASS | YES |
| Designer | PM + Frontend request | YES |

### Verification (Parallel)
| Worker | Prerequisite | Parallel |
|--------|-------------|----------|
| QA | Implementation Reports + PM PASS | YES |
| Performance | Implementation Reports | YES |

### Closeout (Serial)
| Worker | Prerequisite | Parallel |
|--------|-------------|----------|
| Documentation | All phase reports | NO (must complete first) |
| Governor | All reports + Documentation + PM PASS | NO |

---

## Parallel Execution Rules

1. **Only officially defined Phase Groups execute concurrently.** No other parallel combinations are permitted.
2. **Serial phases remain serial.** Investigate and Closeout workers execute one at a time.
3. **Within Planning, Architect MUST complete before specialists.** Specialists cannot start until Architecture Specification exists.
4. **Within Closeout, Documentation MUST complete before Governor.** Governor cannot start until Documentation Handoff Report exists.
5. **Each Head Worker may spawn sub-workers.** Sub-workers provide additional parallelism within the Head Worker's scope.
6. **Phase barrier blocks until ALL required workers reach terminal state.** PM Review cannot begin until barrier completes.

---

## Dispatcher Lifecycle Process

### Investigate Phase
1. Dispatcher assigns task to PM
2. PM performs Discovery
3. PM produces Discovery Report + Work Package
4. PM Review → PASS
5. Dispatcher Gate → advance to Planning

### Planning Phase
1. Dispatcher spawns Architect
2. Architect produces Architecture Specification
3. PM Review (Architect) → PASS
4. Dispatcher spawns [Data, Integration, Infrastructure, Security] concurrently
5. Phase barrier: all 4 specialists complete
6. PM Review (per specialist artifact) → all PASS
7. Dispatcher Gate → advance to Implementation

### Implementation Phase
1. Dispatcher spawns [Backend, Frontend, Designer] concurrently
2. Phase barrier: all 3 complete
3. PM Review (per artifact) → all PASS
4. Dispatcher Gate → advance to Verification

### Verification Phase
1. Dispatcher spawns [QA, Performance] concurrently
2. Phase barrier: both complete
3. PM Review (per artifact) → all PASS
4. Dispatcher Gate → advance to Closeout

### Closeout Phase
1. Dispatcher spawns Documentation
2. Documentation produces Handoff Report
3. Dispatcher spawns Governor
4. Governor produces Release Checklist + Summary
5. PM Review → PASS
6. Dispatcher Gate → deliver to User

---

## REWORK Policy

If PM Review returns REWORK for one or more artifacts:

1. Dispatcher identifies failed workers
2. Dispatcher respawns ONLY failed workers
3. Previously PASSED workers retain their artifacts
4. Phase barrier re-triggers after respawned workers complete
5. PM reviews only new artifacts
6. Dispatcher Gate advances when all artifacts PASS
7. Max 2 rework attempts per worker

---

## Reference Runtime Example

```bash
# Investigate (serial)
spawn-worker.sh pm thinker /dir /prompt   # blocks
# PM Review → Dispatcher Gate

# Planning (serial then parallel)
spawn-worker.sh architect thinker /dir /prompt   # blocks
# PM Review (architect) → Dispatcher Gate

spawn-worker.sh data thinker /dir /prompt &
PID_DATA=$!
spawn-worker.sh integration thinker /dir /prompt &
PID_INTEG=$!
spawn-worker.sh infra crafter /dir /prompt &
PID_INFRA=$!
spawn-worker.sh security crafter /dir /prompt &
PID_SEC=$!
wait $PID_DATA $PID_INTEG $PID_INFRA $PID_SEC   # phase barrier
# PM Review (all 4) → Dispatcher Gate

# Implementation (parallel)
spawn-worker.sh backend crafter /dir /prompt &
PID_BE=$!
spawn-worker.sh frontend crafter /dir /prompt &
PID_FE=$!
spawn-worker.sh designer crafter /dir /prompt &
PID_DES=$!
wait $PID_BE $PID_FE $PID_DES   # phase barrier
# PM Review (all 3) → Dispatcher Gate

# Verification (parallel)
spawn-worker.sh qa crafter /dir /prompt &
PID_QA=$!
spawn-worker.sh perf sprinter /dir /prompt &
PID_PERF=$!
wait $PID_QA $PID_PERF   # phase barrier
# PM Review (all 2) → Dispatcher Gate

# Closeout (serial)
spawn-worker.sh documentation crafter /dir /prompt   # blocks
spawn-worker.sh governor sprinter /dir /prompt   # blocks
# PM Review → Dispatcher Gate → User
```

---

## API Calls

```bash
# Start task
curl -s -X POST $API/api/task-start -d '{"id":"TASK-...","title":"...","type":"..."}'

# Advance phase
curl -s -X POST $API/api/task-status -d '{"currentPhase":"Planning"}'

# Worker status (auto-updated by spawn-worker.sh)
# No manual API calls needed

# Close
curl -s -X POST $API/api/task-status -d '{"currentPhase":"Closeout"}'
curl -s -X POST $API/api/task-complete
```

---

## Source: `dispatcher-discovery.md`

# Dispatcher Discovery Workflow

## Overview

Discovery is part of the Investigate phase. PM evaluates requirement completeness before writing specifications.

## Intake routing (EPIC-201)

**Dispatcher pre-pipeline** uses deterministic checklists (`scripts/intake-evaluate.py`, `references/intake-routing-epic201.md`) — **not** the confidence % below. Four modes: Conversation, Quick, Discovery, From PRD.

## Confidence Scoring (in-pipeline PM narrative only — deprecated for intake routing)

PM evaluates the user request against:

1. Target files/modules identified
2. Clear user goal defined
3. Constraints documented
4. Acceptance criteria verifiable
5. Dependencies mapped
6. Risks identified

Score each dimension 0-20. Total = 0-100.

## Configurable Thresholds

| Task Complexity | Default Threshold | Guidance |
|----------------|-------------------|----------|
| Simple Bug / Patch | 70% | Minimal discovery needed |
| Standard Feature / Refactor | 80% | Standard discovery required |
| Major System Refactor | 90% | Deep discovery required |

## Clarification Loop

If confidence < threshold:

1. PM generates Structured Clarification Request (max 5 questions)
2. Questions must be answerable by user only (not from codebase)
3. Dispatcher presents questions to user
4. User answers
5. PM re-evaluates confidence
6. Max 1 iteration (if still below threshold, proceed with documented assumptions)

## Discipline Rules

- PM must NOT ask questions answerable from repository inspection
- PM must NOT ask questions answerable from documentation
- PM must NOT ask questions answerable from codebase investigation
- Questions allowed ONLY for information not derivable from project evidence

## Discovery Report

Sections:

- Objective
- Scope
- Out of Scope
- Dependencies
- Constraints
- Assumptions
- Known Unknowns
- Acceptance Criteria
- Confidence Score
- Verdict (READY / NOT READY)

---

## Source: `dispatcher-control-plane.md`

# Control Plane API Endpoints

Additional endpoints added to `server.js` (port 6868) for the Control Plane Dashboard.

## Chat — Orchestrator

### POST /api/chat
SSE stream to LLM with **orchestrator system prompt**. The server prepends a system message containing:
- Full AIC team roster (9 workers + roles)
- Current active task and phase
- Task queue contents
- Active worker states
- Orchestrator behavioral rules (Indonesian preferred, action-oriented, never "I can't do that")

Chat history (last 20 messages) is also injected for context continuity.

```bash
curl -s -X POST http://localhost:6868/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"hello"}],"model":"Opus"}'
```

Response: `text/event-stream` — OpenAI SSE: `data: {"choices":[{"delta":{"content":"token"}}]}`
**IMPORTANT:** Use raw `fetch()` with `ReadableStream`, NOT the `post()` helper (which does `res.json()` and breaks SSE).

### Chat History — Persist + Pin/Delete

Messages stored in `chat-history.json` at skill root. Each: `{id, role, content, timestamp, pinned}`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat/history` | Load all persisted messages |
| POST | `/api/chat/history` | `{role, content}` — append message |
| DELETE | `/api/chat/history` | Clear all (pinned messages survive) |
| DELETE | `/api/chat/history/:id` | Delete single message |
| POST | `/api/chat/history/:id/pin` | Toggle pin status |

## Config (Read/Write .env + opencode.jsonc)

### GET /api/config
Returns `{env, envRaw, opencode}` — secrets auto-redacted (first 8 chars + `***`).

**Verified response shape:**
```json
{
  "env": {"PROVIDER": "tvd", "API_KEY": "sk-827c0***", "BASE_URL": "http://...", "MODEL_OPUS": "TVD/Opus"},
  "envRaw": "PROVIDER=tvd\nAPI_KEY=sk-827...\n",
  "opencode": "{ \"$schema\": \"...\", \"provider\": { ... } }"
}
```

### POST /api/config
Write config: `{env: {KEY: "value"}, opencode: "jsonc string"}`. Validates JSON before writing. Won't overwrite redacted values (`***`).

### POST /api/config/detect-context
Run `detect-context.sh`: `{provider:"openai", thinker:"gpt-4o", crafter:"gpt-4o-mini", sprinter:"gpt-4o-mini"}`. Returns JSON with context limits.

## Workers

### GET /api/workers
Returns array of 9 worker objects.

**Verified response shape:**
```json
[{"id":"pm","name":"PM","tier":"thinker","type":"thinking","status":"idle","engine":null,"parent":null,
  "circuitBreaker":{"failCount":0,"state":"closed","lastFail":null},"stats":{"successRate":0,"tasksCompleted":0}}]
```

## Self-Test

### POST /api/self-test
Runs `self-test.sh`. Returns `{success, output}`.

## Audit

### GET /api/audit
Returns array of audit entries.

**Verified response shape (NO id, NO level, details is object):**
```json
[{"timestamp":"2026-07-07T05:39:28.030Z","action":"reset","actor":"dispatcher","details":{}}]
```

## History

### GET /api/history
Returns array of completed task history.

**Verified response shape (nested task object, duration is string, cost may be absent):**
```json
[{"task":{"title":"Test Task","type":"feature","id":"T-1"},"completedAt":"2026-07-07T03:59:26.301Z",
  "phases":[{"name":"Build","status":"complete"}],"agents":{"dev":{"status":"working","engine":"opencode"}},
  "tokens":{"input":0,"output":0},"cost":0,"duration":"0s"}]
```

## Analytics

### GET /api/analytics
Returns analytics by task type.

**Verified response shape (NOT per-day charts, per-type summary):**
```json
{"feature":{"count":10,"avgTime":"0s","avgSeconds":0,"successRate":1},"chore":{"count":12,...}}
```

## Task Context Persistence (2026-07-08)

### POST /api/task-start (updated)
Now creates `.aic/tasks/TASK-XXX/` directory with:
```
.aic/tasks/TASK-XXX/
  context.json   — {taskId, title, description, classification, userRequirement, createdAt}
  state.json     — {phase, status, lastActivity, workers}
  reports/       — folder for phase reports
```
Accepts additional optional fields: `description`, `classification`, `userRequirement`.

### POST /api/task-status (updated)
Now persists phase transitions to task `state.json`. If `report` field provided, saves to `reports/<phase>.md`.
```json
{"currentPhase": "planning", "report": "# Planning Phase Report\n..."}
```

### GET /api/tasks
List all tasks. Returns merged context + state for each task directory.
```json
[{"taskId": "TASK-20260708-299", "title": "...", "phase": "planning", "status": "active", "lastActivity": "...", ...}]
```

### GET /api/tasks/:id
Full task detail: `{context, state, reports}` where reports is a list of `.md` filenames.

### GET /api/tasks/:id/context
Just the `context.json` contents.

## Work Package Decomposition (2026-07-08)

### POST /api/work-packages
Save WP decomposition from PM to task directory.
```json
{"taskId": "TASK-XXX", "packages": [
  {"wp_id": "WP-01", "title": "...", "description": "...", "priority": "high", "depends_on": [], "status": "complete"},
  {"wp_id": "WP-02", "title": "...", "description": "...", "priority": "high", "depends_on": ["WP-01"], "status": "pending"}
]}
```
Saved to `.aic/tasks/TASK-XXX/work-packages.json`.

### GET /api/work-packages/:taskId
Returns work packages array for a task (or `[]` if none).

## Notes
- Config reads `.env` at `~/.hermes/skills/workflows/aic/.env`
- Config reads `opencode.jsonc` at `~/.config/opencode/opencode.jsonc`
- Chat proxy reads `BASE_URL` and `API_KEY` from `.env` at runtime
- `detect-context.sh` path: `scripts/detect-context.sh`
- `self-test.sh` path: `scripts/self-test.sh`
- **Vite proxy must cover `/health`** (not just `/api`) — System page needs it

---

## Source: `dispatcher-spawn-policy.md`

# Dispatcher Spawn Policy

## When to Spawn Sub-workers

A Head Worker SHOULD spawn sub-workers when:
- Work is naturally parallel and can be partitioned
- Tasks are independent with minimal cross-file synchronization
- Scope >= 3 files or >= 2 modules
- Multiple independent deliverables exist

## When NOT to Spawn Sub-workers

A Head Worker SHOULD NOT spawn sub-workers when:
- Work is tightly coupled (shared state or global functions)
- Reasoning is sequential (step B requires step A)
- Change is trivial (coordination overhead exceeds benefit)

## Sub-worker Inheritance

Sub-workers inherit exactly:
- Same responsibility as Head Worker
- Same capability profile as Head Worker
- Same execution model as Head Worker

Sub-workers do NOT introduce:
- New responsibilities
- New authority
- New capability profile

## Sub-worker Lifecycle

1. Head Worker analyzes scope
2. Head Worker defines N sub-scopes
3. Head Worker creates N prompt files
4. Head Worker invokes spawn-sub.sh N times (blocking)
5. Each sub-worker executes assigned scope
6. Each sub-worker produces Sub-Worker Report
7. Head Worker reads all sub-reports
8. Head Worker consolidates into one official artifact
9. Head Worker performs self-validation
10. Head Worker marks Completed

## Consolidation Rules

- Only Head Worker produces official artifact
- Sub-worker reports are internal only
- Head Worker must resolve conflicts between sub-reports
- Head Worker must identify cross-cutting concerns

---

## Source: `dispatcher-multi-repo.md`

# AIC Multi-Repo & Delegation Plan (v2)

## Core Concept: Delegation, Not Specialization

The 10 workers (PM, Architect, Frontend, etc.) are **HEAD OF** departments.
Each HEAD can spawn **N sub-workers with identical capabilities**.
HEAD distributes tasks by **scope** (files, modules, features), not by skill.

```
Dispatcher (Hermes)
 ├── PM (HEAD) → spawn N PM-sub → distribute by scope → consolidate report
 ├── Architect (HEAD) → spawn N Arch-sub → distribute by scope → consolidate report
 ├── Frontend (HEAD) → spawn N FE-sub → distribute by files → consolidate report
 ├── Backend (HEAD) → spawn N BE-sub → distribute by modules → consolidate report
 ├── QA (HEAD) → spawn N QA-sub → distribute by test areas → consolidate report
 └── Governor (HEAD) → spawn N Gov-sub → distribute by review scope → consolidate report
```

## Flow Example

```
User: "Refactor authentication system"

Dispatcher → PM
  PM analyzes scope: auth has 5 areas (login, signup, token, session, middleware)
  PM spawns 5 sub-workers:
    PM-Sub-1: investigate login flow (login.ts, LoginForm.tsx)
    PM-Sub-2: investigate signup flow (signup.ts, SignupForm.tsx)
    PM-Sub-3: investigate token management (jwt.ts, tokenStore.ts)
    PM-Sub-4: investigate session handling (session.ts, middleware.ts)
    PM-Sub-5: investigate dependencies (package.json, auth libs)
  
  Each sub-worker:
    - Has SAME tools as PM (read, search, analyze)
    - Works on assigned scope only
    - Reports back to PM
  
  PM consolidates:
    - Merges 5 sub-reports into 1 Investigation Report
    - Identifies cross-cutting concerns
    - Sends to Dispatcher

Dispatcher → Architect
  Architect receives consolidated Investigation Report
  Architect analyzes: 5 areas, 12 files, 3 dependencies
  Architect spawns 3 sub-workers:
    Arch-Sub-1: design login + signup refactor
    Arch-Sub-2: design token + session refactor  
    Arch-Sub-3: design middleware + dependency updates
  
  Architect consolidates → Architecture Report → Dispatcher

Dispatcher → Frontend Lead
  Frontend receives Architecture Report
  Frontend spawns 4 sub-workers:
    FE-Sub-1: implement LoginForm.tsx + SignupForm.tsx
    FE-Sub-2: implement token hooks + context
    FE-Sub-3: implement session provider
    FE-Sub-4: update middleware + tests
  
  Frontend consolidates → Implementation Report → Dispatcher

... (same for Backend, QA, Governor)
```

## When Does HEAD Spawn Sub-Workers?

**Automatic threshold:** If task scope >= 3 files or >= 2 modules, HEAD spawns sub-workers.

**HEAD decision flow:**
```
1. HEAD receives task + report from previous phase
2. HEAD analyzes scope (files, modules, complexity)
3. If scope >= threshold:
   a. HEAD defines N scopes (file groups or modules)
   b. HEAD spawns N sub-workers via spawn-sub.sh
   c. Each sub-worker gets explicit scope assignment
   d. HEAD waits for all sub-workers to complete
   e. HEAD consolidates sub-reports into single report
4. If scope < threshold:
   a. HEAD does work directly (no sub-workers)
   b. HEAD submits report to Dispatcher
```

## Technical Design

### 1. spawn-sub.sh (new script)

```bash
#!/usr/bin/env bash
# Usage: spawn-sub.sh <parent_worker> <sub_id> <tier> <project_dir> <prompt_file>
# 
# parent_worker: who spawned this (e.g., "pm")
# sub_id: unique ID (e.g., "pm-sub-1")
# tier: thinker/crafter/sprinter (inherits from parent)
# project_dir: repo path
# prompt_file: scope-specific prompt
#
# Differences from spawn-worker.sh:
# - Reports back to parent, not to Dispatcher
# - State tracked under parent's subWorkers array
# - Same tools/capabilities as parent
```

### 2. State Model

```json
{
  "tasks": {
    "TASK-001": {
      "id": "TASK-001",
      "title": "Refactor auth",
      "repo": "my-app",
      "branch": "feature/TASK-001",
      "phase": "Implementation",
      "status": "active",
      "workers": {
        "pm": {
          "status": "complete",
          "subWorkers": [
            { "id": "pm-sub-1", "scope": "login flow", "status": "complete" },
            { "id": "pm-sub-2", "scope": "signup flow", "status": "complete" },
            { "id": "pm-sub-3", "scope": "token mgmt", "status": "complete" },
            { "id": "pm-sub-4", "scope": "session", "status": "complete" },
            { "id": "pm-sub-5", "scope": "dependencies", "status": "complete" }
          ]
        },
        "architect": {
          "status": "working",
          "subWorkers": [
            { "id": "arch-sub-1", "scope": "login+signup design", "status": "working" },
            { "id": "arch-sub-2", "scope": "token+session design", "status": "working" },
            { "id": "arch-sub-3", "scope": "middleware+deps", "status": "idle" }
          ]
        },
        "frontend": { "status": "idle", "subWorkers": [] },
        "backend": { "status": "idle", "subWorkers": [] },
        "qa": { "status": "idle", "subWorkers": [] },
        "governor": { "status": "idle", "subWorkers": [] }
      }
    }
  }
}
```

### 3. Dashboard Visualization

```
┌──────────────────────────────────────────────┐
│ Task: Refactor auth    Phase: Implementation      │
│ Repo: my-app    Branch: feature/TASK-001     │
├──────────────────────────────────────────────┤
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │ PM ✓ complete                       │    │
│  │  ├─ pm-sub-1 ✓ login flow           │    │
│  │  ├─ pm-sub-2 ✓ signup flow          │    │
│  │  ├─ pm-sub-3 ✓ token mgmt          │    │
│  │  ├─ pm-sub-4 ✓ session              │    │
│  │  └─ pm-sub-5 ✓ dependencies         │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │ Architect ● working                 │    │
│  │  ├─ arch-sub-1 ● login+signup design│    │
│  │  ├─ arch-sub-2 ● token+session      │    │
│  │  └─ arch-sub-3 ○ middleware+deps    │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Frontend │ │ Backend  │ │    QA    │    │
│  │ ○ idle   │ │ ○ idle   │ │ ○ idle   │    │
│  └──────────┘ └──────────┘ └──────────┘    │
└──────────────────────────────────────────────┘
```

### 4. Report Consolidation

Each HEAD worker consolidates sub-reports:

```markdown
## PM Investigation Report (CONSOLIDATED)

### Sub-Worker Reports
1. **pm-sub-1 (login flow):** Found 3 files, 2 issues...
2. **pm-sub-2 (signup flow):** Found 2 files, 1 issue...
3. **pm-sub-3 (token mgmt):** Found 4 files, 5 issues...
4. **pm-sub-4 (session):** Found 2 files, 0 issues...
5. **pm-sub-5 (dependencies):** Found 3 outdated libs...

### Cross-Cutting Concerns
- Token and session are tightly coupled (shared middleware)
- Login and signup share validation logic

### Acceptance Criteria
- [ ] All auth flows use centralized token store
- [ ] Session middleware handles both login and signup
- [ ] Dependencies updated to latest stable
```

## Implementation Phases

### Phase 1: Multi-Repo Foundation
- Repo registry (`repos.json`)
- Multi-task state (`state.json` → tasks object)
- API: `/api/repo-register`, `/api/repos`, `/api/tasks`
- `task-start` requires repo ID

### Phase 2: Git Branch Workflow
- Auto-create branch per task (`feature/TASK-xxx`)
- Workers commit to branch
- Governor no-commit (Dispatcher asks user)
- User controls: commit main, commit branch, merge

### Phase 3: Sub-Worker Spawning
- `spawn-sub.sh` — same capabilities as parent
- HEAD analyzes scope, decides N
- HEAD distributes by file/module groups
- HEAD waits + consolidates reports
- State tracks parent-child relationships

### Phase 4: Dashboard Multi-Repo + Tree UI
- RepoSelector (tabs/dropdown)
- WorkerTree (expandable: HEAD → sub-workers)
- TaskQueue (pending tasks per repo)
- BranchStatus (current branch per task)

## File Changes Summary

| File | Change | Phase |
|------|--------|-------|
| `server.js` | Multi-task state, repo registry, sub-worker endpoints | 1, 3 |
| `state.json` | Tasks object, subWorkers arrays | 1, 3 |
| New: `repos.json` | Repo registry | 1 |
| New: `spawn-sub.sh` | Sub-worker spawner | 3 |
| `spawn-worker.sh` | Branch creation, no-commit mode | 2 |
| `OverviewPage.tsx` | WorkerTree component | 4 |
| New: `RepoSelector.tsx` | Multi-repo tabs | 4 |
| New: `TaskQueue.tsx` | Queued tasks list | 4 |
| New: `BranchStatus.tsx` | Branch info per task | 4 |

---

## Source: `dispatcher-artifact-contracts.md`

# Dispatcher Artifact Contracts

## Metadata Header

Every artifact must include:

```
---
worker: [worker_name]
task_id: [TASK-XXX]
phase: [lifecycle_phase]
capability_profile: [System/Thinker/Crafter/Sprinter]
started_at: [ISO 8601]
completed_at: [ISO 8601]
duration_seconds: [N]
sub_workers_spawned: [N or 0]
self_validation: [PASS/FAIL]
---
```

## Artifact Registry

| # | Artifact | Producer | Phase | Required Sections |
|---|----------|----------|-------|-------------------|
| 1 | User Summary | Dispatcher | Init | Task classification, project, scope estimate |
| 2 | Structured Clarification Request | PM | Investigate | Questions (max 5), context, priority |
| 3 | Discovery Report | PM | Investigate | Objective, Scope, Out of Scope, Dependencies, Constraints, Assumptions, Known Unknowns, Acceptance Criteria, Confidence, Verdict |
| 4 | Work Package | PM | Investigate | Task breakdown, file targets, acceptance criteria per sub-task |
| 5 | Phase Review Verdict | PM | All phases | Verdict (PASS/REWORK), missing items, feedback |
| 6 | Architecture Specification | Architect | Planning | System overview, module design, API contracts, data models, tech decisions |
| 7 | Research Report | Research | Investigate | Scope, methodology, findings, evidence, recommendations |
| 8 | Backend Implementation Report | Backend | Implementation | Modules modified, files changed, build status, test results |
| 9 | Frontend Implementation Report | Frontend | Implementation | Components modified, files changed, render status, console warnings |
| 10 | Verification Evidence Report | QA | Verification | Acceptance criteria matrix, Verified/Assumed/Not Tested, verdict |
| 11 | Design Specification | Designer | Implementation | Component layouts, design tokens, responsive breakpoints |
| 12 | Infrastructure Report | Infrastructure | Planning | Deployment targets, container configs, CI/CD scripts |
| 13 | Security Advisory Report | Security | Planning | Threat model, vulnerability scan, remediation guidance |
| 14 | Performance Optimization Report | Performance | Verification | Baseline, profiling results, bottlenecks, recommendations |
| 15 | Data Architecture Specification | Data | Planning | Schema design, relationships, migration scripts |
| 16 | Integration Specification | Integration | Planning | External services, API adapters, error handling |
| 17 | Documentation Handoff Report | Documentation | Closeout | Docs updated, docs created, accuracy verification |
| 18 | Release Checklist | Governor | Closeout | Compliance items, status per item, blocking issues |
| 19 | Release Summary | Governor | Closeout | Task summary, changes made, release recommendation |

## File Convention

All artifacts saved to: `.aic/tasks/TASK-XXX/reports/<artifact-name>.md`

## Runtime path (FEAT-001)

Default lease artifact: `reports/{worker}-output.md`. **Implementation** backend/frontend: fixed markdown sections enforced by `scripts/validate-implementation-artifact.py` — load `references/implementation-artifact-contract-fix005.md`. Registry rows 8–9 describe content; runtime validator is the pre-PM gate.

---

## Source: `dispatcher-troubleshooting.md`

# AIC Operations Troubleshooting & Pitfalls

## 1. OpenCode Custom Provider Mismatches
**Symptom:** `opencode run` fails with "UnknownError: Unexpected server error" or "No active credentials for provider".
**Cause:** Mismatch between the proxy's expected model IDs or provider names and the CLI configuration.
**Fix:** 
- Ensure `.env` variable names exactly match what the deployment script expects (e.g., `MODEL_CRAFTER`, `MODEL_THINKER`).
- Ensure `opencode.jsonc` provider name matches the `.env` `$PROVIDER`.
- Ensure the model name passed to `opencode` exactly matches what the proxy's `/v1/models` returns (e.g., use `Sonnet` instead of `TVD/Sonnet`).

## 2. Zombie State JSON (`state.json`)
**Symptom:** Worker IDs are updated in `server.js` and the Frontend UI, but the Dashboard only reacts to legacy worker names (e.g., `frontend_engineer` instead of `frontend`). Updates to new IDs are silently ignored.
**Fix:** The backend is caching the legacy structure. Delete the state file `rm -f .aic/state.json` and restart `server.js` to force a fresh state object initialization.

## 3. Dispatcher Auto-Idle (Watchdog)
**Symptom:** The Dispatcher (Hermes) gets stuck in "WORKING" on the dashboard when waiting for user input.
**Fix:** Hermes cannot natively send an idle webhook when generation finishes. The system relies on a background script (`scripts/dispatcher-watchdog.sh`) to poll and reset the dispatcher to IDLE. Ensure the script posts to `/api/agent-status` (not a phantom route like `/dispatcher`).

## 4. Pipeline and Logs Not Showing
**Symptom:** Dashboard Virtual Office renders, but Current Task, Pipeline, and Activity Log are empty.
**Fix:** Ensure the Frontend polls `GET /api/status` (which contains full state including phases, tasks, and audit logs) instead of `GET /api/workers` (which only contains agent status).

## 5. Dashboard OFFLINE After Server Restart
**Symptom:** Restarting `server.js` causes the UI at `localhost:6969` to show OFFLINE or go blank.
**Fix:** Ensure the Vite dev server (`npx vite --port 6969`) is running. The backend API (`6868`) and frontend Vite proxy (`6969`) must both be alive for the dashboard to function. Do not rely solely on the Node server.
