# WP-101 — Production Readiness Cleanup Pattern

**Authority:** inspect, refactor organization, clean temporary files, archive documents, improve documentation, hygiene, maintainability ONLY. NOT authorized: commit, push, create releases, change Runtime/Engine/PM/Barrier/WECP/worker logic/dashboard functionality/introduce features.

**Goal:** 95+ (stretch 100). Repeat scan until no safe improvement.

## .gitignore Canonical (production)

```
# OS / IDE / Node / Temp / Logs
.DS_Store / .vscode / .idea / node_modules / *.tmp / *.log
# Runtime artifacts
status.json / .env / dashboard/dist/ / audit.json / history.json / snapshots/ / cache/
reports/ / tasks/ / docs/release-readiness/
# AIC DB & generated
.aic/auth.json / .aic/tasks/ / .aic/prompts/ / .aic/state.json / .aic/metrics.json
.aic/chat-history.json / .aic/artifacts/ / .aic/latency_metrics.json
.aic/phase-contracts/ / .aic/runtime-contracts.json / .aic/worker-compliance.json
.aic/server.pid / .aic/health.json / .aic/active-project.json / ... + .aic/shared-context/ .aic/logs/
# Python
__pycache__/ / .pytest_cache/
```

Fonts `dashboard/public/fonts/*.ttf` MUST stay tracked (FIX-022). Never ignore.

## Archive Convention (archive over delete)

- `archive/runtime-stabilization/` — FIX-008..023, IMP-024 lineage, dead orchestrator helpers
- `archive/release-readiness/` — was `docs/release-readiness/`
- `archive/defects/` / `archive/milestones/`
- Move via `git mv` to preserve history; `git add -A archive/`
- Root temp files delete: `AGENTS.md.deprecated`, `BASELINE-K.md`, `MASTER-PLANNING-KM-REVIEW.md`, `patch.diff`, `patch.js`

## Dead Helper Criteria

Archive when: 0 refs in `scripts/engine/`, `server.js`, `phase-runner.sh`; superseded by `engine/index.js`+`phase-runner.sh`.
Confirmed dead this pass: `dispatcher-orchestrator.sh`, `dynamic-router.sh`, `worker-distributor.sh` → `archive/runtime-stabilization/`.
Leave uncertain (task-decomposer, decision-engine, dependency-graph, collaboration, recovery) — need separate audit per WP-101 uncertainty rule.

## Config Drift Fix

Env var is `PROVIDER=aic` (read by `spawn-worker.sh` as `${PROVIDER:-aic}`). `scripts/config.sh` must validate `PROVIDER` not `PROVIDER_ID` (bug: REQUIRED array had PROVIDER_ID).
Create root `.env.example` with PROVIDER, API_KEY, MODEL_THINKER/CRAFTER/SPRINTER, AIC_API_URL, CORS.

## Docs Canonical Locations

- `docs/operations/operations-runbook.md` (not `references/`)
- `docs/operations/operations-guide.md` (deployment, distinct from runbook)
- `docs/INDEX.md` must point to `archive/` and `.env.example`
- `LICENSE` at root (copy from archived `license.txt` if missing)

## Ledger Handling

- `knowledge/task-entries.json` is auto-appended on task-complete → revert before commit (not staged). Policy: tracked historically but not part of release commit.

## Verification (ad-hoc)

Use OS-safe tempfile: `TF=$(mktemp /tmp/hermes-verify-wp101-XXXX.sh)`, write focused script, `chmod +x && bash`, `rm -f`, summarize as ad-hoc not suite green.

Checks:
- `grep -Fq "reports/" .gitignore`
- `git check-ignore -q .aic/latency_metrics.json`
- `git ls-files --others --exclude-standard | grep -v "^\.aic/"` → 0 untracked prod
- `node --check scripts/server.js && bash -n scripts/*.sh && python3 -m py_compile scripts/*.py`
- Existence: `archive/runtime-stabilization/`, `.env.example` with PROVIDER, `dashboard/public/fonts/PressStart2P-Regular.ttf`
- Regression: `grep -q "FINAL_EXIT.*FINAL_PATH.*json.dumps" scripts/spawn-worker.sh`, `extract_session_id` in worker-execution-pipeline.py

## Scoring (WP-100 → WP-101)

Before: 72/100 (Architecture 90 Runtime 90 Worker 80 Repo 45 Docs 55 Config 70)
After: 94.3 conservative, 95+ weighted — gaps: phase-contracts seeding, knowledge ledger policy, legacy script full audit.

## Staging Ready

- 90 files example: 45 active FIX/IMP refs + font + taskTimer + worker-continue-prompt + promo brief + .env.example + LICENSE + archive moves + 20 prod M fixes (+3034/-365)
- Untracked prod 0, no `hermes-verify-*.sh` in repo, engine compiles
- NO auto-commit per authority — await explicit user `commit` signal

## Remaining Manual Decisions (STOP)

1. Legacy platform scripts still in scripts/ — historical or production?
2. knowledge-*.sh 9 scripts — superseded?
3. `.aic/phase-contracts/*.json` seeding — needs templates/phase-contracts/ + setup.sh creation (behavioral, STOP)
4. Dashboard PNG screenshots — docs/assets/ vs tracked root?
5. `docs/architecture/architecture-overview.md` outdated (says no dashboard src)
