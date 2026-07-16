# Coding Standards — AIC Skill

## Module Patterns

### Shared Utilities
- `scripts/utils.js` — pure functions (percentile, readBody, readTaskContext, etc.)
- `scripts/config.js` — constants, paths, environment helpers
- `scripts/atomic-write.js` — atomic JSON/text write (temp+rename)

### Server Architecture
- `scripts/server.js` — HTTP server, middleware, public routes, static files
- `scripts/routes/*.js` — route handlers (task, runtime, agent, metrics)
- `scripts/ops-endpoints.js`, `scripts/enterprise-endpoints.js` — legacy endpoint modules

### Engine Architecture
- `scripts/engine/index.js` — createEngine orchestrator, wires sub-modules
- `scripts/engine/helpers.js` — shared engine utilities (spawn, contracts, validators)
- `scripts/engine/pm-review.js` — PM review + repair loop
- `scripts/engine/phase-runner.js` — barrier reconciliation, worker spawning, phase execution
- `scripts/engine/pipeline.js` — pipeline sequencing, task completion, knowledge
- `scripts/engine/lease.js` — lease issue/finish
- `scripts/engine/intent.js` — intent handler (task.create, task.start, etc.)
- `scripts/engine/fsm.js` — phase plans, state machine transitions
- `scripts/engine/barrier.js` — barrier operations
- `scripts/engine/persistence.js` — checkpoint read/write, task directory management
- `scripts/engine/recovery.js` — startup reconciliation
- `scripts/engine/validate-artifact.js` — artifact validation
- `scripts/engine/events.js` — event bus
- `scripts/engine/event-store.js` — persistent event store

## Conventions

### Module Exports
- Factory pattern for engine sub-modules: `function createXxx(ctx) { ... ctx.xxx = xxx; }`
- Simple exports for utilities: `module.exports = { fn1, fn2 }`
- Config/paths: `module.exports = { CONST1, CONST2, helperFn }`

### State Management
- Global state accessed via `getState()` / `saveState()` (never direct mutation)
- Atomic writes via `writeJsonSafe()` from `scripts/atomic-write.js`
- Checkpoints via `readCheckpoint(tasksDir, taskId)` / `writeCheckpoint(tasksDir, taskId, cp)`

### Error Handling
- Shell scripts: `set -euo pipefail` (mandatory)
- JavaScript: try/catch in all engine modules
- Exit codes: 0=success, 1=error, 2=blocked

### Naming
- Files: kebab-case (`pm-review.js`, `validate-artifact.js`)
- Functions: camelCase (`runPmReview`, `writeCheckpoint`)
- Constants: UPPER_SNAKE_CASE (`PHASE_PLANS`, `SKILL_DIR`)
- Route handlers: `handle*Routes(req, res, send, ctx)` returning `true` if handled

### File Size Limits
- `scripts/server.js` < 300 lines
- `scripts/engine/index.js` < 300 lines
- Reference docs target: < 60 files

### Imports
- `require()` for Node.js modules
- Relative paths for local modules
- Shared config from `scripts/config.js`
- Shared utils from `scripts/utils.js`
