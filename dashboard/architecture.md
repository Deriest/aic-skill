# Architecture Plan: Fix context-gather backtick crash

## Target File
`scripts/spawn-worker.sh`

## Strategy
Replace `execSync` with `execFileSync` in the generated Node.js runner wrapper inside `scripts/spawn-worker.sh` to execute `opencode` without shell interpretation. This eliminates issues with shell metacharacters like backticks, variables, and semicolons in the gathered project context.

## Proposed Changes

### 1. Import execFileSync
- **Location**: Line 86 of `scripts/spawn-worker.sh`
- **Action**: Replace `const { execSync } = require('child_process');` with `const { execFileSync } = require('child_process');`.

### 2. Update Exec Call to use execFileSync
- **Location**: Lines 92-96 of `scripts/spawn-worker.sh`
- **Action**:
  - Replace the `execSync` template literal call with `execFileSync`.
  - Pass arguments as an array: `['run', promptFile, '-m', model, '--auto']`.
  - Use `promptFile` (which refers to the path passed as `process.argv[2]`) instead of reading the file content and stringifying/embedding it.

## Verification
- Run a test command executing the script with context-gather on a project directory containing code with backticks.
