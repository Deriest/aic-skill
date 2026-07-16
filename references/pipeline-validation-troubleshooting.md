# AIC Pipeline Validation & Worker-Failure Troubleshooting

Reusable playbook for validating the AIC runtime end-to-end and isolating why a
pipeline stalls. Covers the common trap where a worker "fails" but the fault is
external to repo code.

## Scope reminder

TVD Assistant (base Hermes) is NOT the AIC dispatcher. When validating, you run
OUTSIDE the pipeline as an operator: read `skill_view(aic)` for structure, then
exercise `server.js` via HTTP. Do not act as dispatcher unless the AIC skill is
actually the active runtime. Standing rule (memory): never bypass the pipeline —
investigate → report → await approval before editing source.

## Server + auth basics

- Server: `node scripts/server.js` on `localhost:6868`. Start with
  `terminal(background=true)` — shell `&`/`nohup`/`disown` are blocked.
- Health: `GET /health` → `{"ok":true,...}`.
- Server auth key: `.aic/auth.json` → `apiKeys[0].key` (NOT `AIC_API_KEY`, which
  is the model-provider key).
- Task creation from orchestrator: `POST /api/task-start`; runtime intents via
  `POST /api/runtime/intent`. Orchestrator only creates the task then exits — the
  engine runs the pipeline async. Poll `GET /api/status`.

## HTTP testing without redaction noise

`terminal` redaction masks `$key`/API keys as `***`, which also corrupts curl
commands built with the key inline. Write a small Python script to a temp file
and run it — `urllib.request` with `X-API-Key` header works cleanly.

CAVEAT: Cloudflare-fronted endpoints (api.aicompany.biz.id) return **403 error
code 1010** to Python `urllib`'s default User-Agent. That 403 is a UA block, a
TEST ARTIFACT — not a real auth failure. Confirm the provider with `curl` (200)
before concluding the key/endpoint is broken.

## Isolating worker execution failures (the big one)

Symptom in server log: `no assistant text in session` → worker `pm failed
(exit 1)` → phase FAILED. Or `err_113527cf "Unexpected server error"`.

Root cause is usually the MODEL, not repo code. Test all three tiers directly:

```bash
cd ~/.hermes/skills/workflows/aic
for M in AIC/Haiku AIC/Sonnet AIC/Opus; do
  echo "=== $M ==="
  echo "say hi" | timeout 30 opencode run -m "$M" --format json 2>&1 | head -c 300
done
```

Interpreting results:
- `content-blocked` / `agent_router_api_error` [400] → that model is blocked at
  the AIC router (vansrouter/9router policy). EXTERNAL — no `.js`/`.sh` fix.
- `.env` `MODEL_THINKER=Opus` means pm/architect/research (thinker tier) all use
  Opus. If Opus is blocked but Sonnet/Haiku pass, the whole planning phase dies
  even though the code is fine. Unblock = router policy OR switch
  `MODEL_THINKER` to a working model (ops/config decision — get user approval,
  don't flip it unilaterally).
- `permission requested: external_directory (/tmp/*); auto-rejecting` → opencode
  refuses `/tmp` project dirs. Also a TEST ARTIFACT: real runs use project dirs
  like `/home/tvd/AIC-WEB`. Don't validate pipelines against `/tmp`.

## Common repo-level defects found by validation (v3.4.0 baseline)

- `/api/metrics` 500: `server.js` rebuilt `req.url` as `{...url, pathname}`,
  dropping the `searchParams` getter (spread loses getters). Fix: assign the URL
  object directly (`req.url = url`), pathname already set upstream.
- RBAC 403 for a valid admin key: the RBAC block called `loadCredentials` from
  `config.js` (reads `.aic/credentials.json`) instead of `auth.loadCredentials`
  (reads `.aic/auth.json` where the key + role live). Also: `auth.json` keys need
  an explicit `"role":"admin"` — no role defaults to `viewer` (status/metrics/
  health read only). `RBAC_MATRIX.admin = ['*']`.
- `/api/tasks` leaking without auth: it was in the `publicApi` allowlist in
  `server.js`. Remove it to force auth.
- Version drift: `public-routes.js` hardcodes the `/api/version` string; keep in
  sync with SKILL.md baseline.
- Fresh pipeline silent-fail: `pipeline-orchestrator.sh` never `mkdir -p`'d the
  project dir; opencode fails silently on a missing cwd. Add the mkdir before
  task-start.

## Endpoints that exist vs 404

Many "admin" reads (`/api/workers`, `/api/state`, `/api/history`) have NO
standalone GET handler — the dashboard reads them via `/api/status`. A 404 there
is expected, not an RBAC failure. Test RBAC against endpoints that actually exist
and require auth: `/api/config`, `/api/auth/keys`, `/api/pipeline/status`.

## Stale-state gotcha

Cancelled/failed tasks stay `status:active` and can leave `state.currentTask`
occupied, which blocks a new `task.start` from advancing past CREATED. Task IDs
are allocated per-day-sequence from existing dirs, so a stale dir can cause ID
reuse confusion. Clear/verify `state.currentTask` before a clean validation run.

## Honest verdict discipline

Never assert "pipeline reached COMPLETE" without witnessing it. If completion is
blocked by an external model/router issue, terminate as
ARCHITECTURAL ESCALATION REQUIRED and report exactly which layer failed
(repo code vs opencode↔provider integration vs router policy).
