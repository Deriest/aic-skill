# AIC Roadmap — Multi-Session & Delegation

## Current State (Baseline)
- Single task, single session, single project
- 10 flat workers (no hierarchy)
- Worker-centric dashboard
- All commits to main

## Priority 1: Multi-Session (1 user, many tasks)

### Folder Selection
```
User: /aic
Dispatcher: Auto-detect cwd or ask "Mau kerja di folder mana?"
User: /home/tvd/floorvs
Dispatcher: task-start TASK-001 project=floorvs path=/home/tvd/floorvs
```

- Auto-detect dari cwd (current working directory)
- Manual: `/aic /path/to/project`
- Prompt: "Mau kerja di folder mana?"
- Single AIC install (global tool), task tagged by project

### Architecture: Opsi C — HEAD Shared + Sub-Workers Per Task

```
Global: 10 HEAD workers (shared, coordination only)
Session 1: PM spawn 3 PM-sub untuk TASK-001
Session 2: PM spawn 2 PM-sub untuk TASK-002
```

- HEAD workers = managers, tidak langsung kerja
- Sub-workers = spawned on demand, mati setelah selesai
- Resource efficient: HEAD shared, sub-workers temporary
- Natural scaling: task besar = banyak sub, task kecil = sedikit

### Task-Centric Dashboard (bukan Worker-Centric)

```
┌──────────────────────────────────────┐
│ TASK-001: Fix login    [floorvs]     │
│  PM ● working → 3 sub-workers       │
│  Architect ✓ complete                │
│  Frontend ○ idle                     │
├──────────────────────────────────────┤
│ TASK-002: Add dark mode [my-app]     │
│  PM ● working → 2 sub-workers       │
│  Architect ● working → 1 sub-worker │
│  Frontend ○ idle                     │
└──────────────────────────────────────┘
```

| Lama (Worker-Centric) | Baru (Task-Centric) |
|----------------------|---------------------|
| Dashboard = 10 worker slots | Dashboard = N task cards |
| PM: working (ambiguous) | TASK-001 > PM: working |
| State per worker | State per task > per worker |
| 1 task visible | Multiple tasks visible |

### State Model

```json
{
  "tasks": {
    "TASK-001": {
      "project": "floorvs",
      "path": "/home/tvd/floorvs",
      "title": "Fix login bug",
      "branch": "feature/TASK-001",
      "phase": "Execution",
      "workers": {
        "pm": { "status": "working", "sub": ["pm-sub-1", "pm-sub-2", "pm-sub-3"] },
        "architect": { "status": "complete", "sub": [] },
        "frontend": { "status": "idle", "sub": [] },
        "backend": { "status": "idle", "sub": [] },
        "qa": { "status": "idle", "sub": [] },
        "governor": { "status": "idle", "sub": [] }
      }
    },
    "TASK-002": {
      "project": "my-app",
      "path": "/home/tvd/projects/my-app",
      "title": "Add dark mode",
      "branch": "feature/TASK-002",
      "phase": "Planning",
      "workers": {
        "pm": { "status": "working", "sub": ["pm-sub-1", "pm-sub-2"] },
        "architect": { "status": "idle", "sub": [] }
      }
    }
  }
}
```

## Priority 2: Delegation (HEAD spawn sub-workers)

### Core Concept
HEAD = manager, punya capability sama dengan sub-workers.
HEAD distribute tugas berdasarkan **scope** (files, modules), bukan skill.

### Flow
```
Dispatcher → PM (HEAD)
  PM analyze scope: 5 areas
  PM spawn 5 PM-sub:
    PM-Sub-1: investigate login.ts, LoginForm.tsx
    PM-Sub-2: investigate signup.ts, SignupForm.tsx
    PM-Sub-3: investigate jwt.ts, tokenStore.ts
    PM-Sub-4: investigate session.ts, middleware.ts
    PM-Sub-5: investigate package.json, auth libs
  PM tunggu semua selesai
  PM konsolidasi → 1 Investigation Report
  PM → Dispatcher → Architect (HEAD) → ...
```

### When to Spawn
- Automatic: scope >= 3 files atau >= 2 modules
- HEAD decision: analyze dulu, kalau cukup kecil kerja sendiri

### Sub-Worker Lifecycle
- Same tools/capabilities as parent
- Reports back to HEAD (not Dispatcher)
- Mati setelah report submitted
- State tracked per-task

## Priority 3: Git Branch Workflow

### Flow
```
1. Dispatcher: git checkout -b feature/TASK-xxx
2. Workers commit to branch (not main)
3. Governor reviews (no commit)
4. Dispatcher asks user:
   - Commit ke mana? (main / branch / keduanya)
   - Merge branch ke main? (ya / tidak)
5. User answers → Dispatcher executes git
```

### Rules
- Governor does NOT commit or merge
- User has full control over git operations
- Branch naming: feature/TASK-xxx

## Priority 4: Multi-Repo (Nice to Have)

- `spawn-worker.sh` already accepts `project_dir` argumen
- Task tagged with project folder
- Dashboard filter by project
- NOT a priority — multi-session is more valuable

## Implementation Phases

### Phase 1: Multi-Session Foundation
- Multi-task state management
- Folder selection (auto-detect + prompt)
- Task queue (auto-queue if task active)
- API: `/api/tasks`, task-scoped endpoints

### Phase 2: Task-Centric Dashboard
- Task cards (one per active/queued task)
- Worker tree per task (HEAD → sub-workers)
- Expand/collapse per task
- Project filter in sidebar

### Phase 3: Delegation System
- `spawn-sub.sh` — sub-worker spawner
- HEAD analyzes scope, decides N
- Sub-worker reports back to HEAD
- Report consolidation per HEAD

### Phase 4: Git Branch Workflow
- Auto-create branch per task
- Workers commit to branch
- Governor no-commit
- Dispatcher asks user for git decisions

### Phase 5: Polish & Scale
- Multi-repo support (already technically possible)
- Parallel task execution (if resources allow)
- Resource monitoring (sub-worker count limits)

## Success Criteria

- [ ] User starts 2 tasks in different folders
- [ ] Both tasks visible in dashboard simultaneously
- [ ] PM spawns 3 sub-workers for large task
- [ ] Sub-workers report back to PM
- [ ] PM consolidates into single report
- [ ] Governor approves without committing
- [ ] User chooses: commit main, branch, or merge
- [ ] Dashboard shows task-centric view with worker trees
