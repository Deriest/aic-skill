# AIC Multi-Repo & Hierarchical Worker Plan

## Problem

Current AIC is single-tenant:
- 1 `state.json` → 1 task, 1 pipeline, 1 set of workers
- Workers are flat (no hierarchy, no delegation)
- No concept of "which repo is this task for"
- Everything commits to main (no branch workflow)

## Target Architecture

```
User
 └── Dispatcher (Hermes)
      └── Multi-Repo Router
           ├── Repo A: feature/TASK-001
           │    ├── PM (HEAD) → spawns: Researcher, Analyst
           │    ├── Architect (HEAD) → spawns: Designer, DB Specialist
           │    ├── Frontend Lead (HEAD) → spawns: CSS Dev, React Dev, A11y Tester
           │    ├── Backend Lead (HEAD) → spawns: API Dev, Auth Specialist
           │    ├── QA Lead (HEAD) → spawns: Unit Tester, E2E Tester, Security Auditor
           │    └── Governor (HEAD) → spawns: Compliance Officer
           │
           └── Repo B: feature/TASK-002
                ├── PM (HEAD) → ...
                └── ...
```

## Core Concepts

### 1. Repo Registry

```json
// .aic/repos.json
{
  "repos": [
    {
      "id": "aic-skill",
      "name": "AIC Skill",
      "path": "~/.hermes/skills/workflows/aic",
      "branch": "main",
      "active": true
    },
    {
      "id": "my-app",
      "name": "My Application",
      "path": "/home/tvd/projects/my-app",
      "branch": "main",
      "active": true
    }
  ]
}
```

### 2. Task State (multi-task)

```json
// .aic/state.json
{
  "tasks": {
    "TASK-20260708-001": {
      "id": "TASK-20260708-001",
      "title": "Fix login bug",
      "repo": "my-app",
      "branch": "feature/TASK-20260708-001",
      "phase": "Execution",
      "status": "active",
      "workers": {
        "pm": { "status": "complete", "sub": ["researcher-1"] },
        "architect": { "status": "complete", "sub": [] },
        "frontend": { "status": "working", "sub": ["css-dev-1", "react-dev-1"] },
        "backend": { "status": "idle", "sub": [] },
        "qa": { "status": "idle", "sub": [] },
        "governor": { "status": "idle", "sub": [] }
      }
    },
    "TASK-20260708-002": {
      "id": "TASK-20260708-002",
      "title": "Add dark mode",
      "repo": "aic-skill",
      "branch": "feature/TASK-20260708-002",
      "phase": "Planning",
      "status": "queued",
      "workers": { ... }
    }
  },
  "globalWorkers": {
    "dispatcher": { "status": "working", "currentTask": "TASK-20260708-001" }
  }
}
```

### 3. Worker Hierarchy

```json
// .aic/workers.json — defines who can spawn whom
{
  "hierarchy": {
    "dispatcher": {
      "spawns": ["pm", "architect", "frontend", "backend", "qa", "governor", "infra"],
      "tier": "session"
    },
    "pm": {
      "spawns": ["researcher", "analyst"],
      "tier": "thinker"
    },
    "architect": {
      "spawns": ["designer", "db-specialist", "security-architect"],
      "tier": "thinker"
    },
    "frontend": {
      "spawns": ["css-dev", "react-dev", "a11y-tester"],
      "tier": "crafter"
    },
    "backend": {
      "spawns": ["api-dev", "auth-specialist", "db-engineer"],
      "tier": "crafter"
    },
    "qa": {
      "spawns": ["unit-tester", "e2e-tester", "security-auditor"],
      "tier": "sprinter"
    },
    "governor": {
      "spawns": ["compliance-officer"],
      "tier": "crafter"
    }
  }
}
```

## Implementation Plan

### Phase 1: Multi-Repo Foundation (Core)

**Files to change:**
- `server.js` — multi-task state management
- `state.json` → array of tasks instead of single task
- New: `repos.json` — repo registry

**API Changes:**
```
POST /api/repo-register     — register a new repo
GET  /api/repos              — list registered repos
POST /api/task-start         — now requires repo ID
GET  /api/tasks              — list all active tasks
GET  /api/tasks/:id          — get specific task status
POST /api/task-queue         — queue task for different repo
```

**Key changes:**
- `currentTask` → `tasks` object (map of task ID → task state)
- Each task owns its own phase + worker states
- Workers can be assigned to specific tasks
- Global workers (dispatcher) shared across tasks

### Phase 2: Git Branch Workflow

**Files to change:**
- `spawn-worker.sh` — auto-create branch before spawn
- `server.js` — track branch per task
- Governor prompt — no longer commits, asks Dispatcher

