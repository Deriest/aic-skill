# AI Engineering Company (AIC) — Hermes Skill

10-worker orchestration system for AI-powered software development.

Your Hermes agent becomes a **Dispatcher** that classifies tasks, spawns specialized workers, and manages the full development pipeline — from requirements to deployment.

## Workers

| Worker | Tier | Purpose |
|--------|------|---------|
| PM | Thinker | Requirements, acceptance criteria |
| Architect | Thinker | System design, API contracts |
| Researcher | Crafter | Investigation, analysis |
| Designer | Crafter | UX/UI specs |
| Frontend Engineer | Crafter | UI implementation |
| Backend Engineer | Crafter | API implementation |
| Infrastructure Engineer | Crafter | Deployment, CI/CD |
| QA Engineer | Sprinter | Testing, validation |
| Governor | Crafter | Compliance review |

**Tier aliases** — workers reference `Thinker`, `Crafter`, `Sprinter` (not model IDs). You pick the actual models during setup.

**Context limits per tier** (configured in `opencode.jsonc`):

| Tier | Context Window | Output | Use for |
|------|---------------|--------|---------|
| Thinker | 800K tokens | 64K | PM, Architect — large codebase analysis, complex reasoning |
| Crafter | 512K tokens | 32K | Engineers, Governor — focused coding tasks |
| Sprinter | 256K tokens | 16K | QA — fast validation, targeted testing |

Context-gathering script adapts per tier: `context-gather.sh <dir> --tier thinker` (128KB/depth 4) vs `--tier sprinter` (32KB/depth 2).

## Worker Hierarchy

Each worker is a **Head** who can work AND spawn sub-workers for parallel tasks:

```
Dispatcher (Hermes)
  └── PM (Head, Thinker) → can spawn Researcher, Designer
  └── Architect (Head, Thinker) → can spawn Researcher, multiple Engineers
  └── Frontend (Head, Crafter) → can spawn Designer, sub-Frontend
  └── Backend (Head, Crafter) → can spawn Researcher, sub-Backend
  └── QA (Head, Sprinter) → can spawn sub-QA for parallel test suites
  └── ... (all 9 heads can spawn sub-workers)
```

Sub-workers use same or lower tier than their head (Thinker→Crafter, Crafter→Sprinter).

## Quick Start

```bash
# One-line install
curl -fsSL https://raw.githubusercontent.com/Deriest/aic-skill/main/scripts/setup.sh | bash
```

Or manually:

```bash
# 1. Install OpenCode
npm install -g opencode-ai@latest

# 2. Clone skill
git clone https://github.com/Deriest/aic-skill.git /tmp/aic-skill
cp -r /tmp/aic-skill/* ~/.hermes/skills/workflows/aic/

# 3. Load and go
hermes
> /aic build a REST API with JWT auth
```

## Setup

The setup script guides you through:

```
[1/4] Checking dependencies...     ✓ Node.js, npm, jq
[2/4] Installing OpenCode...       ✓ opencode-ai
[3/4] Configure your AI provider...
      1) Connect to API            → URL, API key, auto-detect models
      2) Free models               → zero config
      3) Skip                      → manual

      Select Thinker model [1]:    ← pick the complex reasoning model
      Select Crafter model [2]:    ← pick the standard coding model
      Select Sprinter model [3]:   ← pick the fast/lightweight model

[4/4] Installing AIC skill...      ✓ dashboard + deps
```

Works with **any** OpenAI-compatible API: OpenRouter, Anthropic, OpenAI, local proxies, LiteLLM, etc.

## Usage

```
hermes                  # start Hermes
/aic                    # activate Dispatcher mode (once per session)
build a REST API with JWT auth   # Dispatcher classifies → spawns workers
fix the login bug on mobile      # routes to bug pipeline
research rate limiting best practices  # routes to Researcher
/aic stop               # deactivate, return to normal Hermes
```

> `/yolo` — enable no-permission mode. Workers run without approval gates. Toggle off with `/yolo` again.

### Commands

| Command | What it does |
|---------|-------------|
| `/aic` | Activate Dispatcher mode (stays active for the session) |
| `/aic dashboard` | Start dashboard + API server |
| `/aic status` | Show current task progress |
| `/aic stop` | Deactivate Dispatcher mode |
| `/yolo` | Toggle YOLO mode (no permission prompts) |

**Once per session:** `/aic` stays active until `/aic stop` or session ends. No need to repeat it before every task.

## Dashboard

Pixel-art office dashboard with live worker status, task pipeline, and activity log.

| Service | Port | URL |
|---------|------|-----|
| Status API (Node) | 6868 | http://localhost:6868/api/status |
| Dashboard (Vite) | 6969 | http://localhost:6969 |

```bash
# Auto-start via chat
/aic dashboard

# Or manual
node ~/.hermes/skills/workflows/aic/scripts/server.js 6868
cd ~/.hermes/skills/workflows/aic/dashboard && npx vite --port 6969
```

Features:
- 10 worker desks with live status (idle/working/error)
- Task info + pipeline phases
- Activity log with ring buffer (no duplicates)
- Task history (last 50 tasks)

## Task Types

| Say this | Type | Pipeline |
|----------|------|----------|
| `build X` | feature | PM → Architect → [Designer] → Engineers → QA → Governor |
| `fix X` | bug | Engineer (→ QA if complex) |
| `research X` | research | Researcher (→ PM if actionable) |
| `design Y` | design | Designer |
| `audit X` | security | Backend → Governor |
| `deploy X` | infra | Infra → QA |
| `try/spike X` | experiment | Researcher → Architect (POC, not production) |
| `optimize X` | optimize | Architect → Engineers → QA |
| `improve X` | iterate | PM → Engineers → QA |
| `edit/fix X that doesn't match` | refine | Engineer(s) (targeted fix) |
| `migrate X to Y` | migrate | Architect → Engineers → QA → Governor |
| `clean up X` | maintain | Engineers → QA |
| `plan X` | planning | PM → Architect (specs only, no code) |
| `develop X` | develop | PM → Architect → Engineers → QA (multi-session) |

## Config

Two files, generated by setup:

**`~/.config/opencode/opencode.jsonc`** — canonical config for OpenCode:
```jsonc
{
  "provider": {
    "myprovider": {
      "npm": "@ai-sdk/openai-compatible",
      "options": { "baseURL": "https://...", "apiKey": "sk-..." },
      "models": {
        "Thinker": { "name": "claude-opus-4" },
        "Crafter": { "name": "claude-sonnet-4" },
        "Sprinter": { "name": "claude-haiku-3.5" }
      }
    }
  }
}
```

**`~/.hermes/skills/workflows/aic/.env`** — Dispatcher reads this for spawn commands:
```
PROVIDER_ID=myprovider
MODEL_THINKER=Thinker
MODEL_CRAFTER=Crafter
MODEL_SPRINTER=Sprinter
```

## Architecture

```
User → Hermes → Dispatcher (SKILL.md)
                    ├── PM (Thinker)
                    ├── Architect (Thinker)
                    ├── Engineers ×3 (Crafter)
                    ├── QA (Sprinter)
                    └── Governor (Crafter)
                    
Dashboard ← polls → server.js:6868 ← POST ← Dispatcher (curl)
```

Single-process Node server (`server.js`) holds all state in memory, flushes to `status.json` for restart resilience. Ring buffer for logs (100 entries), append-only `history.json` for completed tasks.

## License

MIT
