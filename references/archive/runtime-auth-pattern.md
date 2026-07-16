# Runtime Auth Pattern — api-auth.sh

## Problem

After adding `auth.requireAuth()` to `server.js`, internal bash scripts (`spawn-worker.sh`, etc.) that call API endpoints via `curl` fail silently because they don't send auth headers.

## Solution: api-auth.sh Helper

`scripts/api-auth.sh` reads the first API key from `.aic/auth.json` and provides a `curl_api` wrapper that auto-injects the `X-API-Key` header.

### Usage in any runtime script

```bash
source "$(dirname "$0")/api-auth.sh"

# Instead of: curl -sf -X POST "$API_URL/api/agent-status" ...
# Use:
curl_api -X POST "$API_URL/api/agent-status" \
  -H "Content-Type: application/json" \
  -d "{\"agent\":\"$WORKER\",\"status\":\"working\"}" \
  2>&1 || echo "[WARN] agent-status failed" >&2
```

### What curl_api does

1. Reads first key from `$SKILL_DIR/.aic/auth.json`
2. Passes `-H "X-API-Key: $key"` to curl
3. Falls back to unauthenticated curl if no key exists (dev mode)

### Scripts that source api-auth.sh

- `spawn-worker.sh`
- `spawn-sub.sh`
- `phase-runner.sh`
- `pm-review.sh`
- `rework-handler.sh`

### Rules

1. NEVER use raw `curl -sf` for `/api/` endpoints — always `curl_api`
2. NEVER use `|| true` on API calls — log failures with `echo "[WARN]" >&2`
3. `|| true` is ONLY acceptable for: env file sourcing and non-critical `cp`

### server.js auth scope

Auth applies ONLY to `/api/*` routes. Dashboard static files and `GET /api/status` are exempt:

```javascript
// Line ~162: Dashboard reads status without auth
if (req.method === 'GET' && pathname === '/api/status') { ... }

// Line ~194: All other API routes require auth
if (pathname.startsWith('/api') && !auth.requireAuth(req, res)) return;
```