**Workflow:**
```
1. Dispatcher: git checkout -b feature/TASK-xxx
2. Worker commits to branch (not main)
3. Governor reviews (no commit)
4. Dispatcher asks user:
   - commit to main?
   - commit to branch?
   - merge branch to main?
5. User answers → Dispatcher executes git
```

### Phase 3: Hierarchical Workers

**Files to change:**
- `spawn-worker.sh` — support nested spawning
- `server.js` — track parent-child worker relationships
- `workers.json` — hierarchy definition
- New: `sub-spawn.sh` — HEAD worker spawns sub-worker

**Sub-spawn flow:**
```
1. Dispatcher spawns Frontend Lead (HEAD)
2. Frontend Lead analyzes task scope
3. If scope >= 3 files:
   a. Frontend Lead calls sub-spawn.sh
   b. sub-spawn.sh creates: css-dev-1, react-dev-1
   c. Each sub-worker gets explicit file assignment
   d. Sub-workers run in parallel
4. Frontend Lead collects sub-worker reports
5. Frontend Lead submits consolidated report to Dispatcher
```

**State tracking:**
```json
{
  "frontend": {
    "status": "working",
    "subWorkers": [
      { "id": "css-dev-1", "files": ["styles.css", "theme.css"], "status": "complete" },
      { "id": "react-dev-1", "files": ["Login.tsx"], "status": "working" }
    ]
  }
}
```

### Phase 4: Dashboard Multi-Repo UI

**New components:**
- `RepoSelector.tsx` — dropdown/tab to switch between repos
- `TaskQueue.tsx` — show queued tasks per repo
- `WorkerTree.tsx` — hierarchical view (HEAD → sub-workers)
- `BranchStatus.tsx` — show current branch per task

**Layout:**
```
┌─────────────────────────────────────────────┐
│ [Repo A ▼]  [Repo B]  [Repo C]             │ ← RepoSelector
├─────────────────────────────────────────────┤
│ Pipeline: Investigate → Plan → Exec → ...   │
│ Task: "Fix login bug"  Branch: feature/xxx  │
├─────────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐           │
│ │ PM  │ │ARCH │ │FE   │ │ QA  │           │
│ │ Aria│ │Atlas│ │ Leo │ │ Eve │           │
│ └─────┘ └─────┘ └──┬──┘ └─────┘           │
│                     │                       │
│              ┌──────┼──────┐                │
│              │      │      │                │
│           ┌─────┐┌─────┐┌─────┐            │
│           │CSS  ││React││A11y │            │ ← Sub-workers
│           │Dev 1││Dev 1││Test │            │
│           └─────┘└─────┘└─────┘            │
├─────────────────────────────────────────────┤
│ Task Queue:                                 │
│  [ ] TASK-002: Add dark mode (Repo B)       │
│  [ ] TASK-003: Fix API (Repo A)             │
└─────────────────────────────────────────────┘
```

## Migration Path

### Step 1: Refactor state.json (non-breaking)
- Change from flat `{currentTask, workers}` to `{tasks: {}, globalWorkers: {}}`
- Backward compatible: if `tasks` missing, treat as single-task legacy mode

### Step 2: Add repo registry
- Create `repos.json`
- Add `/api/repo-register` and `/api/repos` endpoints
- `task-start` now accepts `repo` parameter

### Step 3: Git branch integration
- `spawn-worker.sh` creates branch if not exists
- Workers commit to branch
- Governor no longer commits
- Dispatcher asks user for git decisions

### Step 4: Hierarchical spawning
- Create `workers.json` with hierarchy
- Create `sub-spawn.sh` for HEAD workers
- Update state to track parent-child relationships

### Step 5: Dashboard multi-repo UI
- Add RepoSelector component
- Add TaskQueue component
- Add WorkerTree component
- Add BranchStatus component

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| State migration breaks existing tasks | HIGH | Backward compatible migration, legacy mode fallback |
| Nested spawning causes process explosion | MEDIUM | Max depth=2 (HEAD → sub), max 3 sub-workers per HEAD |
| Multi-task concurrency causes race conditions | MEDIUM | Mutex on state.json, task-scoped worker pools |
| Dashboard complexity explosion | LOW | Incremental UI, start with repo selector only |

## Success Criteria

- [ ] Register 2+ repos, each with independent tasks
- [ ] Task A in Repo A runs concurrently with Task B in Repo B
- [ ] Frontend Lead spawns 2 sub-workers for large task
- [ ] Governor approves without committing
- [ ] User chooses: commit main, commit branch, or merge
- [ ] Dashboard shows per-repo pipeline + worker tree
