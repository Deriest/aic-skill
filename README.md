# AIC — AI Engineering Company

**Full-stack AI orchestration system that coordinates 9 specialized workers to build software.**

AIC turns your Hermes agent into a Dispatcher — an AI engineering manager that classifies tasks, breaks them into phases, assigns specialized workers (Architect, Frontend Engineer, Backend Engineer, QA, etc.), and coordinates parallel execution. One task in, working code out.

## What It Does

```
You: "build a REST API with JWT auth"
AIC:  PM breaks it down → Architect designs → Backend builds → QA tests → Governor reviews
      All coordinated automatically, workers run in parallel when possible.
```

**9 Specialized Workers:**

| Worker | Tier | Responsibility |
|--------|------|----------------|
| **PM** (Project Manager) | Thinker | Breaks down tasks, translates user intent to specs |
| **Architect** | Thinker | System design, architecture decisions |
| **UI/UX Engineer** | Crafter | Interface design, user flows |
| **Frontend Engineer** | Crafter | React/TS/CSS implementation |
| **Backend Engineer** | Crafter | APIs, databases, server logic |
| **QA Engineer** | Sprinter | Testing, verification, validation |
| **DevOps Engineer** | Crafter | CI/CD, Docker, deployment |
| **Security Engineer** | Crafter | Security audit, vulnerability scanning |
| **Integration Engineer** | Crafter | System integration, API contracts |

**3 Tiers (Model Levels):**

| Tier | Model | Context | Output | Purpose |
|------|-------|---------|--------|---------|
| **Thinker** | TVD/Opus | 800K | 64K | Complex reasoning, architecture, planning |
| **Crafter** | TVD/Sonnet | 512K | 32K | Coding, implementation, file operations |
| **Sprinter** | TVD/Haiku | 256K | 16K | Quick tasks, testing, simple edits |

Workers are **Heads** — each can spawn sub-workers in parallel for faster execution.

---

## Installation

### Prerequisites

