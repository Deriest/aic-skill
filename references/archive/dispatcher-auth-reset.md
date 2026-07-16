# Dispatcher Auth Reset Pitfall

**Symptom:**
When moving the AIC environment (e.g., from PC to Server) or setting up a fresh project folder, API calls to `localhost:6868/api/agent-status` fail with `{"error":"Invalid API key"}` or `Missing API key`, even after the server starts. 

**Root Cause:**
The server uses a local `credentials.json` at `.aic/auth.json` (or `.aic/credentials.json`) that does not exist or has mismatched keys in the new environment. The server might be up, but the Dispatcher cannot authenticate to it.

**Fix Pattern (CLI):**
1. Stop the running server: `killall node`
2. Clear the stale `.aic` directory in the project folder: `rm -rf .aic`
3. Generate new credentials via the Node script directly (to avoid script wrapping issues):
   `node -e "const auth = require('/home/tvd/.hermes/skills/workflows/aic/scripts/auth.js'); const key = auth.addApiKey('system-dispatcher'); console.log('NEW_KEY=' + key);"`
4. Start the server again in the background.
5. Use that new key in the `X-API-Key` header for subsequent curl requests.
6. When sending status, ensure the `agent` property is included in the payload to avoid `{"error":"unknown agent: "}`:
   `-d '{"agent":"dispatcher", "status":"active", "message":"..."}'`

**Warning:** Generating credentials must happen BEFORE the server starts so the server picks up the correct API keys in its memory state.