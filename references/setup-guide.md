# AI Engineering Company (AIC) — Setup Guide

## Quick Install

```bash
# 1. Install OpenCode (requires Node.js >= 18)
npm install -g opencode-ai@latest

# 2. Run setup script (auto-detects models from API)
bash ~/.hermes/skills/workflows/aic/scripts/setup.sh
```

## Setup Options

| # | Option | What it does |
|---|--------|-------------|
| 1 | **Connect to API** | URL → API key → auto-fetch /v1/models → pick Thinker/Crafter/Sprinter |
| 2 | **Free models** | No auth, uses deepseek-v4-flash-free (rate-limited) |
| 3 | **Skip** | Manual config |

Option 1 works with **any** OpenAI-compatible API: OpenRouter, Anthropic, OpenAI, local proxies, LiteLLM, etc.

## Setup Flow (Option 1: API)

1. Enter **Base URL** (e.g. `https://openrouter.ai/api/v1` or `http://192.168.2.11:20128/v1`)
2. Enter **API Key**
3. Enter **Provider ID** (short name, e.g. `openrouter`, `tvd`)
4. Script auto-fetches models from `{BASE_URL}/models`
5. Pick 3 models by number:
   - **Thinker** (PM, Architect, complex reasoning) — default: #1
   - **Crafter** (Engineers, standard coding) — default: #2
   - **Sprinter** (QA, fast/lightweight) — default: #3
6. Auto-generates `opencode.jsonc` + `.env`

## Config Files Generated

### `~/.config/opencode/opencode.jsonc`
```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "myprovider": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "myprovider",
      "options": {
        "baseURL": "https://openrouter.ai/api/v1",
        "apiKey": "sk-..."
      },
      "models": {
        "Thinker": { "name": "anthropic/claude-opus-4" },
        "Crafter": { "name": "anthropic/claude-sonnet-4" },
        "Sprinter": { "name": "anthropic/claude-haiku-3.5" }
      }
    }
  }
}
```

**Key:** `Thinker`/`Crafter`/`Sprinter` are OpenCode model keys (used in `--model provider/Thinker`). The `name` field holds the actual API model ID.

### `~/.hermes/skills/workflows/aic/.env`
```
PROVIDER_ID=myprovider
MODEL_THINKER=Thinker
MODEL_CRAFTER=Crafter
MODEL_SPRINTER=Sprinter
```

## Usage

```bash
# Via Hermes
/aic
build a REST API for user auth

# Direct OpenCode
opencode run "implement auth" --model myprovider/Crafter
opencode run "design system architecture" --model myprovider/Thinker
opencode run "run tests" --model myprovider/Sprinter
```

## Troubleshooting

| Error | Fix |
|---|---|
| `opencode: command not found` | `npm install -g opencode-ai@latest` |
| `Node.js >= 18 required` | Upgrade Node.js from https://nodejs.org/ |
| `Failed to fetch models` | Check Base URL and API key; script falls back to manual model entry |
| `No active credentials for provider: openai` | Known OpenCode bug with custom providers in `run` mode. Use `delegate_task` as fallback. |
| Config not found | Run `/aic` to complete first-run setup |
