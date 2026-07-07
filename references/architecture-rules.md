# AIC Architecture & Constraints (Updated 2026-07-07)

## 1. Lifecycle Enforcement (server.js)
The server strictly enforces a 5-phase workflow ("harga mati"): `Investigate` → `Planning` → `Execution` → `Documentation` → `Verification`. 
Any attempt to set a worker to `working` before its allowed phase will result in an HTTP 403 error. The Dispatcher MUST advance the phase via `/api/task-status` or `/api/phase-start` before spawning workers.

## 2. Minimal Dashboard
The dashboard is stripped down to exactly three components:
- **Virtual Office** (Worker Grid, live updates)
- **Pipeline Tracker** (Visualizes the 5 phases)
- **Config Editor** (Edits `.env` and `opencode.jsonc`)
*Activity logs, history pages, and the old chat UI have been permanently removed.*

## 3. Dispatcher Role
The Dispatcher (Hermes) is the **sole** user-facing communicator. It never delegates user conversations to the PM. The PM is strictly a backend spec-writer. The Dispatcher automatically switches to Indonesian if the user uses it.

## 4. CLI Entrypoint
The `./aic dashboard` command serves the API and static frontend from the same Node process (port 6868). It auto-updates from GitHub, checks OpenCode configuration, and outputs a greeting from the Dispatcher before handing off to Hermes.