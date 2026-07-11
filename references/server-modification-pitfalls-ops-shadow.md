## ops-endpoints.js Handler Shadowing (CRITICAL)

`ops-endpoints.js` runs BEFORE `server.js` for matching routes. If `ops-endpoints.js` has a handler for `/api/metrics/summary` and returns `true`, the server.js handler for the same route is NEVER reached.

**Root cause of DF-001:** K-7 memory/CPU code was added to server.js's `/api/metrics/summary` handler (lines 651-657), but `ops-endpoints.js` line 25 has its own handler that intercepts the request first and returns early. The server.js code was syntactically correct but unreachable.

**Execution order:**
```
Request → ops-endpoints.js (handles, returns true) → DONE
         server.js handler → NEVER REACHED
```

**Rule:** Before adding fields to ANY existing API endpoint, check BOTH files:
1. `grep -n '/api/<endpoint>' scripts/ops-endpoints.js`
2. `grep -n '/api/<endpoint>' scripts/server.js`

If ops-endpoints.js handles it, add your changes THERE, not in server.js.

**Discovered:** Milestone K DF-001 — memory/CPU added to server.js metrics handler but never appeared in response because ops-endpoints.js intercepted first.
