# AI Engineering Company (AIC) — Hermes Skill

10-worker orchestration system for AI-powered software development.

## What It Does

Your agent becomes a Dispatcher that manages 10 specialized AI workers:

- **Product**: PM, Researcher, Designer
- **Engineering**: Architect, Frontend, Backend, Infra, QA
- **Governance**: Governor

## Quick Install

```
1. Install OpenCode
npm install -g opencode-ai@latest

2. Install skill
git clone https://github.com/Deriest/aic-skill.git
cp -r aic-skill/* ~/.hermes/skills/workflows/aic/

3. Load and configure
/aic
```

## Configure

The Dispatcher will ask you:

```
What is your API key?
> sk-or-xxx

Choose your model tier:
  1) Claude (Thinker/Crafter/Sprinter) via OpenRouter
  2) Claude (Thinker/Crafter/Sprinter) via Anthropic direct
  3) GPT-4o / GPT-4o-mini via OpenAI
  4) Free (deepseek-v4-flash-free)
  5) Custom

> 1
```

Done! This auto-generates .env and configures OpenCode.

## Usage

```
/aic
build a REST API for user authentication with JWT
```

## Dashboard

Monitor agents visually with the AIC Office dashboard (React + Vite + Framer Motion):

| Service | Port | Purpose |
|---|---|---|
| Vite dev server | 6969 | React UI |
| Status API (Node) | 3000 | `/api/status` JSON |

### Start with `/aic dashboard`

Say `/aic dashboard` in chat to automatically start both services and open the browser at **http://localhost:6969**.

### Manual start

```bash
# Vite UI
cd dashboard && npx vite --port 6969

# API server
node scripts/server.js 3000
```

Open **http://localhost:6969** in your browser.

Features:
- 10 worker cards with live status
- Current task info
- Pipeline phases
- Activity log

## Workers

All 9 workers use **OpenCode** (`opencode run`) as their engine. Only the Dispatcher uses `delegate_task` (for orchestrating parallel phases).

| Worker | Model | Engine | Purpose |
|---|---|---|---|
| PM | opus | opencode run | Requirements |
| Architect | opus | opencode run | System design |
| Researcher | sonnet | opencode run | Investigation |
| Designer | sonnet | opencode run | UX specs |
| Frontend | sonnet | opencode run | UI code |
| Backend | sonnet | opencode run | API code |
| Infra | sonnet | opencode run | Deployment |
| QA | haiku | opencode run | Testing |
| Governor | sonnet | opencode run | Compliance |

## Task Types

| Say This | Type | Workers |
|---|---|---|
| build X | feature | PM - Architect - Engineers - QA - Governor |
| fix bug | bug | Backend/Frontend |
| research X | research | Researcher |
| design Y | design | Designer |
| security audit | security_review | Backend - Governor |

## .env File

```
PROVIDER=openrouter
API_KEY=sk-or-xxx
MODEL_THINKER=anthropic/claude-opus-4
MODEL_CRAFTER=anthropic/claude-sonnet-4
MODEL_SPRINTER=anthropic/claude-haiku-3.5
```

## License

MIT