- **Node.js** v18+ and npm
- **Hermes Agent** (for desktop/Telegram mode) — [install guide](https://hermes-agent.nousresearch.com/docs)
- **AI Provider** — any OpenAI-compatible API (OpenRouter, Anthropic, local proxy, LiteLLM, etc.)

### Quick Install (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/Deriest/aic-skill/main/scripts/setup.sh | bash
```

The setup script will:
1. Check dependencies (Node.js, npm, jq)
2. Install OpenCode CLI
3. Configure your AI provider (URL, API key, model selection)
4. Install AIC skill + dashboard

### Manual Install

```bash
# 1. Install OpenCode
npm install -g opencode-ai@latest

# 2. Clone AIC skill
git clone https://github.com/Deriest/aic-skill.git /tmp/aic-skill
cp -r /tmp/aic-skill/* ~/.hermes/skills/workflows/aic/

# 3. Configure AI provider
# Edit ~/.hermes/skills/workflows/aic/.env
cat > ~/.hermes/skills/workflows/aic/.env << 'EOF'
BASE_URL=http://your-api-proxy:port/v1
API_KEY=your-api-key-here
MODEL_THINKER=Thinker
MODEL_CRAFTER=Crafter
MODEL_SPRINTER=Sprinter
EOF

# 4. Configure OpenCode models
# Edit ~/.config/opencode/opencode.jsonc
# See Configuration section below for full template

# 5. Install dashboard dependencies
cd ~/.hermes/skills/workflows/aic/dashboard
npm install

# 6. Build dashboard
npx vite build
```

### Update

```bash
cd ~/.hermes/skills/workflows/aic
./aic update
```

---

## Usage

AIC can be used in 3 ways: **Hermes Desktop**, **Telegram Gateway**, or **Standalone Web Dashboard**.

---

### 1. Via Hermes Desktop (Recommended)

The primary interface. Chat directly with Hermes in the desktop app.

```bash
# Start Hermes
hermes

# Activate AIC (once per session)
/aic

# Give it a task
build a REST API with JWT auth
fix the login bug on mobile
research rate limiting best practices

# Commands
/aic              # activate Dispatcher mode
/aic dashboard    # start web dashboard
/aic status       # show current task progress
/aic stop         # deactivate, return to normal Hermes
/yolo             # toggle no-permission mode
```

**How it works:**
- `/aic` activates the Dispatcher — Hermes reads SKILL.md and becomes the orchestrator
- You describe tasks in natural language
- Dispatcher classifies the task, picks the right pipeline, spawns workers
- Workers run via OpenCode CLI with the appropriate tier model
- Progress is tracked in the dashboard

---

### 2. Via Telegram Gateway

Use AIC from Telegram — send tasks as messages, get progress updates.

**Setup:**

1. Configure Hermes Telegram gateway:
   ```bash
   hermes config set gateway telegram
   hermes config set telegram.token YOUR_BOT_TOKEN
   hermes config set telegram.chat_id YOUR_CHAT_ID
   ```

2. Start Hermes with gateway:
   ```bash
   hermes
   ```

3. Send tasks via Telegram:
   ```
   /aic build a todo app with React
   ```

**Features:**
- Send tasks as Telegram messages
- Get progress updates in the chat
- Dashboard link included in responses
- Works on mobile — full AIC from your phone

**Telegram-specific commands:**
```
/aic dashboard    # get dashboard URL
/aic status       # current task status
/aic stop         # stop AIC
```

---

### 3. Via Web Dashboard (Standalone)

Full web interface — no Hermes desktop needed. Chat with the Orchestrator, manage tasks, monitor workers.

**Start the dashboard:**

```bash
# Start API server
node ~/.hermes/skills/workflows/aic/scripts/server.js 6868

# Start dashboard (in another terminal)
cd ~/.hermes/skills/workflows/aic/dashboard
npx vite --port 6969 --host
```

**Or use the AIC command:**
```bash
cd ~/.hermes/skills/workflows/aic
./aic dashboard
```

**Access:** http://localhost:6969

**Dashboard Pages:**

| Page | What It Does |
|------|-------------|
| **Overview** | Office view — see all 9 workers at their desks, live status |
| **Chat** | Talk to the Orchestrator AI — create tasks, ask questions, get updates |
| **Config** | View/edit tier settings (Thinker/Crafter/Sprinter), API keys, model config |
| **Tasks** | View current task, queue status — tasks created via Chat |
| **Workers** | Monitor all 9 workers — status, tokens used, cost, circuit breakers |
| **History** | Completed tasks table + analytics chart |
| **Audit** | Full audit log of all actions (searchable, paginated) |
| **System** | Health status, uptime, total cost, environment info |

**Chat Features:**
- Persistent history (survives page refresh)
- Pin important messages (survive "Clear All")
- Delete individual messages
- Connected to AIC Orchestrator with full context (workers, queue, task state)

---

### 4. Run Without Hermes Desktop

For headless servers, CI/CD, or when you only want the web dashboard.

**Option A: Dashboard only (monitoring)**
```bash
# Start API server (background)
nohup node ~/.hermes/skills/workflows/aic/scripts/server.js 6868 &

# Start dashboard (background)
cd ~/.hermes/skills/workflows/aic/dashboard
nohup npx vite --port 6969 --host &
```

**Option B: Full AIC via cron (automated tasks)**
```bash
# Schedule AIC to check for queued tasks every 5 minutes
hermes cron create --schedule "*/5 * * * *" --prompt "Check AIC task queue and process next task" --workdir ~/.hermes/skills/workflows/aic
```

**Option C: Docker (coming soon)**
```bash
docker run -p 6868:6868 -p 6969:6969 deriest/aic:latest
```

---

## Configuration

### Environment File

**`~/.hermes/skills/workflows/aic/.env`**

```env
# AI Provider
BASE_URL=http://192.168.2.11:20128/v1
API_KEY=your-api-key-here

# Model assignments per tier
MODEL_THINKER=Opus
MODEL_CRAFTER=Sonnet
MODEL_SPRINTER=Haiku
```

### OpenCode Config

**`~/.config/opencode/opencode.jsonc`**

```jsonc
{
  "provider": {
    "myprovider": {
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "baseURL": "http://192.168.2.11:20128/v1",
        "apiKey": "your-api-key"
      },
      "models": {
        "Thinker": {
          "name": "claude-opus-4",
          "limit": { "context": 800000, "output": 64000 }
        },
        "Crafter": {
          "name": "claude-sonnet-4",
          "limit": { "context": 512000, "output": 32000 }
        },
        "Sprinter": {
          "name": "claude-haiku-3.5",
          "limit": { "context": 256000, "output": 16000 }
        }
      }
    }
  }
}
```

### Dashboard Config

Edit via the **Config page** in the dashboard (http://localhost:6969/config):
- **Tiers tab** — view tier assignments, model info, context limits
- **Env tab** — edit `.env` (secrets redacted)
- **Opencode tab** — edit `opencode.jsonc`

---

## Task Types

| Say This | Type | Pipeline |
|----------|------|----------|
| `build X` | feature | PM → Architect → [Designer] → Engineers → QA → Governor |
| `fix X` | bug | Engineer (→ QA if complex) |
| `research X` | research | Researcher (→ PM if actionable) |
| `design Y` | design | Designer |
| `audit X` | security | Backend → Governor |
| `deploy X` | infra | Infra → QA |
| `try/spike X` | experiment | Researcher → Architect (POC) |
| `optimize X` | optimize | Architect → Engineers → QA |
| `improve X` | iterate | PM → Engineers → QA |
| `migrate X to Y` | migrate | Architect → Engineers → QA → Governor |
| `clean up X` | maintain | Engineers → QA |
| `plan X` | planning | PM → Architect (specs only) |
| `develop X` | develop | PM → Architect → Engineers → QA (multi-session) |

---

## Architecture

```
User Input (Desktop / Telegram / Web Chat)
    │
    ▼
