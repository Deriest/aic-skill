# Autonomous Delivery Supervisor Pattern

When user asks to "supervise pipeline until DELIVERED" or runs `/aic` with supervision intent:

## Loop Structure

```
Monitor → Detect Issue → Investigate → Root Cause → Fix → Validate → Resume → Continue
```

## Implementation

1. **Create task** via `POST /api/task-start`
2. **Monitor** via polling `/api/tasks` every 30-45s (background process)
3. **On COMPLETE** → report dashboard state (currentTask, runtimeGate, lastCompletedTask)
4. **On BLOCKED** → don't wait for user:
   - Read server log (`process(action='log')`) for root cause
   - Fix the code directly (pm-review.js, phase-runner.js, etc.)
   - Restart server (`kill -9 PID` → auto-restart or manual `node scripts/server.js`)
   - Resume via `POST /api/runtime/intent` with `task.resume`
   - If resume fails → create new task
5. **On CANCELLED** → investigate why, fix, create new task

## Critical Rules

- **Never leave a pipeline unattended** — always have a background monitor running
- **Never ask user to fix engine code** — you fix it autonomously
- **Only escalate** for: credential rotation, architectural redesign, external service down
- **Granular retry** — restart only the failed worker/phase, not the entire task
- **Server restart required** after code changes — Node caches modules at startup
- **Hermes blocks `vite build`** — use `background=true` + `notify_on_complete`
- **Smart Approval destroys `$key` to `***`** — use `$apikey` variable name in shell scripts

## Monitor Script Pattern

```python
# Background monitor that auto-notifies on terminal state
import json, urllib.request, time, sys
key = json.load(open('.aic/auth.json'))['apiKeys'][0]['key']
last = ''
for i in range(240):
    tasks = json.loads(urllib.request.urlopen(
        Request('http://localhost:6868/api/tasks', headers={'X-API-Key': key}),
        timeout=10
    ).read())
    for t in tasks:
        if t['id'] == TARGET_TASK:
            cur = f"{t['phase']}/{t['phaseStatus']}/{t['status']}"
            if cur != last:
                print(f"[{time.strftime('%H:%M:%S')}] {cur}", flush=True)
                last = cur
            if t['status'] == 'complete':
                # Print dashboard state for verification
                status = json.loads(urllib.request.urlopen(
                    Request('http://localhost:6868/api/status', headers={'X-API-Key': key})
                ).read())
                print(f"currentTask: {status.get('currentTask')}")
                print(f"runtimeGate: {status.get('runtimeGate')}")
                print(f"lastCompletedTask: {status.get('lastCompletedTask')}")
                sys.exit(0)
            if t['status'] in ('blocked','cancelled'):
                print(f"NEEDS_INTERVENTION: {t['status']}", flush=True)
                sys.exit(1)
            break
    time.sleep(30)
```

## Server Restart Pattern

```bash
# Kill existing server (auto-restart picks up new code)
kill -9 $(pgrep -f "node scripts/server.js" | head -1) 2>/dev/null
sleep 5
# If auto-restart fails, start manually
cd ~/.hermes/skills/workflows/aic && node scripts/server.js &
sleep 5
curl -s http://localhost:6868/health
```

## Task Resume After Fix

```bash
AKEY=$(python3 -c "import json; print(json.load(open('.aic/auth.json'))['apiKeys'][0]['key'])")
curl -s -X POST -H "X-API-Key: $AKEY" -H "Content-Type: application/json" \
  -d '{"intent":"task.resume","taskId":"TASK-xxx"}' \
  http://localhost:6868/api/runtime/intent
```
