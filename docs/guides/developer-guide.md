# Developer Guide

## Prerequisites

- Node.js 18+
- opencode CLI
- Provider API key (in `.env` → `API_KEY`) and auth key (`.aic/auth.json`)

## Repository Layout (Current — WP-102)

```
scripts/
├── server.js              # API server + dispatcher (in-proc engine)
├── engine/                # FSM, barrier, PM repair, recovery, validation
│   ├── index.js           # Engine entry — pipeline orchestration
│   ├── fsm.js             # Phase state machine
│   ├── barrier.js         # Phase barrier (backend+frontend)
│   ├── pm-repair.js       # PM repair loop
│   ├── recovery.js        # Startup recovery
│   └── validate-artifact.js # Artifact validation
├── phase-runner.sh        # Parallel phase runner (called by engine)
├── spawn-worker.sh        # Worker executor (opencode CLI + WECP)
├── spawn-sub.sh           # Sub-agent spawning
├── auth.js                # API key auth + CORS
├── api-auth.sh            # curl_api helper for scripts
├── config.sh              # Central config (validates PROVIDER)
├── enterprise-endpoints.js # Enterprise APIs (workspaces, quotas)
├── ops-endpoints.js       # Ops APIs (monitor, health, etc.)
├── deploy.sh / preflight.sh / setup.sh / self-test.sh / health-check.sh / metrics.sh / monitor.sh
├── knowledge-*.sh         # Knowledge platform (8 scripts, active)
│   ├── knowledge-cross-project.sh, graph, index, lessons, lifecycle, memory, reuse, search
├── artifact-registry.sh   # Artifact registry (used by validation)
├── worker-validation.sh   # Post-artifact validation (with phase contracts)
├── worker-completion-contract.sh / worker-continue-prompt.sh / worker-noop-detector.py
├── opencode-json-to-md.py / opencode-token-extract.py / trivial-task-classifier.py etc.
└── *.py                   # Phase contracts, validation, closeout

dashboard/
├── src/                   # Vite + React + Tailwind source
│   ├── components/        # new_layout etc.
│   ├── context/           # DashboardContext (latency, SLI)
│   └── utils/taskTimer.ts # Task elapsed timer (FIX-023)
├── public/fonts/          # PressStart2P self-hosted (FIX-022)
└── dist/                  # Built output (ignored)

.aic/                       # Runtime state (generated, ignored mostly)
├── auth.json / state.json / metrics.json / latency_metrics.json
├── tasks/<TASK-ID>/       # Task checkpoints, artifacts, reports
├── phase-contracts/       # Runtime contracts (seeded from templates/phase-contracts/)
└── ...

docs/
├── api/api-reference.md
├── architecture/architecture-overview.md
├── guides/developer-guide.md / operator-guide.md
├── operations/operations-guide.md / operations-runbook.md
├── INDEX.md
└── assets/                # Dashboard screenshots (product docs)

references/                 # Active reference docs (FIX/IMP lineage, pitfalls, patterns)
archive/                    # Historical (governance)
├── milestones/             # H..L
├── runtime-stabilization/  # FIX-008..023, IMP-024, dead orchestrators
├── platform-experiments/   # Legacy E/J era prototypes (archived WP-102)
├── defects/ / release-readiness/ / ops/

templates/
├── phase-contracts/       # Canonical seed (investigate.json, implementation.json)
└── *.md                   # Worker artifact templates

knowledge/
└── task-entries.json      # Generated ledger (ignored, see .gitignore)
```

## Coding Conventions

- Shell: `bash` with `set -euo pipefail`, no `cp` fallback for worker output
- JS: Node.js CommonJS (`require`), `server.js` + `engine/` single-process
- Python: `py_compile` check, no raw NDJSON leak (extract `type:text` via `opencode-json-to-md.py`)
- Error handling: exit code + JSON payload via `FINAL_EXIT`/`FINAL_PATH` env-var (FIX-024-B)
- No `hermes-verify-*.sh` tracked in repo — use `/tmp/hermes-verify-*.sh` ad-hoc

## Testing & Verification

- Syntax: `bash -n scripts/*.sh`, `node --check scripts/server.js scripts/engine/*.js`, `python3 -m py_compile scripts/*.py`
- Self-test: `bash scripts/self-test.sh`
- Ad-hoc (no suite): `TF=$(mktemp /tmp/hermes-verify-XXXX.sh)` — see `references/verification-patterns.md`
- Runtime OAT: guarded serialized lifecycle (task.start via `/api/runtime/intent`)
- Smoke: focused per FIX/IMP — see `references/runtime-oat-adhoc-verify.md`

## Extension Points

- New worker phases: `scripts/engine/fsm.js`
- New validation rules: `scripts/engine/validate-artifact.js` + `templates/phase-contracts/`
- New API endpoints: `scripts/server.js` (with auth), or `ops-endpoints.js`, `enterprise-endpoints.js`
- New dashboard panels: `dashboard/src/components/` + `DashboardContext`
- New knowledge ops: `scripts/knowledge-*.sh`

## References

- Engine: `scripts/engine/index.js`, `docs/architecture/architecture-overview.md`
- IMP-024: `references/imp024-milestone-worker-layer.md`
- Phase contracts: `templates/phase-contracts/` + `references/phase-deliverable-contract-investigation-imp001.md`
