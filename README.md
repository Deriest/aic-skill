# AI Engineering Company (AIC)

> **A 10-agent AI software development workforce, orchestrated from your terminal.**

AIC transforms Hermes into a full engineering company — with a Dispatcher, PM, Architect, Engineers, QA, and Governor — all working through a strict 5-phase pipeline. You talk naturally; AIC builds.

![Dashboard Overview](./dashboard-overview.png)

---

## Workspace Context

AIC operates on a symlinked workspace architecture to isolate the framework codebase from the target project.
- **Skill Repository:** `~/.hermes/skills/workflows/aic/`
- **Active Project Path:** Set dynamically via the `/aic project <name>` command.
- **Project Symlink:** Automatically mounts to `/home/tvd/aic-skill` pointing to the currently active project folder for unified terminal tool paths.

---

## Meet the Team

| # | Name | Role | Tier | Personality | What they actually do |
|---|------|------|------|-------------|----------------------|
| 1 | <img src="./avatars/hermes.png" /><br/>**Hermes** | Dispatcher | Orchestrator | Strict butler | Routes your request. Never writes code. Talks to you, then delegates. |
| 2 | <img src="./avatars/aria.png" /><br/>**Aria** | Product Manager | Thinker | Empathetic translator | Turns "I want a feature" into user stories, data models, and acceptance criteria. |
| 3 | <img src="./avatars/sage.png" /><br/>**Sage** | Researcher | Crafter | Evidence-driven analyst | Finds facts, validates assumptions, reads docs. No guessing. |
| 4 | <img src="./avatars/luna.png" /><br/>**Luna** | Designer | Crafter | User advocate | Specifies layouts, interactions, visual consistency. Thinks in user journeys. |
| 5 | <img src="./avatars/atlas.png" /><br/>**Atlas** | Architect | Thinker | Systems thinker | Designs databases, APIs, tech stack. Thinks in trade-offs and constraints. |
| 6 | <img src="./avatars/leo.png" /><br/>**Leo** | Frontend Engineer | Crafter | UI craftsman | React, Vite, Tailwind. Builds what Luna designs, what Atlas architected. |
| 7 | <img src="./avatars/hugo.png" /><br/>**Backend** | Backend Engineer | Crafter | Reliability nerd | Node.js, Python, APIs, database logic. Security and performance first. |
| 8 | <img src="./avatars/flint.png" /><br/>**Flint** | Infrastructure Eng | Crafter | Automation obsessed | Docker, CI/CD, deployment scripts. "If it runs twice, automate it." |
| 9 | <img src="./avatars/eve.png" /><br/>**Eve** | QA Engineer | Sprinter | Perfectionist tester | Tests everything. Writes tests. Breaks things so users don't have to. |
| 10 | <img src="./avatars/rex.png" /><br/>**Rex** | Governor | Crafter | Compliance gate | Final reviewer. **STRICT RULE:** Never auto-commits code. Evaluates output and awaits Operator's explicit approval before any git commits are made. |

---

## The Pipeline

Every task — no matter how small — follows this 5-phase lifecycle:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐    ┌──────────────┐    ┌───────────┐
│ INVESTIGATE │ →  │  PLANNING   │ →  │      IMPLEMENTATION     │ →  │ VERIFICATION │ →  │  CLOSEOUT │
│ (Aria, Sage)│    │(Atlas, Luna)│    │   (Leo, Hugo, Flint)    │    │    (Eve)     │    │   (Rex)   │
└─────────────┘    └─────────────┘    └─────────────────────────┘    └──────────────┘    └───────────┘
```

- **Investigate**: PM translates your request into structured specs, backed by Researcher's evidence.
- **Planning**: Architect designs the technical approach, Designer prepares UI specs.
- **Implementation**: Engineers build it (Frontend, Backend, and Infra can run in parallel).
- **Verification**: QA tests against the original requirements and checks coverage.
- **Closeout**: Governor reviews for compliance and quality.

**No phase is skippable.** Even "just fix a typo" goes through the pipeline.

---

## Features

| Feature | Description |
|---------|-------------|
| **Context Persistence** | Every task saves to `.aic/tasks/TASK-XXX/` — context, reports, state. Nothing is lost. |
| **Resume (`aic continue`)** | Interrupted tasks (crash, token limit, sleep) can be resumed from where they stopped. |
| **WP Decomposition** | Large projects are broken into dependency-tracked Work Packages by PM. |
| **Token Cost Tracking** | Per-worker token usage, cache hit rates, time-filtered metrics. |
| **Auto Pipeline Sync** | Worker status and pipeline phase sync automatically — no manual updates needed. |
| **Task History** | Paginated task list with expandable details, status badges, and WP trees. |

---

## Dashboard

The control panel runs on `http://localhost:6868`.

