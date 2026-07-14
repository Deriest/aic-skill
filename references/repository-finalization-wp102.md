# WP-102 — Repository Finalization (Governance 100/100)

**Authority:** reorganize, archive, move docs, update .gitignore, move assets, normalize layout, remove obsolete. MUST NOT modify Runtime/Engine/FSM/WECP/PM Review/worker execution/Dashboard behavior.

**Goal:** eliminate governance debt — no ambiguous ownership, no undecided archive candidates, no duplicate/obsolete/misleading docs, no historical mixed with production.

## 1. Legacy Scripts — KEEP/ARCHIVE/DELETE

### Criteria
- **KEEP** if referenced by `scripts/engine/*.js`, `server.js`, `phase-runner.sh`, `spawn-worker.sh`, `monitor.sh`, `self-test.sh`, `knowledge-*.sh` lifecycle, `api-auth.sh`, `auth.js`.
- **ARCHIVE** if 0 refs in prod code and early Milestone E/J prototype superseded by `engine/index.js` + `phase-runner.sh`.
- **DELETE** if temp, duplicate, zero historical value (`patch.*`, `AGENTS.md.deprecated`, `BASELINE-K.md`).

### Decisions (WP-102)

**KEEP (production — 40+ files):**
`api-auth.sh`, `artifact-registry.sh`, `auth.js`, `cache-context.sh`, `changelog.sh`, `closeout-context-block.py`, `config.sh`, `context-gather.sh`, `deploy.sh`, `detect-context.sh`, `engine/*`, `enterprise-endpoints.js` (server.js require), `ops-endpoints.js` (server.js require), `health-check.sh`, `knowledge-*.sh` x8, `legacy-extract-sid.py`, `logger.sh`, `metrics.sh`, `monitor.sh`, `opencode-json-to-md.py`, `opencode-token-extract.py`, `phase-contract-loader.py`, `phase-runner.sh`, `pipeline-orchestrator.sh` (legacy entry kept), `planning-post-gen-gate.py`, `pm-repair-respawn.js`, `pm-review.sh`, `preflight.sh`, `queue.sh`, `recovery.sh`, `rework-handler.sh`, `rollback.sh`, `self-test.sh`, `server.js`, `setup.sh`, `spawn-sub.sh`, `spawn-worker.sh`, `trivial-*.py`, `validate-*.py`, `worker-completion-contract.sh`, `worker-continue-prompt.sh`, `worker-execution-pipeline.py`, `worker-noop-detector.py`, `worker-validation.sh`, `aic` CLI.

**ARCHIVE platform-experiments/ (14):**
`audit-platform.sh`, `collaboration.sh`, `context-sharing.sh`, `decision-engine.sh`, `dependency-graph.sh`, `permissions.sh`, `project-manager.sh`, `resource-manager.sh`, `security-governance.sh`, `task-decomposer.sh`, `worker-autonomy.sh`, `worker-memory.sh` (distinct from knowledge-*.sh), `worker-registry.sh`, `workspace.sh` → `archive/platform-experiments/` + README with supersession table.

**ARCHIVE runtime-stabilization/ (3 dead orchestrators):**
`dispatcher-orchestrator.sh`, `dynamic-router.sh`, `worker-distributor.sh` — 0 engine refs, superseded.

**ARCHIVE ops/ (1):** `stress-test.sh` dev-only.

**DELETE (5):** `AGENTS.md.deprecated`, `BASELINE-K.md`, `MASTER-PLANNING-KM-REVIEW.md`, `patch.diff`, `patch.js`.

Implementation: `git mv scripts/<file> archive/<category>/` to preserve history. Revert if `server.js` requires (e.g. `enterprise-endpoints.js`, `ops-endpoints.js` were temporarily archived then restored — verify via `grep require server.js`).

## 2. Knowledge Policy

**Decision: IGNORED / GENERATED**

- `knowledge/task-entries.json` append-only ledger on `task-complete` (7 historical entries). Not production config.
- Action: add `knowledge/task-entries.json` to `.gitignore`, `git rm --cached` (keep on disk).
- Verify: `git check-ignore -q knowledge/task-entries.json` must PASS.
- Rationale: aligns with `.aic/` ignore policy — runtime ledger ≠ source.

## 3. Phase Contracts

