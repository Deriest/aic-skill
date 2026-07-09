# OpenCode Free Models — Tested Configuration

## Recommended Model

**`opencode/deepseek-v4-flash-free`** — fast, reliable, no auth required.

```bash
opencode run "task" --model opencode/deepseek-v4-flash-free
```

## All Free Models

| Model | Speed | Status | Notes |
|---|---|---|---|
| `opencode/deepseek-v4-flash-free` | Fast | ✅ Tested | Best for coding workers |
| `opencode/mimo-v2.5-free` | Medium | Untested | |
| `opencode/nemotron-3-ultra-free` | Medium | Untested | |
| `opencode/north-mini-code-free` | Slow | ⚠️ Timeout | Observed timeout >60s |
| `opencode/big-pickle` | Slow | Untested | |

## Verified Test (2026-07-06)

```bash
# Basic hello — worked in <5s
opencode run "Say hello" --model opencode/deepseek-v4-flash-free
# Output: Hello

# Code creation + execution — worked in <10s
opencode run "Create a file called test.py with a function hello() that returns 'OpenCode works!' and a test for it. Then run the test." \
  --model opencode/deepseek-v4-flash-free
# Created file, ran test, confirmed pass
```

## Pitfalls

- `north-mini-code-free` can timeout on non-trivial tasks. Use `deepseek-v4-flash-free` instead.
- `opencode run` (one-shot) does NOT need `pty=true`. Only the interactive TUI does.
- Free models have rate limits — if you get 429s, wait or switch to a paid provider.
# OpenCode Custom Provider Configuration

## Overview

OpenCode supports custom OpenAI-compatible providers. This guide shows how to configure your own proxy or API endpoint.

## Critical Rule

**Always use `npm: "@ai-sdk/openai-compatible"` for custom providers.**

Do NOT use `provider.openai` with a custom baseURL — it silently fails.

## Configuration Pattern

### File Location

```
~/.config/opencode/opencode.jsonc
```

### Template

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "YOUR_PROVIDER_ID": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Your Provider Name",
      "options": {
        "baseURL": "https://your-api.com/v1",
        "apiKey": "sk-..."
      },
      "models": {
        "opus": { "name": "your-opus-model" },
        "sonnet": { "name": "your-sonnet-model" },
        "haiku": { "name": "your-haiku-model" }
      }
    }
  }
}
```

### Usage

```bash
opencode run "task" --model YOUR_PROVIDER_ID/sonnet
```

## Provider Examples

### Self-hosted Proxy

```jsonc
{
  "provider": {
    "myproxy": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "My Proxy",
      "options": {
        "baseURL": "https://my-api.com/v1",
        "apiKey": "sk-..."
      },
      "models": {
        "opus": { "name": "GPT-4" },
        "sonnet": { "name": "GPT-3.5 Turbo" },
        "haiku": { "name": "GPT-3.5 Turbo" }
      }
    }
  }
}
```
Usage: `opencode run --model myproxy/opus` → sends `GPT-4` to API.

⚠️ Model keys MUST be `opus`, `sonnet`, `haiku` (generic). The `name` field holds the actual API model name. Do NOT use the API model name as the key — it breaks `opencode run`.

### OpenRouter

```jsonc
{
  "provider": {
    "openrouter": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "OpenRouter",
      "options": {
        "baseURL": "https://openrouter.ai/api/v1",
        "apiKey": "sk-or-..."
      },
      "models": {
        "opus": { "name": "anthropic/claude-3-opus" },
        "sonnet": { "name": "anthropic/claude-3-sonnet" },
        "haiku": { "name": "anthropic/claude-3-haiku" }
      }
    }
  }
}
```

### Anthropic (Direct)

```jsonc
{
  "provider": {
    "anthropic": {
      "npm": "@ai-sdk/anthropic",
      "name": "Anthropic",
      "options": {
        "apiKey": "sk-ant-..."
      },
      "models": {
        "claude-3-opus-20240229": { "name": "Claude 3 Opus" },
        "claude-3-sonnet-20240229": { "name": "Claude 3 Sonnet" },
        "claude-3-haiku-20240307": { "name": "Claude 3 Haiku" }
      }
    }
  }
}
```

### OpenAI (Direct)

```jsonc
{
  "provider": {
    "openai": {
      "npm": "@ai-sdk/openai",
      "name": "OpenAI",
      "options": {
        "apiKey": "sk-..."
      },
      "models": {
        "gpt-4o": { "name": "GPT-4o" },
        "gpt-4o-mini": { "name": "GPT-4o Mini" },
        "gpt-4-turbo": { "name": "GPT-4 Turbo" }
      }
    }
  }
}
```

## Debugging

```bash
# Check if provider is loaded
opencode debug config

# List available providers
opencode providers list

# Test with a simple prompt
opencode run "say hello" --model YOUR_PROVIDER_ID/sonnet
```

## Common Issues

| Error | Cause | Fix |
|---|---|---|
| `No active credentials for provider: openai` | Model key = API model name instead of generic `opus/sonnet/haiku` | Use generic keys, put API name in `name` field |
| `No active credentials for provider: openai` | Using `provider.openai` with custom baseURL | Use custom provider ID |
| `API key invalid` | Wrong API key | Check provider dashboard |
| `Model not found` | Model ID mismatch | Check `/v1/models` endpoint, verify `name` field matches |
| `Connection refused` | Wrong baseURL | Verify URL format |
| `Binary locked` (Windows) | OpenCode process running | `taskkill /F /IM opencode.exe` |
| `Binary locked` (Linux/macOS) | OpenCode process running | `pkill opencode` |
