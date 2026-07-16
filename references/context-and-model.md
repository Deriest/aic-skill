# Context And Model

> **Consolidated from 4 files.** Originals archived in `references/archive/`.

**Original files merged:**
- `context-multi-session.md`
- `context-roadmap.md`
- `model-selection.md`
- `token-tracking.md`

---

---

## Source: `context-multi-session.md`

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
      "phase": "Implementation",
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

---

## Source: `context-roadmap.md`

# AIC Roadmap Status

**Status:** All 26 tasks IMPLEMENTED (2026-07-07). Control Plane dashboard rebuild in progress (2026-07-08).

| Phase | Status | Commit |
|-------|--------|--------|
| Phase 1: Core Engine (queue, cancel, rollback, circuit breaker) | ✅ | `5dd48e7` |
| Phase 2: Intelligence (PM parser, parallel batching, artifacts, dynamic tier, analytics, ETA) | ✅ | `5dd48e7` |
| Phase 3: DX (git, multi-repo, DAG, per-project config, context cache) | ✅ | `5dd48e7` |
| Phase 4: Dashboard (backend endpoints done, frontend partial) | ⚠️ | `5dd48e7` |
| Phase 5: Hardening (notifications, audit, changelog, self-test, auth, error parser) | ✅ | `5dd48e7` |
| Auto Context Detection (detect-context.sh, .env integration) | ✅ | `5eb5670` |
| CLI (`./aic setup/update/uninstall/test/server/help`) | ✅ | `cbd7837` |

## Done: Foundational Features (2026-07-08)

| Feature | Status | Details |
|---------|--------|---------|
| Task Context Persistence | ✅ | `.aic/tasks/TASK-XXX/` dirs with context.json, state.json, reports/ |
| `aic continue` (Resume) | ✅ | CLI script reads state + context + last report, asks to resume |
| WP Decomposition | ✅ | POST/GET /api/work-packages, saved per task |
| HISTORY dashboard tab | ✅ | HistoryPage.tsx with INTERRUPTED badge (#ff0000), RESUME, WP tree |
| Worker output → task reports | ✅ | spawn-worker.sh auto-saves output to .aic/tasks/TASK-XXX/reports/ |

## Next: Control Plane Dashboard
Rebuild dashboard as full 8-page control plane with Chat (SSE streaming), Config Editor, etc.
Plan: `.hermes/plans/2026-07-08_000000-aic-control-plane.md`
Architecture design: `.aic/artifacts/design.json`

---

## Source: `model-selection.md`

# Model Selection & Process Management Pitfalls

## Sonnet (crafter) Cannot Edit Large Files

**Discovered:** 2026-07-08 during TASK-20260708-020

Sonnet (crafter tier) fails silently when editing files >100 lines. It reads the file, creates a todo list, then exhausts output tokens thinking without ever calling write/edit tools. The worker reports "completed successfully" but the file is unchanged.

**Test results:**
| File | Size | Model | Result |
|------|------|-------|--------|
| `/tmp/opencode-test.txt` | 1 line | Sonnet | ✅ Success |
| `requirements.json` (new file) | ~50 lines | Sonnet | ✅ Success |
| `architecture.md` (new file) | ~50 lines | Sonnet | ✅ Success |
| `ConfigPage.tsx` (existing) | 368 lines | Sonnet | ❌ Failed 4x |
| `ConfigPage.tsx` (existing) | 368 lines | Opus | ✅ Success 1st try |

**Rule:** Use Opus (thinker) for Frontend/Backend Engineer when editing existing files >100 lines. Sonnet is fine for PM, Architect (creating new files), QA, and small edits.

## `pkill -9 node` Is Unverified

**Discovered:** 2026-07-08

`pkill -9 node` may fail silently or kill unrelated Node processes. Verified: PID 42163 survived `pkill -9 node` but died immediately with `kill -9 42163`.

**Rule:** Always use `kill -9 <PID>` with the specific PID obtained from `pgrep -f "server.js 6868"` or `lsof -i :6868`.

## `write_file` Secret Redaction

The `write_file` tool's built-in secret detection redacts API key patterns to `***` in terminal output. The FILE itself is correct — only the display is redacted.

**Verification:** Check file content length or use `includes()` pattern matching instead of visual inspection.

---

## Source: `token-tracking.md`

# Token Cost Tracking Architecture

## Data Flow
```
opencode --format json (NDJSON)
  → opencode-token-extract.py (one pass per file; merge on WECP repair paths)
  → spawn-worker.sh (legacy, no contract) OR worker-execution-pipeline.py (WECP, on PASS)
  → POST /api/metrics (exactly once per worker execution)
  → server.js appends to .aic/metrics.json
  → dashboard GET /api/metrics (filter by date/tier)
  → CostsPage.tsx renders charts + HIT RATE card
```

**FIX-023 (2026-07-14):** WECP must POST metrics — contract path bypassed legacy spawn-worker grep. See `references/cache-hit-metrics-wecp-fix023.md`.

## Metrics Schema
```json
{
  "id": "metric-<timestamp>",
  "timestamp": "ISO string",
  "worker": "pm|architect|research|designer|frontend|backend|qa|governor|documentation|perf|infra|security|data|integration",
  "tier": "thinker|crafter|sprinter",
  "model": "provider/ModelName",
  "tokens": {
    "input": 0,
    "output": 0,
    "reasoning": 0,
    "cacheRead": 0,
    "cacheWrite": 0,
    "total": 0
  },
  "durationSec": 0
}
```

## Cache Hit Rate Formula
**Correct:** `cacheRead / (cacheRead + input)`
**Wrong:** `cache / (input + output)` — produces values > 100%

## Pitfalls

### Vite Circular Chunk (Blank Production Build)
`manualChunks: { ui: ['recharts'], vendor: ['react', 'react-dom', 'framer-motion'] }` causes circular dependency. Fix: merge recharts into vendor chunk:
```ts
manualChunks: { vendor: ['react', 'react-dom', 'framer-motion', 'recharts'] }
```
Dev mode (vite dev) works fine because it doesn't bundle. Production build fails silently (blank page, one empty JS error).

### Recharts AreaChart Needs 2+ Data Points
AreaChart only renders filled areas between points. With 1 data point, it shows a dot. Use BarChart for single-point/categorical data.

### Recharts BarChart Hover Background
Default cursor on BarChart hover shows a light background. Disable with:
```tsx
<Tooltip cursor={{ fill: 'transparent' }} />
```

### XAxis Label Skipping
Recharts auto-skips labels when too many categories. Force all labels:
```tsx
<XAxis interval={0} tick={{ fontSize: 9 }} />
```

### Pre-populate All Workers
Always include all 9 workers (excluding dispatcher) in chart data with 0 values to reserve space:
```tsx
const ALL_WORKERS = [
  'pm', 'architect', 'research', 'designer', 'frontend', 'backend', 'qa', 
  'governor', 'documentation', 'perf', 'infra', 'security', 'data', 'integration'
];
```

### Worker Display Names
Use SHORT_NAMES for chart X-axis (fits better), WORKER_NAMES for table:
```tsx
const SHORT_NAMES = { pm: 'Aria', architect: 'Atlas', ... };
const WORKER_NAMES = { pm: 'Aria (PM)', architect: 'Atlas (Architect)', ... };
```

### Dispatcher Not Tracked
Dispatcher runs via Hermes directly, not through spawn-worker.sh. Token usage is overhead and not captured. Only the 9 workers are tracked.
