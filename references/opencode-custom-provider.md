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
        "gpt-4": { "name": "GPT-4" },
        "gpt-3.5": { "name": "GPT-3.5 Turbo" }
      }
    }
  }
}
```

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
        "anthropic/claude-3-opus": { "name": "Claude 3 Opus" },
        "anthropic/claude-3-sonnet": { "name": "Claude 3 Sonnet" },
        "anthropic/claude-3-haiku": { "name": "Claude 3 Haiku" }
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
| `No active credentials for provider: openai` | Using `provider.openai` with custom baseURL | Use custom provider ID |
| `API key invalid` | Wrong API key | Check provider dashboard |
| `Model not found` | Model ID mismatch | Check `/v1/models` endpoint |
| `Connection refused` | Wrong baseURL | Verify URL format |
| `Binary locked` (Windows) | OpenCode process running | `taskkill /F /IM opencode.exe` |
| `Binary locked` (Linux/macOS) | OpenCode process running | `pkill opencode` |
