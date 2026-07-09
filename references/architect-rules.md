# AIC Architecture & Rules

## 1. Local State Database (`.aic/`)

All task history, metrics, and state live in the `.aic/` folder locally.

**CRITICAL PITFALL**: NEVER run `git reset --hard` or aggressive git cleanups in the AIC repo to resolve merge conflicts without verifying that `.aic/` is safely ignored in `.gitignore`. Doing so will permanently delete the user's task history, active sessions, and metrics. Always stash or backup state before manipulating git history.

## 2. Lifecycle Enforcement (server.js)

The server strictly enforces a 5-phase workflow: `Investigate` → `Planning` → `Implementation` → `Verification` → `Closeout`.

Any attempt to set a worker to `working` before its allowed phase will result in an HTTP 403 error. The Dispatcher MUST advance the phase via `/api/task-status` or `/api/phase-start` before spawning workers.

## 3. Worker Status Lifecycle

When a worker finishes its opencode run, `spawn-worker.sh` MUST set the status to `complete` (green) via the API, not `idle`. Setting it to `idle` makes the worker appear inactive immediately, preventing the dashboard UI from ever showing the task as completed.

## 4. Context Window Limits

Do NOT enforce artificial context limits (e.g., `AIC_CTX_THINKER_KB`). Modern models and the OpenCode engine handle chunking natively and will spawn sub-agents to process large files in parallel. Manual truncation scripts break the agent's ability to read full contexts. Let the engine handle it automatically.

## 5. Minimal Dashboard

The dashboard is stripped down to exactly three components:
- **Virtual Office** (Worker Grid, live updates)
- **Pipeline Tracker** (Visualizes the 5 phases)
- **Config Editor** (Edits `.env` and `opencode.jsonc`)

*Activity logs, history pages, and the old chat UI have been permanently removed.*

## 6. Dispatcher Role

The Dispatcher (Hermes) is the **sole** user-facing communicator. It never delegates user conversations to the PM. The PM is strictly a backend spec-writer. The Dispatcher automatically switches to Indonesian if the user uses it.

## 7. CLI Entrypoint

The `./aic dashboard` command serves the API and static frontend from the same Node process (port 6868). It auto-updates from GitHub, checks OpenCode configuration, and outputs a greeting from the Dispatcher before handing off to Hermes.
