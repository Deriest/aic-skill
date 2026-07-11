# Server.js Modification Pitfalls — Additional Patterns

## Dual Auth Gates (Public Endpoint Pattern)

server.js has TWO authentication gates that run sequentially:

1. **Line ~259:** `requireAuth` — rejects ALL `/api/*` without valid API key
2. **RBAC middleware** — checks role-based permissions

When making an endpoint public (no auth required), it MUST be excluded from BOTH gates:
```javascript
// Gate 1: Auth exclusion (line ~259)
const publicApi = ['/api/config', '/api/tasks', '/api/metrics'];
if (pathname.startsWith('/api') && !publicApi.some(p => pathname.startsWith(p)) && !auth.requireAuth(req, res)) return;

// Gate 2: RBAC public list
const isPublic = rbacPath === '/health' || rbacPath === '/api/status' || rbacPath === '/api/config' || ...
```

Adding to only the RBAC list does NOT work — the auth gate at line 259 rejects first. Both lists must match.

**Discovered:** Milestone K DF-004/005 — /api/tasks and /api/config returned "Missing API key" despite being in RBAC public list.

## Code After `return` Statement

When adding code before `return send(res, 200, { metrics, summary })`, ensure it is placed BEFORE the return, not after. Python patches that insert at a line index may accidentally place code after the return if the return is at the insertion boundary.

**Check:** After any patch to server.js, verify the execution order:
1. All `summary.X = ...` assignments
2. `return send(res, 200, { metrics, summary })` (LAST)

If assignments appear after the return, they are unreachable dead code — syntactically valid but never execute.

**Discovered:** Milestone K DF-003 — cost calculation was inserted after `return send()`, producing correct syntax but empty cost in responses.

## Test JSON Path Nesting

API responses may nest data. When `/api/metrics` returns `{ metrics, summary }`, cost/memory/cpu live inside `summary`, not at the top level:
```python
# WRONG: d.get('cost', {}) returns {} because cost is nested
d = json.load(sys.stdin)
cost = d.get('cost', {})

# RIGHT: access through summary
cost = d['summary']['cost']
```

Always check the actual response structure before writing test assertions. Use `python3 -c "import json,sys; print(list(json.load(sys.stdin).keys()))"` to discover top-level keys first.

**Discovered:** Milestone K — DF-003 verification showed `cost={}` despite cost being correctly computed inside `summary.cost`.
