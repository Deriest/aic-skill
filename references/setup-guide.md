# AI Engineering Company (AIC) — Setup Guide

## Quick Install

```bash
# 1. Install OpenCode (requires Node.js >= 18)
npm install -g opencode-ai@latest

# 2. Run setup script (auto-detects models from proxy)
bash ~/.hermes/skills/workflows/aic/scripts/setup.sh
```

## Setup Flow (Option 1: OpenAI-Compatible Proxy)

The setup script will:
1. Ask for **Base URL** (e.g. `http://192.168.2.11:20128/v1`)
2. Ask for **API Key**
3. Auto-fetch models from `{BASE_URL}/models` endpoint
4. Display a numbered list of available models
5. Let you pick 3 models for task tiers:
   - **COMPLEX** (PM, Architect) — default: model #1
   - **STANDARD** (Engineers, Governor) — default: model #2
   - **FAST** (QA) — default: model #3
6. Auto-generate `opencode.jsonc` and `.env`

## Config Files Generated

### `~/.config/opencode/opencode.jsonc`
```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "tvd": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "tvd Proxy",
      "options": {
        "baseURL": "http://192.168.2.11:20128/v1",
        "apiKey": "sk-..."
      },
      "models": {
        "Opus": { "name": "actual-model-id-from-api" },
        "Sonnet": { "name": "actual-model-id-from-api" },
        "Haiku": { "name": "actual-model-id-from-api" }
      }
    }
  }
}
```

**Key:** `Opus`/`Sonnet`/`Haiku` are the OpenCode model keys (used in `--model tvd/Opus`). The `name` field holds the actual API model ID.

### `~/.hermes/skills/workflows/aic/.env`
```
PROVIDER_ID=tvd
MODEL_OPUS=Opus
MODEL_SONNET=Sonnet
MODEL_HAIKU=Haiku
```

## Usage

```bash
# Via Hermes
/aic
build a REST API for user auth

# Direct OpenCode
opencode run "implement auth" --model tvd/Sonnet
opencode run "design system architecture" --model tvd/Opus
opencode run "run tests" --model tvd/Haiku
```

## Other Provider Options

The setup script also supports:
- **OpenRouter** — multi-provider, requires API key
- **Anthropic** — Claude direct, requires API key
- **OpenAI** — GPT direct, requires API key
- **Free models** — no auth needed (rate-limited)
- **Skip** — manual config

## Troubleshooting

| Error | Fix |
|---|---|
| `opencode: command not found` | `npm install -g opencode-ai@latest` |
| `Node.js >= 18 required` | Upgrade Node.js from https://nodejs.org/ |
| `Failed to fetch models` | Check Base URL and API key; script falls back to manual model entry |
| `No active credentials for provider: openai` | Model key = API name instead of generic Opus/Sonnet/Haiku. Re-run setup. |
| Config not found | Run `/aic` to complete first-run setup |
