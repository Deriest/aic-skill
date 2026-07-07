# AIC Operations Troubleshooting & Pitfalls

## 1. OpenCode Custom Provider Mismatches
**Symptom:** `opencode run` fails with "UnknownError: Unexpected server error" or "No active credentials for provider".
**Cause:** Mismatch between the proxy's expected model IDs or provider names and the CLI configuration.
**Fix:** 
- Ensure `.env` variable names exactly match what the deployment script expects (e.g., `MODEL_CRAFTER`, `MODEL_THINKER`).
- Ensure `opencode.jsonc` provider name matches the `.env` `$PROVIDER`.
- Ensure the model name passed to `opencode` exactly matches what the proxy's `/v1/models` returns (e.g., use `Sonnet` instead of `TVD/Sonnet`).

## 2. Zombie State JSON (`state.json`)
**Symptom:** Worker IDs are updated in `server.js` and the Frontend UI, but the Dashboard only reacts to legacy worker names (e.g., `frontend_engineer` instead of `frontend`). Updates to new IDs are silently ignored.
**Fix:** The backend is caching the legacy structure. Delete the state file `rm -f .aic/state.json` and restart `server.js` to force a fresh state object initialization.

## 3. Dispatcher Auto-Idle (Watchdog)
**Symptom:** The Dispatcher (Hermes) gets stuck in "WORKING" on the dashboard when waiting for user input.
**Fix:** Hermes cannot natively send an idle webhook when generation finishes. The system relies on a background script (`scripts/dispatcher-watchdog.sh`) to poll and reset the dispatcher to IDLE. Ensure the script posts to `/api/agent-status` (not a phantom route like `/dispatcher`).

## 4. Pipeline and Logs Not Showing
**Symptom:** Dashboard Virtual Office renders, but Current Task, Pipeline, and Activity Log are empty.
**Fix:** Ensure the Frontend polls `GET /api/status` (which contains full state including phases, tasks, and audit logs) instead of `GET /api/workers` (which only contains agent status).

## 5. Dashboard OFFLINE After Server Restart
**Symptom:** Restarting `server.js` causes the UI at `localhost:6969` to show OFFLINE or go blank.
**Fix:** Ensure the Vite dev server (`npx vite --port 6969`) is running. The backend API (`6868`) and frontend Vite proxy (`6969`) must both be alive for the dashboard to function. Do not rely solely on the Node server.