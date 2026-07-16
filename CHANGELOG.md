# Changelog

## v3.5.0 — Adaptive Engineering Organization (2026-07-17)

### New Features

- **Execution Plan**: PM spawns first, produces execution-plan.md as single source of truth before downstream workers (architect, research, designer) execute in parallel with the shared plan
- **Collaborative Repair**: Respawned workers receive sibling artifacts (peer outputs) to identify and resolve contradictions during repair
- **Consistency Checker**: Automated artifact comparison script runs after barrier, before PM Review — detects contradictions, missing dependencies, inconsistent assumptions
- **Recovery Strategy Engine**: Adaptive, evidence-based recovery replaces fixed retry counter (maxAttempts=3). Strategy ladder: targeted_repair → collaborative_repair → execution_plan_refinement → pm_authoring → ship_with_caveats. Progress evaluation prevents blind retries
- **Continuous Engineering Feedback Loop**: Automatic postmortem analysis after every completed task — evidence collection, engineering metrics, pattern discovery, improvement recommendations
- **Engineering Metrics API**: GET /api/engineering-metrics, /api/engineering-patterns, /api/postmortem/:taskId

### Bug Fixes

- **D-18** [CRITICAL]: maxCycles was declared but never enforced — infinite loop risk in recovery loop
- **D-19** [HIGH]: Consistency checker output referenced closure variable instead of result.stdout
- **D-20** [HIGH]: skillDir missing from routeCtx — crashed engineering API endpoints on startup
- **D-21** [HIGH]: Corrupted metrics JSON crashes postmortem.py
- **D-22** [MEDIUM]: PM spawned twice on fallback when execution plan missing
- **D-24** [LOW]: Hard ceiling check ran after PM review — wasted one invocation on terminal iteration
- **D-25** [LOW]: reworkHistory lost on checkpoint overwrite after spawn
- **D-16** [HIGH]: PM BLOCKED after maxAttempts — replaced with ship-with-caveats
- **D-17** [LOW]: Unused import in phase-runner.js

### Architecture Changes

- Planning phase now executes as PM (sequential) → parallel downstream workers
- PM Review no longer terminates with BLOCKED — ships with documented caveats instead
- Recovery decisions driven by engineering evidence, not retry counters
- Postmortem runs automatically after every completed task
- 15-worker organization unchanged
- Consistency checker is a script (Hermes-owned), not a worker

### Commits (13 total)

| Hash | Type | Description |
|------|------|-------------|
| 0f681e9 | fix | designer in PHASE_ALLOWED.planning |
| a3ee680 | fix | designer + lease pruning |
| a2bd202 | fix | auto-prune stale leases (D-08) |
| b4882fb | fix | designer tier thinker→crafter |
| 6e9d5c2 | feat | PM repair feedback injection |
| 280fe22 | fix | EDP attempt, stderr, canonical spec |
| d2b8dd0 | feat | Execution Plan + Collaborative Repair + Consistency Checker |
| 33fe1b3 | fix | Ship with caveats, unused import |
| 7948945 | feat | Postmortem + Metrics + Patterns |
| 8a1199b | feat | Recovery Strategy Engine |
| 72ce012 | fix | skillDir in routeCtx |
| c7e6378 | fix | D-18 hard ceiling, D-19 scope bug, D-20 skillDir |
| a2aa120 | fix | D-21 D-22 D-24 D-25 audit defects |

### New Files

- `scripts/engine/recovery-strategy.js` — Strategy ladder + progress evaluation + selection
- `scripts/consistency-checker.py` — Artifact comparison, contradiction detection
- `scripts/postmortem.py` — Postmortem analysis, metrics, pattern discovery
- `references/production-qualification-report.md`

### Modified Files

- `scripts/engine/phase-runner.js` — PM-first spawn, consistency checker
- `scripts/engine/pm-review.js` — Recovery strategy engine replaces maxAttempts
- `scripts/engine/pipeline.js` — Postmortem auto-trigger after COMPLETE
- `scripts/phase-runner.sh` — Execution plan + sibling artifacts injection
- `scripts/pm-review.sh` — Consistency report injection into PM context
- `scripts/pm-repair-respawn.js` — repair-block action implementation
- `scripts/routes/metrics-routes.js` — 3 new API endpoints
- `scripts/routes/public-routes.js` — Version 3.5.0
- `scripts/server.js` — skillDir in routeCtx
- `SKILL.md` — Version 3.5.0

### Validation

- Self-test: 24 passed, 0 failed
- All API endpoints: 200
- Dashboard: built + serving
- Server: running
- No Critical/High/Medium defects remaining
