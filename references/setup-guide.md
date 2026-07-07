# AI Engineering Company (AIC) — Setup Guide

## Install

```bash
# 1. Install OpenCode
npm install -g opencode-ai@latest

# 2. Install skill
git clone https://github.com/Deriest/aic-skill.git
cp -r aic-skill/* ~/.hermes/skills/workflows/aic/

# 3. Load and configure
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
  4) Free (deepseek-v4-flash-free) no key needed
  5) Custom - enter your own models

> 1
```

Done! This saves `.env` and configures OpenCode automatically.

## .env File

```
PROVIDER=openrouter
API_KEY=sk-or-xxx
MODEL_OPUS=anthropic/claude-3-opus
MODEL_SONNET=anthropic/claude-3-sonnet
MODEL_HAIKU=anthropic/claude-3-haiku
```

Edit anytime: `~/.hermes/skills/workflows/aic/.env`

## Usage

```
/aic
build a REST API for user auth
```

## Troubleshooting

| Error | Fix |
|---|---|
| opencode: command not found | npm install -g opencode-ai@latest |
| Config not found | Run /aic to complete first-run setup |

License: MIT