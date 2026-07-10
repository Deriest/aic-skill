# Verification Patterns — AIC Milestones

## Verification Script Structure

Single bash script handles everything (server lifecycle + tests + cleanup). Never split across multiple terminal calls.

```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="/home/tvd/.hermes/skills/workflows/aic"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "PASS: $1"; }
fail(){ FAIL=$((FAIL+1)); echo "FAIL: $1"; }

# Server lifecycle
cleanup() { kill $SERVER_PID 2>/dev/null || true; }
trap cleanup EXIT
kill -9 $(lsof -t -i:6868) 2>/dev/null || true; sleep 1
node scripts/server.js 6868 & SERVER_PID=$!; sleep 2

# Tests here...

echo "=== $PASS PASS, $FAIL FAIL ==="
```

## Git Tracking Pitfall

`git diff --name-only HEAD` only shows TRACKED files. New files created during implementation appear as `??` (untracked) in `git status` and are invisible to `git diff`.

```bash
# BAD: misses new files
git diff --name-only HEAD | grep -q 'new-script.sh'

# GOOD: catches both tracked and untracked
git status --porcelain | grep -q 'new-script.sh'
```

Discovered during Milestone I re-verification — logger.sh was new (untracked) but `git diff` didn't show it, causing a false FAIL.

## Verification vs Self-Check

Implementation self-checks (ad-hoc syntax + functional tests during implementation) are NOT official verification. The verification phase must execute independently with its own evidence. Never reuse self-check results as verification evidence.

User correction: "Hasil ad-hoc yang sudah kamu jalankan hanya sebagai self-check implementasi. Tunggu instruksi Verification."

## Public Endpoints

`/api/status` is intentionally unauthenticated (dashboard consumer endpoint, server.js line 213). Verification scripts that test auth blocking must use a protected endpoint like `/api/metrics` or `/api/monitor`, NOT `/api/status`.

## OAT Script Timeout

Runtime OAT scripts with concurrent tests need generous timeouts. The default 60s caused timeout during concurrent stability testing (5 parallel curl + wait).

```bash
# In terminal call:
bash /tmp/hermes-verify-runtime-oat.sh  # timeout=120
```

## Cascading Dependencies

Monitor depends on Logger. When logger.sh broke (sys.argv bug), monitor.sh alert went silent — not a monitor bug, just a cascading failure. Always fix upstream dependencies first (I-4 before I-2 in this case).

Pattern: I-1 → I-4 → I-8 → I-3 → I-2 → I-5 → I-6 → I-7 → I-9 → I-10
This order ensures logging works before monitoring, config before health, etc.

## Defect Fix Scope

After REWORK, fix ONLY verified defects. No new features, no refactoring, no optimization. The defect fix report must list exactly which files were modified and why.

## Server Start in Verification

Never use `&` in `terminal()` foreground calls — it's blocked. Use `terminal(background=true)` for server start, then test in follow-up calls. OR: write a single bash script that handles the full lifecycle (start + test + stop with trap cleanup).

## Test Pattern Assumptions (Pitfall)

Verification grep patterns can produce false FAILs if the response shape differs from assumptions. Common patterns:

```bash
# WRONG: assumes top-level "roles" key after assignment changes structure
curl ... /api/permissions | grep -q '"roles"'   # FAILS after POST /assign

# RIGHT: check for what the response actually contains
curl ... /api/permissions | grep -q '"users"'   # PASS — response has users after assign
```

```bash
# WRONG: assumes field name
curl ... /api/monitor | grep -q '"instanceId"'  # field is "instance"
curl ... /api/metrics/summary | grep -q '"timestamp"'  # field is "total"
```

**Rule:** After any test FAIL, always `curl -s` (not `-sf`) the endpoint to see the raw response before concluding it's a code defect. Most "FAILs" in Milestone J verification were test pattern mismatches, not runtime bugs.

## Server PID File Gap

`deploy.sh start` creates `.aic/server.pid` and `deploy.sh status` checks it. But `terminal(background=true)` starts the server WITHOUT creating a PID file. Result: `deploy.sh status` reports STOPPED while server is actually running.

**Rule:** After starting server via `terminal(background=true)`, also write the PID file:
```bash
echo $! > .aic/server.pid
```
Or accept that `deploy.sh status` only works for servers started via `deploy.sh start`.

## audit.log Scope

`.aic/audit.log` tracks security events from `security-governance.sh` (INPUT_INVALID, PROMPT_SIGN, SCOPE_CHECK). Runtime events (worker execution, project switching, metrics changes) are tracked via `metrics.sh` and `logger.sh`, NOT audit.log.

Do not expect audit.log to grow from worker execution or project registration. Runtime activity evidence comes from metrics (worker count, token count) and logger (structured JSON logs).

## Multi-Server Cleanup

During verification, stale background server processes accumulate. Always kill ALL processes on the port before starting a fresh instance:

```bash
kill -9 $(lsof -t -i:6868) 2>/dev/null; sleep 1
```

Check `process(action='list')` for orphaned processes from earlier test phases. The `proc_*` IDs change each restart — don't assume a previous watch pattern notification means the server is still alive.