Dispatcher (Hermes / Orchestrator AI)
    │
    ├── PM (Thinker) ──────────── spawns Researcher, Designer
    ├── Architect (Thinker) ───── spawns Researcher, Engineers
    ├── UI/UX Engineer (Crafter)
    ├── Frontend Engineer (Crafter) ── spawns Designer, sub-Frontend
    ├── Backend Engineer (Crafter) ─── spawns Researcher, sub-Backend
    ├── QA Engineer (Sprinter) ─────── spawns sub-QA (parallel tests)
    ├── DevOps Engineer (Crafter) ──── spawns Researcher, sub-Infra
    ├── Security Engineer (Crafter)
    └── Integration Engineer (Crafter)

Dashboard ← REST API → server.js:6868 ← POST ← Dispatcher (curl)
    │
    ├── http://localhost:6969 (Vite dev / static build)
    └── SSE streaming for Chat
```

**Data flow:**
- `server.js` holds state in memory, persists to `.aic/state.json`
- `audit.json` — append-only audit log (last 1000 entries)
- `history.json` — completed tasks
- `chat-history.json` — chat messages (pinned support)
- Dashboard polls `/api/workers`, `/api/health` every 5s
- Chat uses SSE streaming via `/api/chat`

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health + uptime |
| GET | `/api/config` | Read config (secrets redacted) |
| POST | `/api/config/env` | Update `.env` |
| POST | `/api/config/opencode` | Update `opencode.jsonc` |
| GET | `/api/workers` | All worker status + metrics |
| POST | `/api/task-start` | Start a task |
| POST | `/api/task-enqueue` | Add task to queue |
| POST | `/api/task-cancel` | Cancel task |
| GET | `/api/queue` | Current task queue |
| POST | `/api/phase-start` | Update current phase |
| POST | `/api/phase-complete` | Mark phase done |
| POST | `/api/agent-status` | Update worker status |
| GET | `/api/cost` | Total tokens + cost |
| POST | `/api/cost` | Add token usage |
| GET | `/api/analytics` | Task analytics by type |
| GET | `/api/history` | Completed task history |
| GET | `/api/audit` | Full audit log |
| POST | `/api/reset` | Reset all state |
| POST | `/api/chat` | Chat with Orchestrator (SSE) |
| GET | `/api/chat/history` | Load chat history |
| POST | `/api/chat/history` | Save chat message |
| DELETE | `/api/chat/history` | Clear chat (keeps pinned) |
| DELETE | `/api/chat/history/:id` | Delete single message |
| POST | `/api/chat/history/:id/pin` | Toggle pin |

---

## Project Structure

```
~/.hermes/skills/workflows/aic/
├── aic                     # CLI entry point (bash)
├── SKILL.md                # Dispatcher instructions
├── .env                    # Provider config
├── scripts/
│   ├── server.js           # API server (port 6868)
│   ├── context-gather.sh   # Tier-aware context collection
│   └── setup.sh            # Installation script
├── dashboard/
│   ├── src/                # React + TypeScript frontend
│   │   ├── pages/          # 8 dashboard pages
│   │   ├── components/     # Shared components
│   │   ├── context/        # React contexts (Chat, Config, Dashboard)
│   │   ├── api/            # API client functions
│   │   └── types/          # TypeScript types
│   ├── dist/               # Built frontend
│   └── package.json
├── history.json            # Completed tasks
├── audit.json              # Action audit log
├── chat-history.json       # Chat persistence
└── .aic/state.json         # Server state (auto-created)
```

---

## Troubleshooting

**Dashboard shows "OFFLINE"**
- Check API server: `curl http://localhost:6868/health`
- Restart: `node ~/.hermes/skills/workflows/aic/scripts/server.js 6868`

**Chat not responding**
- Check `.env` has correct `BASE_URL` and `API_KEY`
- Test provider: `curl http://your-provider/v1/models`
- Check server logs for errors

**Workers not spawning**
- Ensure OpenCode is installed: `opencode --version`
- Check `opencode.jsonc` has correct provider config
- Verify API key has sufficient credits/quota

**TypeScript errors after update**
```bash
cd ~/.hermes/skills/workflows/aic/dashboard
npm install
npx tsc --noEmit
```

---

## License

MIT
