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
