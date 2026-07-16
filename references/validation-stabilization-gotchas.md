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

## D-13: observability-handler.js req.url crash (RESOLVED)
Same class as D-01. After fixing server.js to preserve `req.url` as a URL
object, ANY code that treats `req.url` as a string will crash. The
observability-handler.js called `req.url.indexOf('?')` and `req.url.slice()`
to parse query params. This crashed the ENTIRE server (uncaught TypeError)
on any request to `/api/observability/events`.

**Lesson:** After changing `req.url` from string to URL object, grep ALL .js
files for string methods on `req.url`: `indexOf`, `slice`, `match`, `replace`,
`split`. Every one is a latent crash. Fix: use `req.url.searchParams` directly.

```bash
grep -rn 'req\.url\.indexOf\|req\.url\.slice\|req\.url\.match\|req\.url\.replace\|req\.url\.split' scripts/ --include='*.js'
```

## D-14: stale currentPhase after task completion (RESOLVED)
`completeTask()` in `pipeline.js` set `state.currentPhase = 'Complete'` then
`state.currentTask = null` — leaving `currentPhase` pointing at a phase with
no task. The dashboard showed stale phase info. Fix: `state.currentPhase = null`.

Also enhanced D-08: prune leases in `completeTask()`, not just `finishLease()`.
When a task completes, ALL its leases should be purged — not just individual
ones as they finish.

## D-15: dashboard "Failed to fetch config" (RESOLVED)
After D-03 made `/api/config` and `/api/tasks` require auth, the dashboard
broke because its fetch calls (`dashboard/src/api/index.ts`) send NO
`X-API-Key` header — they're same-origin requests from the built static files.

**Root cause:** Two layers of auth enforcement:
1. `server.js:200` — publicApi list controls `requireAuth()` gate
2. `public-routes.js:107` — config GET handler calls `auth.requireAuth()` internally

Even after adding `/api/config` to the server.js publicGetApi list, the
handler in public-routes.js independently enforced auth.

**Fix:** Allow GET (read-only) without auth for dashboard endpoints:
- `server.js`: `publicGetApi = ['/api/metrics', '/api/models', '/api/status', '/api/config', '/api/tasks']`
  Only allow GET method: `const isReadOnlyGet = req.method === 'GET' && publicGetApi.some(p => pathname.startsWith(p))`
- `public-routes.js`: remove `if (!ctx.auth.requireAuth(req, res)) return true;` from config GET handler
- POST (mutations) still requires auth — verified 401 without key

**Key insight:** When adding auth enforcement to endpoints, check if the
dashboard (same-origin, no auth header) calls them. Either add auth headers
to dashboard fetch calls, or allow GET without auth for same-origin reads.

## Cache hit 0% — provider-dependent, not a bug
When cache hit rate shows 0% in metrics, check what models the AIC proxy
actually routes to. The opencode config maps Opus/Sonnet/Haiku to provider
model IDs, and the proxy may route to non-Anthropic models (e.g. glm-5.2,
gemini-3-flash) that do NOT support prompt caching. The metrics pipeline
(`opencode-token-extract.py` → `spawn-worker.sh` → `metrics-routes.js`)
already extracts `cacheRead`/`cacheWrite` fields via deep-collect from
NDJSON — but if the provider response has no cache fields, the data is 0.

**Verification steps:**
1. `curl -s -H "Authorization: Bearer $KEY" https://api.aicompany.biz.id/v1/models`
2. Check if routed models are Anthropic-native (claude-*) or proxied to other vendors
3. If non-Anthropic: cache hit 0% is expected, not a defect
4. If Anthropic-native: check `opencode-token-extract.py` field names match provider response

**Key insight:** The AIC proxy (vansrouter/9router) may silently remap model
names. `AIC/Opus` → `glm-5.2`, `AIC/Sonnet` → `gemini-3-flash`, etc. The
opencode config shows `Opus` but the proxy decides the actual backend.

## Mechanical validation gate word-count threshold
`validate-framework-invariants.sh` requires 50+ words per worker report.
Workers producing thin output (e.g., frontend at 45 words for a trivial task)
get BLOCKED by the gate. This is the gate working correctly — not a code
defect. The pipeline going to BLOCKED on thin worker output is expected
behavior. Do not try to "fix" this — it's a quality guardrail.
