# AIC Skill v3.4.0 — Stabilization Engineering Log

## Cycle 1: 2026-07-16

### Recovery Batch 1 (D-01 through D-07)

| Defect | Sev | Component | Fix | Verified |
|--------|-----|-----------|-----|----------|
| D-01 | CRITICAL | server.js:196 | `req.url = url` (keep URL object, don't spread) | /api/metrics → 200 |
| D-02 | HIGH | server.js:230 + auth.json | Use `auth.loadCredentials()` (reads auth.json with role) + add role:admin | admin → 200, no-key → 401 |
| D-03 | HIGH | server.js:200 | Remove /api/tasks from publicApi allowlist | no-key → 401, admin → 200 |
| D-04 | MEDIUM | public-routes.js:63 | Version 3.1.3 → 3.4.0 | /api/version → 3.4.0 |
| D-07 | CRITICAL | pipeline-orchestrator.sh | `mkdir -p "$PROJECT_DIR"` before task-start | /tmp/aic-verify created |

### Recovery Batch 2 (D-12 — THE PIPELINE BLOCKER)

| Defect | Sev | Component | Fix | Verified |
|--------|-----|-----------|-----|----------|
| D-12 | CRITICAL | spawn-worker.sh (3 locations) | `printf "%b"` → `printf "%s"` in awk commands | Full pipeline → COMPLETE |

**D-12 Root Cause:** `awk` on this system (mawk) does not support `%b` format specifier.
The FRONTMATTER variable contains `\n` sequences that the shell already interprets as
real newlines during variable assignment. `%b` was unnecessary AND unsupported by mawk,
causing awk to crash with "improper conversion" error. This made the extraction pipe
fail, producing an empty artifact file, which caused spawn-worker.sh to mark every
worker as failed — even though opencode produced valid output.

**D-12 Evidence:**
- Manual opencode run: exit 0, 11519 bytes valid NDJSON, extraction exit 0, 1142 bytes markdown
- Pipeline run (pre-fix): awk crash, empty artifact, lease status=failed
- Pipeline run (post-fix): FULL pipeline COMPLETE, all 6 workers produced artifacts

**D-12 Reproduction:**
```
$ echo "test" | awk 'BEGIN{fm="line1\nline2"} {printf "%b\n", fm}'
awk: run time error: improper conversion(number 1) in printf("%b\n")
```

### Pipeline Execution Evidence (TASK-20260716-007)

```
18:06:34  task-start → CREATED
18:06:38  INVESTIGATE (pm)           → 45s
18:07:23  PLANNING (pm, architect, research) → 30s
18:07:53  IMPLEMENTATION (backend, frontend)  → 30s
18:08:23  VERIFICATION (qa)           → 15s
18:08:38  CLOSEOUT (pm)              → 60s
18:09:32  COMPLETE (pmReview: PASS)
Total: ~3 minutes

Deliverable: /tmp/aic-verify/hello.txt = "AIC pipeline validation complete"
```

### Regression Validation
- Unit tests: 39/39 PASS (no regressions)
- Syntax: all .sh and .js PASS
- API: /api/metrics 200, /api/tasks 401 without auth, /api/config 200 with auth
- Pipeline: COMPLETE with all 6 workers producing artifacts
- Deliverable: hello.txt created with correct content

### Files Modified
1. scripts/server.js — D-01 (l.196), D-02 (l.230), D-03 (l.200)
2. scripts/pipeline-orchestrator.sh — D-07 (mkdir)
3. scripts/routes/public-routes.js — D-04 (version)
4. .aic/auth.json — D-02 (role:admin)
5. scripts/spawn-worker.sh — D-12 (%b → %s, 3 locations)
