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
      "phase": "Execution",
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
│ Task: Refactor auth    Phase: Execution      │
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