### Overview
![Dashboard Overview](./dashboard-overview.png)
Live pipeline status, worker grid with real-time status indicators, and current task details.

### Task History
![Dashboard History](./dashboard-history.png)
Persistent task records with pagination (10/page), expandable context details, and red INTERRUPTED badges for resumable tasks.

### Token Costs
![Dashboard Costs](./dashboard-costs.png)
Per-worker breakdown of input/output/cache tokens, time-filtered bar charts, and cache hit rate.

---

## How to Install

### Prerequisites

| Dependency | Required | Check |
|------------|----------|-------|
| **Hermes Agent** | ✅ Yes | `hermes --version` |
| **Node.js + npm** | ✅ Yes | `node --version` |
| **jq** | ✅ Yes | `jq --version` |
| **OpenCode CLI** | ✅ Yes (for engineers) | `opencode --version` |
| **Python 3** | ⚠️ Optional (for scripts) | `python3 --version` |

### Quick Install

```bash
# 1. Clone the AIC skill
git clone --depth 1 https://github.com/Deriest/aic-skill.git ~/.hermes/skills/workflows/aic

# 2. Run setup (interactive — picks provider, models, configures everything)
bash ~/.hermes/skills/workflows/aic/scripts/setup.sh

# 3. Build the dashboard
cd ~/.hermes/skills/workflows/aic/dashboard && npm install && npm run build

# 4. Start the server
node ~/.hermes/skills/workflows/aic/scripts/server.js 6868
```

### What setup.sh does

1. Checks dependencies (Hermes, Node, npm, jq, OpenCode)
2. Auto-detects available AI models from your provider
3. Lets you pick 3 models: **Thinker** (complex reasoning), **Crafter** (coding), **Sprinter** (fast tasks)
4. Generates `opencode.jsonc` and `.env` with correct config
5. Sets context window limits automatically (80/60/40% per tier)

---

## How to Use

### Starting AIC

```
You:  /aic

Hermes: Hello, I am the AIC Dispatcher. 
        The pipeline is currently idle.
        What task can I help you with today?
```

### Giving a task (natural language)

```
You:  build an e-commerce website

Hermes: Task classified: DEVELOP (Full Pipeline)
        Spawning PM (Aria) for investigation...
        
        [Aria runs: generates requirements.json]
        [Atlas runs: generates design.json]
        [Leo + Hugo run: implement frontend + backend]
        [Eve runs: tests everything]
        [Rex runs: final review]
        
        Task complete. 5 files changed, 3 new features.
        Do you want to commit these changes?
```

### Checking status

```
You:  /aic status

Hermes: ┌─ TASK-20260708-200 ──────────────┐
        │ Status: ACTIVE                    │
        │ Phase: Implementation             │
        │ Workers: Leo (working), Hugo (idle)│
        └───────────────────────────────────┘
```

### Resuming an interrupted task

```
You:  aic continue

Hermes: === Resuming TASK-20260708-200 ===
        Title: E-Commerce Website
        Phase: Implementation
        Last report: frontend-output.md (45 lines)
        
        Resume this task? [y/N]
```

### Getting task details

```
You:  /aic status task TASK-20260708-200

Hermes: ┌─ TASK DETAIL ─────────────────────┐
        │ Type: develop                     │
        │ Created: 2026-07-08 14:30         │
        │ Reports:                          │
        │   • pm-report.md (120 lines)      │
        │   • architect-plan.md (85 lines)  │
        │   • frontend-output.md (45 lines) │
        │   • backend-output.md (67 lines)  │
        │ Work Packages: 2/4 complete       │
        └───────────────────────────────────┘
```

### Available commands

| Command | What it does |
|---------|-------------|
| `/aic` | Activate Dispatcher mode |
| `/aic status` | Show current pipeline status |
| `/aic status task <TASK-ID>` | Show detailed task info |
| `aic continue` | Resume last interrupted task (CLI) |
| `/aic stop` | Deactivate Dispatcher mode |

