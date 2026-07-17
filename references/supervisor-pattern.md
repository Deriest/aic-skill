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
- **vite serve** — use `npx serve dist -l tcp://0.0.0.0:3000` (NOT `--host` flag)

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

## Post-Delivery Verification

After pipeline COMPLETE, ALWAYS verify:

```bash
# 1. Check source files exist (not just reports)
find /home/tvd/AIC-WEB/src -name "*.tsx" -o -name "*.ts" | wc -l
# Should be > 0

# 2. Check TypeScript passes
cd /home/tvd/AIC-WEB && npx tsc --noEmit; echo EXIT:$?

# 3. Check dist/ built
ls -la /home/tvd/AIC-WEB/dist/

# 4. Verify dashboard state
curl -s http://localhost:6868/api/status | python3 -c "
import json,sys
d=json.loads(sys.stdin.read())
assert d['currentTask']['pipelineState'] == 'COMPLETE'
assert d['runtimeGate']['status'] == 'complete'
assert d['lastCompletedTask'] is not None
print('Dashboard state: OK')
"
```

**Common failure:** Workers write reports but don't create code files. The extract-code-blocks.py pipeline (v3.7.0+) fixes this, but ALWAYS verify files exist after COMPLETE.

## Serving Static Files

```bash
# serve package (npx) — correct syntax
cd /home/tvd/AIC-WEB && npx serve dist -l tcp://0.0.0.0:3000

# NOT --host flag (serve doesn't support it)
```

## Task Resume After Fix

```bash
AKEY=$(python3 -c "import json; print(json.load(open('.aic/auth.json'))['apiKeys'][0]['key'])")
curl -s -X POST -H "X-API-Key: $AKEY" -H "Content-Type: application/json" \
  -d '{"intent":"task.resume","taskId":"TASK-xxx"}' \
  http://localhost:6868/api/runtime/intent
```

## User Communication Rules (TVD)

- **"gimana?"** = user wants status update NOW. Report current phase, what's happening, ETA.
- **"langsung aja"** = just do it, don't ask for confirmation
- **User expects active supervision** — background monitor + auto-notify is correct
- **Don't poll manually** — use background monitor. Only check when user asks or notification arrives.
- **Server uses in-memory state** — file edits require restart. `state.json` is read only at startup via `loadState()`.
- **Dashboard is at dash.aicompany.biz.id** — user views on iPad/other devices, NOT localhost
- **User is Indonesian** — respond in Indonesian when user writes Indonesian
