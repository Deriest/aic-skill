# AIC Architecture & Maintenance Rules

## 1. Local State Database (`.aic/`)
All task history, metrics, and state live in the `.aic/` folder locally. 
**CRITICAL PITFALL**: NEVER run `git reset --hard` or aggressive git cleanups in the AIC repo to resolve merge conflicts without verifying that `.aic/` is safely ignored in `.gitignore`. Doing so will permanently delete the user's task history, active sessions, and metrics. Always stash or backup state before manipulating git history.

## 2. Worker Status Lifecycle
When a worker finishes its opencode run, `spawn-worker.sh` MUST set the status to `complete` (green) via the API, not `idle`. Setting it to `idle` makes the worker appear inactive immediately, preventing the dashboard UI from ever showing the task as completed.

## 3. Context Window Limits
Do NOT enforce artificial context limits (e.g., `AIC_CTX_THINKER_KB`). Modern models and the OpenCode engine handle chunking natively and will spawn sub-agents to process large files in parallel. Manual truncation scripts break the agent's ability to read full contexts. Let the engine handle it automatically.