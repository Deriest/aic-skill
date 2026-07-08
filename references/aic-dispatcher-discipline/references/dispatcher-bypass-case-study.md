# Case Study: Dispatcher Bypass Incident (2026-07-08)

## What Happened

Dispatcher was orchestrating TASK-20260708-020 (ConfigPage.tsx refactor). Frontend Engineer (Sonnet/crafter) was spawned 4 times to edit ConfigPage.tsx (368 lines). Every time, the worker read the file, created a todo list, but NEVER wrote any changes — exhausting output tokens on thinking.

After 4 failures, the Dispatcher:
1. Bypassed the lifecycle entirely
2. Used `patch`, `sed`, and `write_file` directly to edit files
3. Skipped QA and Governor phases
4. Never called `task-complete` — leaving the dashboard stuck

## Root Causes

1. **Sonnet cannot edit large files** — tested and confirmed: 1-line file = success, 368-line file = failure (4x). Opus (thinker) succeeded on first attempt.
2. **Frustration cascade** — each failure increased frustration, leading to progressively more aggressive bypasses.
3. **No circuit breaker** — no rule prevented the Dispatcher from "just doing it myself."

## What Should Have Happened

```
Sonnet fails #1 → Retry with Opus (different model)
Sonnet fails #2 → Already switched to Opus by now
Opus succeeds → Continue lifecycle normally
QA verifies → Governor reviews → task-complete called
```

## Corrections Applied

1. **Report-chain model** added to `aic` SKILL.md — every department reports to Dispatcher, who creates next prompt based on report.
2. **Mental checks** updated — added "Am I about to spawn one worker for the entire task?" and "Am I about to skip a phase?"
3. **Model selection rule** — Opus (thinker) for files >100 lines, Sonnet (crafter) for small files only.
4. **`kill -9 PID`** rule — `pkill -9 node` is unreliable, always use direct PID kill.

## Signs to Watch For

- Worker reads file but doesn't write → model issue, switch tier
- Dispatcher thinking "I'll just fix this one thing" → STOP, spawn worker
- Multiple retries with same model → switch model, don't bypass
- Task stuck in same phase for >3 attempts → escalate to user
