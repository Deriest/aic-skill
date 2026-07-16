# v3.3.0 Implementation — Proven Patch Sequences

## Context
Complete v3.3.0 implementation across 3 milestones: M1 (Pipeline Reliability), M2 (EDP Architecture), M3 (Planning Intelligence). These are the exact patch sequences that passed validation after a full data loss + recovery cycle.

## M1: Pipeline Reliability

### WP-1.1: pm-review.sh — `--auto` flag
Location: inside the opencode node runner string
```javascript
'run', reviewMsg, '-m', model, '--auto', '--format', 'json', '-f', promptFile,
```
The `--auto` flag was missing from `pm-review.sh` but present in `spawn-worker.sh`. This caused Smart Approval to block read-only tool calls in headless PM sessions.

### WP-1.3: Degraded mode
When `AIC_PM_DEGRADED=1`, pm-review.sh skips content reads and does structure-only validation (file existence, H1 heading, minimum byte count). Returns PASS or BLOCKED without invoking opencode.

### WP-1.3: engine/index.js — 3-attempt retry loop
```
for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  // attempt >= 2 → AIC_PM_DEGRADED=1
  // code 0 → PASS → return
  // code 1 → REWORK → return
  // code 2 → BLOCKED → return
  // else → retry after 2s
}
// all exhausted → infrastructureFailure: true → BLOCKED
```

### WP-1.2: ArtifactProvider
File: `scripts/artifact-provider.js`
Methods: `get`, `getRaw`, `getMetadata`, `list`, `isStale`
Engine imports: `const { ArtifactProvider } = require('../artifact-provider');`

## M2: EDP Architecture

### WP-2.1: PM prompt — YAML EDP schema
Added to pm-review.sh prompt template:
```
verdict: PASS | REWORK | BLOCKED
reason: <string>
decision_package:
  owner: <string>
  root_cause: <string>
  engineering_objective: <string>
  expected_deliverables:
    - <string>
  completion_criteria:
    - <string>
```

### WP-2.2: EDP YAML parser (Python)
Extracts ````yaml ... ```` block, loads with `yaml.safe_load_all`, validates verdict enum, falls back to regex + `BLOCKED` on parse failure. No UNKNOWN ever emitted.

### WP-2.3: Dispatcher routing
Reads `.pm-last-edp.json`, extracts `decision_package.owner`, maps to worker targets, injects `AIC_EDP_OBJECTIVE` and `AIC_EDP_ROOT_CAUSE` into worker environment.

### WP-2.4: Legacy removal
- `pm-repair.js` DELETED
- Import removed from engine: `const { getMaxPmRepairAttempts, parseWorkersFromPmVerdict, resolvePmRepairTargets, readPmVerdictFile } = require('./pm-repair');`
- Full `pmRepairLoop` rewritten to use EDP routing instead of regex inference

## M3: Planning Intelligence

### WP-3.2: Artifact provenance
Frontmatter injected by `spawn-worker.sh`:
```yaml
---
schema_version: 1
task_id: TASK-xxx
phase: Planning
worker: architect
generation: 1
timestamp: 2026-07-16T00:00:00Z
supersedes: 0      # only if generation > 1
repair_iteration: 0  # only if generation > 1
---
```
Uses `awk` to prepend frontmatter to JSON→MD output.

### WP-3.3: Mechanical validation gate
Engine calls `validate-framework-invariants.sh` BEFORE pm-review.sh:
```bash
#!/usr/bin/env bash
for w in "${WORKERS[@]}"; do
  ART="$TASK_DIR/reports/$w-output.md"
  [[ ! -f "$ART" ]] && exit 1
  HAS_H1=$(grep -c "^#" "$ART" || echo 0)
  [[ "$HAS_H1" -eq 0 ]] && exit 1
done
exit 0
```
On failure: engine emits BLOCKED EDP with InvalidArtifact reason (no PM tokens spent).

### WP-3.1: Canonical spec injection
`phase-runner.sh` reads `spec-output.md` and injects `CANONICAL_SPEC_BLOCK` into every Planning worker's prompt. Workers receive the spec as frozen context with mandatory alignment instructions. The block is prepended to the prompt template between `PLANNING_AUTHORITY_BLOCK` and `PM_REPAIR_BLOCK`.

## Patch Order (Critical)
The order matters because patches 2 and 3 depend on patch 1 having removed old code:
1. Patch engine/index.js imports (remove pm-repair, add ArtifactProvider)
2. Patch engine/index.js `runPmReview` function (retry + gate + EDP)
3. Patch engine/index.js `pmRepairLoop` function (EDP routing)
4. Patch pm-review.sh (complete rewrite — safer than incremental)
5. Patch phase-runner.sh (spec injection)
6. Verify spawn-worker.sh frontmatter survived

## Pitfalls: bash wc -w and grep -c on empty files

Both `wc -w` and `grep -c` return `0` with trailing newline on empty files. In bash `[[ "$X" -eq 0 ]]`, the newline causes "syntax error in expression". Fix pattern:
```bash
WORD_COUNT=$(wc -w < "$FILE" 2>/dev/null | tr -d '[:space:]')
WORD_COUNT=${WORD_COUNT:-0}
HAS_H1=$(grep -c "^#" "$FILE" 2>/dev/null | tr -d '[:space:]')
HAS_H1=${HAS_H1:-0}
```

## Validation Commands
```bash
# Syntax
bash -n scripts/pm-review.sh
node --check scripts/engine/index.js
bash -n scripts/phase-runner.sh
bash -n scripts/spawn-worker.sh
node --check scripts/artifact-provider.js

# Feature presence
grep -c '\-\-auto' scripts/pm-review.sh           # should be ≥ 2
grep -c 'AIC_PM_DEGRADED' scripts/pm-review.sh    # should be ≥ 2
grep -c 'ArtifactProvider' scripts/engine/index.js # should be ≥ 1
grep -c 'EDP_JSON\|yaml.safe_load' scripts/pm-review.sh  # should be ≥ 6
grep -c 'FRONTMATTER' scripts/spawn-worker.sh      # should be ≥ 6

# Absence checks
grep -rn 'UNKNOWN' scripts/ | grep -v '# ' | grep -v 'unknown lease'  # should be clean
grep -rn 'MANUAL_APPROVAL' scripts/                 # should be clean
test -f scripts/engine/pm-repair.js && echo BAD || echo GOOD  # should be DELETED
```