**Canonical:** `templates/phase-contracts/{investigate,implementation}.json`
**Runtime:** `.aic/phase-contracts/` (generated/ignored)

- Only 2 locations existed; runtime is gitignored.
- Action (no runtime change): copy `.aic/phase-contracts/*.json` → `templates/phase-contracts/` as seed. Document seeding path.
- Docs: `architecture-overview.md` shows `templates/ → .aic/` flow. Future `setup.sh` could seed if absent — would be behavioral, deferred to ADR.

## 4. Dashboard Assets

**Decision: DOCS ONLY → `docs/assets/`**

- 4 PNGs at root `dashboard-*.png` (93-234KB) doc-only, only referenced by `README.md ![ ]`.
- Move via `git mv *.png docs/assets/` (R).
- Update README: `./dashboard-overview-v2.png` → `./docs/assets/dashboard-overview-v2.png`.
- `dashboard/public/fonts/PressStart2P-Regular.ttf` stays tracked (FIX-022 self-host).

## 5. Documentation Sync

- `architecture-overview.md`: Rewrite — source is Vite+React (`dashboard/src/`), not compiled-only; self-hosted font; engine FSM; file-based contracts; archive governance.
- `docs/INDEX.md`: Add assets, templates/phase-contracts, governance, knowledge policy quick-start.
- `README.md`: Structure block actual layout, PNG refs fixed, references count generic.
- `developer-guide.md`: Full current layout, conventions, verification patterns.
- `operator-guide.md`: Intent API via `curl_api`, taskTimer, config template.
- `SKILL.md`: Add WP-102 router + 4 stub refs resolved.

## 6. References Categorization

- **Active `references/` (109):** FIX/IMP lineage, runtime OAT, WECP, pits — all referenced by SKILL.md after WP-102 stubs.
- **Archive runtime-stabilization (16):** FIX-020 etc + dead orchestrators.
- **Archive platform-experiments (14+README):** E/J prototypes.
- **Archive milestones/defects/release-readiness/ops:** H..L reports.

No ambiguous placement — every file has exactly one home, `git mv` preserves history.

## 7. Repository Root — Production Only

Final root:
`AGENTS.md` (deprecated compat 547B, KEEP per Hermes `_load_agents_md()`), `aic` CLI, `CHANGELOG.md`, `LICENSE`, `README.md`, `SKILL.md`, `requirements.json`, `.env.example`, `.gitignore`, `dashboard/`, `docs/`, `knowledge/` (ledger ignored), `references/`, `scripts/` (prod only), `templates/`, `archive/`, `.aic/` (mostly ignored).

## Verification (ad-hoc, no suite)

```bash
TF=$(mktemp /tmp/hermes-verify-wp102-XXXX.sh)
cat > "$TF" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
cd ~/.hermes/skills/workflows/aic
git check-ignore -q knowledge/task-entries.json
git check-ignore -q .aic/latency_metrics.json
[ -z "$(git ls-files --others --exclude-standard | grep -v "^\.aic/")" ] || exit 1
[ -z "$(git diff --stat)" ] || exit 1
node --check scripts/server.js
for f in scripts/engine/*.js; do node --check "$f"; done
for f in scripts/*.sh; do bash -n "$f"; done
python3 -m py_compile scripts/*.py
[ "$(git diff --cached --stat -- scripts/engine/ scripts/server.js scripts/worker-execution-pipeline.py scripts/spawn-worker.sh scripts/phase-runner.sh | wc -l)" -eq 0 ]
echo "OK_WP102_HERMES_VERIFY"
SH
chmod +x "$TF"; bash "$TF"; rm -f "$TF"
```

Rules: prefix `hermes-verify-` under `/tmp` with `mktemp`, focused checks only, cleanup, summarize as ad-hoc not suite green.

## Scoring

Governance 100/100 when:
- 0 untracked prod, 0 unstaged, engine diff 0
- .gitignore canonical (reports/, tasks/, .aic/*, knowledge/task-entries.json, __pycache__/)
- 0 ambiguous legacy scripts
- docs links all resolve, PNGs in docs/assets/
- templates/phase-contracts/ canonical
- archive READMEs present with restore instructions

Production Readiness: 72 (WP-100) → 94.3 (WP-101) → 98/100 (WP-102) — gap to 100 is ADR for phase-contracts seeding.
