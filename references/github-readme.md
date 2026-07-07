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
  1) Claude (Opus/Sonnet/Haiku) via OpenRouter
  2) Claude (Opus/Sonnet/Haiku) via Anthropic direct
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

## Workers

| Worker | Model | Engine | Purpose |
|---|---|---|---|
| PM | opus | delegate_task | Requirements |
| Architect | opus | delegate_task | System design |
| Researcher | sonnet | delegate_task | Investigation |
| Designer | sonnet | delegate_task | UX specs |
| Frontend | sonnet | opencode run | UI code |
| Backend | sonnet | opencode run | API code |
| Infra | sonnet | opencode run | Deployment |
| QA | haiku | opencode run | Testing |
| Governor | sonnet | delegate_task | Compliance |

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
MODEL_OPUS=anthropic/claude-3-opus
MODEL_SONNET=anthropic/claude-3-sonnet
MODEL_HAIKU=anthropic/claude-3-haiku
```

## License

MIT
