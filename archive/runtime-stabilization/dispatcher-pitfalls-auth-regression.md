## ❌ Auth middleware blocks Dashboard + internal bash scripts (RP-001, 2026-07-10)

**Symptom:** After Milestone F added `auth.requireAuth()` to `server.js`, Dashboard showed `{"error":"Missing API key..."}` and all `spawn-worker.sh` status updates silently failed (workers stayed `idle` after completing).

**Root cause:** Two problems stacked:
1. `requireAuth` was called BEFORE static file serving — blocked Dashboard HTML/CSS/JS.
2. Bash scripts used `curl -sf` without auth headers, and `> /dev/null 2>&1 || true` swallowed the 401 errors.

**Fix:** See `references/runtime-auth-pattern.md` for complete pattern.

**Rule:** When adding auth to `server.js`, ALWAYS verify Dashboard bypasses auth, `GET /api/status` is exempt, and internal scripts use `curl_api` from `api-auth.sh`.

---

## ❌ Silent failures (`|| true`) on curl API calls hide auth errors

**Pattern:** `curl -sf ... > /dev/null 2>&1 || true` swallows 401s. Workers appear complete but dashboard shows `idle`.

**Rule:** NEVER use `|| true` on curl calls to API endpoints. Use `curl_api` and log failures. `|| true` acceptable ONLY for env sourcing and non-critical `cp`.

---

## ❌ Auto-fixing without reporting first (2026-07-10)

**User:** "jangan langsung fix dulu report ke saya apa yang bermasalah"

**Rule:** Report issue + root cause + fix plan FIRST. Wait for approval before implementation.

---

## ❌ Multiple server instances from watch pattern triggers

**Symptom:** 8+ `node scripts/server.js` processes after repeated restarts.

**Rule:** Always `kill -9 $(lsof -t -i:6868) 2>/dev/null` before starting server.
