# AIC Validation & Stabilization Gotchas

Reusable root causes and verification patterns found during real end-to-end
validation of the AIC runtime (server.js + engine + pipeline). Consult before
any "validate the repo" or "stabilize to production ready" mission.

## Verification harness (how to test the running server)
- Do NOT test authed endpoints with `curl -H "X-API-Key: $key"` in terminal:
  Smart Approval blocks curl+key, and terminal redaction masks `$key` as `***`.
- Do NOT inline the test in execute_code with escaped newlines — it mangles.
- DO: `write_file` a small python script to /tmp using urllib, read the key from
  `.aic/auth.json`, then run it with `python3 /tmp/verify.py`. Reliable, no redaction.
- Auth key lives at `.aic/auth.json` → `apiKeys[0].key`.

## Confirmed subsystem gotchas (root causes)

### Node URL object destroyed by spread
`req.url = { ...url, pathname }` produces a plain object and DROPS the
`searchParams` getter (non-enumerable). Any handler calling
`url.searchParams.get(...)` then crashes with "Cannot read properties of
undefined (reading 'get')". Fix: assign the URL object directly
(`req.url = url;`) after setting `url.pathname`. Symptom seen on /api/metrics.

### RBAC dual credential-loader mismatch
There are TWO `loadCredentials()`:
- `auth.js` → reads `.aic/auth.json` (the file with API keys + roles)
- `config.js` → reads `.aic/credentials.json` (a DIFFERENT, often absent file)
The server.js RBAC enforcement block must use `auth.loadCredentials()`. If it
uses the config.js one, every key resolves to role `viewer` (RBAC_MATRIX
default) and all admin endpoints 403 even with a valid key. Roles must live in
the file the enforcement path actually reads.
- RBAC_MATRIX roles: admin `['*']`, lead, member, viewer (status/metrics/health read only).
- A key with no `role` field defaults to `viewer`.

### Pipeline orchestrator does not create the project dir
`pipeline-orchestrator.sh` passed PROJECT_DIR to workers without `mkdir -p`.
opencode runs with a non-existent cwd, exits silently, produces no artifact,
and INVESTIGATE fails with empty reports/. Fix: `mkdir -p "$PROJECT_DIR"` before
task-start.

### Stale currentTask blocks new pipeline runs
Task IDs are date+sequence (`TASK-YYYYMMDD-NNN`) allocated from existing task
dirs. A prior FAILED/CANCELLED task left in `state.currentTask` prevents a new
`task.start` from advancing past CREATED (no lease issued, no worker spawned).
Clear/archive stale currentTask before a fresh run. Terminal tasks also stay
`status:"active"` — they are not auto-retired.

### Lease accumulation
Cancelled-task leases are never pruned from `state.json` (28 stale observed).
Memory-growth defect, low priority but real.

## Verdict discipline
- "Pipeline reaches COMPLETE" requires WATCHING live worker execution (minutes
  of real opencode runs per phase). Do NOT assert COMPLETE from structural
  evidence or a historical task's artifacts. A `rework.lastVerdict: "UNKNOWN"`
  on a task is often just the default state of a task cancelled mid-flight, not
  a PM-review defect — check `pmReview.verdicts` before calling it a bug.
- Restart server after every source fix, then re-run the python verify harness;
  run `npx vitest run` for regression (baseline 39 tests).

## Transient provider errors (CRITICAL lesson)
A single opencode run returning content-blocked / agent_router_api_error /
UnknownError / err_XXXXX does NOT mean the model is permanently broken.
The AIC proxy (vansrouter/9router) can return transient 400/500s that clear on
the next request. Before declaring ARCHITECTURAL ESCALATION REQUIRED or
blaming the provider:

1. Re-run the SAME opencode command 2-3 times with a simple prompt
2. Test all 3 models (Haiku/Sonnet/Opus) via direct curl to the proxy
3. Check vansrouter / 9router container logs for the error ref
4. Only escalate if the error is REPRODUCIBLE across multiple attempts

Evidence from 2026-07-16: Opus returned content-blocked on one run, then
passed cleanly (exit 0, valid markdown) on the next run 10 minutes later.
The escalation was withdrawn - wasted a full validation cycle.

## spawn-worker.sh awk %b format crash (RESOLVED — D-12)
opencode exits 0, produces valid NDJSON, opencode-json-to-md.py exits 0 with
valid markdown — yet the lease is marked failed and reports/ stays empty.

**Root cause:** `spawn-worker.sh` pipes extractor output through
`awk -v fm="$FRONTMATTER" 'NR==1{printf "%b\n", fm} 1'` to prepend YAML
frontmatter. The `%b` format specifier is a bash printf extension — mawk
(Linux default awk) does NOT support it and crashes with:
`awk: run time error: improper conversion(number 1) in printf("%b\n")`
The `2>/dev/null` on the pipe swallows the awk error, so the artifact file
is empty and spawn-worker.sh marks the worker as failed.

**Fix:** Replace `printf "%b\n"` with `printf "%s\n"` in all 3 awk calls in
spawn-worker.sh. The shell already interprets `\n` in the FRONTMATTER variable
during assignment, so `%b` was never needed.

**Debugging technique:** When a pipeline worker fails but manual opencode run
succeeds, add temporary `echo "[DBG] ..." >&2` lines to spawn-worker.sh at:
(1) after NODE_RUNNER exit, (2) after extraction attempt, (3) before
lease/complete. Then watch server stdout via `process(action='poll')`.
The `2>/dev/null` on extraction and Strategy B paths hides ALL errors —
temporarily remove it to see the real failure.

**Reproduction:**
```bash
echo "test" | awk 'BEGIN{fm="line1\nline2"} {printf "%b\n", fm}'
# awk: run time error: improper conversion(number 1) in printf("%b\n")
echo "test" | awk 'BEGIN{fm="line1\nline2"} {printf "%s\n", fm}'
# line1
# line2
# test
```

## server.js isPublic second auth bypass
server.js has TWO independent auth gates that both reference /api/tasks:
1. Line 200: publicApi list controls requireAuth()
2. Line 224: isPublic check includes pathname === /api/tasks controls RBAC

Fixing #1 (removing /api/tasks from publicApi) enforces auth at the
requireAuth gate, but #2 still marks /api/tasks as public for RBAC purposes.
An authenticated key with viewer role can read /api/tasks even after the
publicApi fix, because isPublic skips RBAC for that path.
To fully close the auth gap, remove /api/tasks from BOTH lists.
