# Server Startup & EADDRINUSE Pitfall

When starting the AIC server (`node scripts/server.js`) in a Hermes terminal:

1. **Check first:** Always run `curl -s http://localhost:6868/health` before starting. If it responds, the server is already running.
2. **Cleanup first:** If you must restart, aggressively kill existing instances (e.g., `killall node 2>/dev/null` or `fuser -k 6868/tcp`) to prevent `EADDRINUSE` silent background loops.
3. **Backgrounding:** Use Hermes's `terminal(background=true, notify_on_complete=false)` for the server process. DO NOT use shell `&` or `nohup` in a foreground terminal, as Hermes will flag it.
4. **Permissions:** Setup scripts like `scripts/api-auth.sh` may lack executable bits after environment resets. Run them explicitly via `bash scripts/api-auth.sh`.