---

## Configuration

### .env (auto-generated by setup.sh)

```env
PROVIDER=your-provider
MODEL_THINKER=provider/model-name
MODEL_CRAFTER=provider/model-name
MODEL_SPRINTER=provider/model-name
```

### Model tiers

| Tier | Use for | Context window | Workers |
|------|---------|----------------|---------|
| **Thinker** | Complex reasoning, architecture | 80% of max | Aria (PM), Atlas (Architect) |
| **Crafter** | Coding, implementation | 60% of max | Leo, Hugo, Flint, Sage, Luna, Rex |
| **Sprinter** | Fast tasks, testing | 40% of max | Eve (QA) |

---

## Scripts Reference

| Script | Purpose | Usage |
|--------|---------|-------|
| `setup.sh` | First-time setup | `bash scripts/setup.sh` |
| `preflight.sh` | Pre-flight check + server start | `bash scripts/preflight.sh --auto-start` |
| `spawn-worker.sh` | Spawn a worker with auto-status | `bash scripts/spawn-worker.sh <worker> <tier> <dir> <prompt>` |
| `server.js` | Dashboard API server | `node scripts/server.js 6868` |
| `aic` | CLI tool | `aic continue` |
| `context-gather.sh` | Gather project context | `bash scripts/context-gather.sh <dir> --tier crafter` |

---

## Known Limitations & Workarounds

### A. General System Issues

| Issue | Why it happens | Workaround |
|-------|---------------|------------|
| **Pipeline is sequential** | PM → Architect → Engineers → QA → Governor, always | For parallel work, spawn Frontend + Backend simultaneously (allowed in Implementation phase) |
| **No undo for code changes** | Workers use `opencode run` which modifies files directly | Use git branching before large tasks; `git diff` after each phase |
| **Token limits** | Large tasks may hit model context windows | Context auto-truncates at 80/60/40% per tier; use Crafter for implementation |
| **Setup requires internet** | `npm install`, model fetching, OpenCode CLI install | Pre-download dependencies; use `--offline` flags where possible |

### B. Chat / Dispatcher Issues

| Issue | Why it happens | Workaround |
|-------|---------------|------------|
| **Dispatcher takes over worker tasks** | AI model sees code and "wants to help" | Strict SOUL prompts enforce role boundaries; `spawn-worker.sh` injects role context automatically |
| **Dispatcher skips phases** | "This is trivial, just fix it" | API lifecycle guard rejects out-of-order phase execution; 403 error forces correct flow |
| **Worker doesn't finish before next starts** | Race condition in parallel spawning | `spawn-worker.sh` is blocking — it waits for `opencode run` to exit before returning |
| **Governor auto-commits code** | Model ignores "ask user first" rule | Rule 9 in SKILL.md: Governor MUST NOT commit. Dispatcher asks user. Enforced by SOUL prompt. |
| **Language mismatch** | User speaks Indonesian, worker responds in English | Dispatcher auto-detects language and passes it to worker prompts |

### C. Dashboard / API Issues

| Issue | Why it happens | Workaround |
|-------|---------------|------------|
| **History page empty after feature deploy** | Tasks created before persistence feature | Run new tasks via `/api/task-start`; old tasks won't have context files |
| **Dashboard doesn't auto-refresh** | SPA polls on interval, not WebSocket | Refresh manually or wait for next poll cycle (configurable) |
| **Metrics not updating** | Server restarted, in-memory state lost | Metrics persist to `.aic/metrics.json`; reload on server start |

---

## For Contributors

### Adding a new worker

1. Add to `dashboard/src/data/workers.ts` with colors and section
2. Add to `WORKERS` array in `scripts/server.js`
3. Add phase mapping in `scripts/spawn-worker.sh` (`PHASE_MAP_<name>`)
4. Update `SKILL.md` worker table and SOUL prompt

### Adding a new pipeline phase

1. Update `phases` array in `PipelineTracker.tsx`
2. Update `PHASE_ALLOWED` map in `server.js`
3. Update `PHASE_MAP` in `spawn-worker.sh`
4. Update `SKILL.md` pipeline documentation

---

## License

MIT — See [LICENSE](./LICENSE)

---

<p align="center">
  <i>Built with Hermes Agent by Nous Research</i><br/>
  <i>AIC originally ported from OpenClaw plugin by TVD</i>
</p>
