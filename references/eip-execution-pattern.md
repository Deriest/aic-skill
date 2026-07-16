# EIP Execution Pattern — Engineering Improvement Program

## When to Use
Running a multi-phase Engineering Improvement Program (EIP) against an existing codebase.

## EIP Lifecycle

```
Investigate → Review → Remediate → Planning → EIP-1 → EIP-2 → EIP-3 → EIP-4 → Verification → Closeout
```

Each phase produces a report in `reports/eip-<phase>.md`.

## Phase Execution Pattern

### 1. Implementation Phase (EIP-1 through EIP-4)
For each approved item:
- Read the relevant source files
- Implement the change
- Verify syntax (node --check / bash -n)
- Run self-test.sh baseline
- Mark item complete in todo list

**Batching:** Use `execute_code` for multi-file investigations (grep across many files). Use `delegate_task` for parallel independent items (e.g., vitest setup + shell injection fixes). Use `patch` for surgical edits.

**Exit criteria check:** After all items, run every exit criterion and capture evidence:
```bash
# Example: verify all exit criteria
grep -rL 'set -euo pipefail' scripts/*.sh  # should return 0
grep -c 'writeJsonSafe' scripts/server.js  # should be > 0
wc -l scripts/server.js                     # should be < target
npx vitest run                              # should pass
bash scripts/self-test.sh                   # should pass
```

### 2. Self-Test Baseline
The self-test.sh baseline (passed/failed/warnings) is the regression sentinel. 
- Expected baseline: 23 passed, 0 failed, 2 warnings (server not running, no webhook URL)
- Previous baseline was 24/0/1 — the shift to 23/0/2 is due to operational config changes, NOT regressions
- A "warning" about server-not-running is expected when running outside production

### 3. Master Verification
Collect evidence for EVERY exit criterion:
- Use `execute_code` to batch all evidence collection in one script
- Every conclusion must have a corresponding grep/wc/ls/node --check result
- Cross-phase regression: verify EIP-N didn't regress EIP-(N-1)
- Write `reports/eip-master-verification.md` with evidence register

### 4. Git Hygiene (Deferred)
Do NOT auto-commit across EIP phases. 100+ changed files need manual review.
Report the count but defer to user.

## Pitfalls

**Pitfall: self-test.sh count drift.** The pass/warning count can shift between sessions if scripts add new checks. Compare the FAIL count (0) not the total. Warnings about operational state (server not running, no webhook) are expected outside production.

**Pitfall: Terminal redaction masks $variables as ***.** When verifying bearer tokens or API keys in shell scripts, the terminal output shows `$api_key` as `***`. Always verify with raw bytes:
```python
python3 -c "data=open('script.sh','rb').read(); [print(f'{i+1}: {l}') for i,l in enumerate(data.split(b'\\n')) if b'Bearer' in l]"
```

**Pitfall: vitest requires package.json.** Creating `tests/*.test.js` without `package.json` and `npm install` means tests can't run. Always create package.json first.

**Pitfall: bash regex character class with `-]` pattern.** `[[ "$X" =~ ^[a-zA-Z0-9._:/@ -]+$ ]]` breaks bash because `]` closes the `[[`. Fix: quote the regex or escape the hyphen: `[[ "$X" =~ ^[a-zA-Z0-9._:/@\ -]+$ ]]`.

**Pitfall: python3 subprocess reduction counted wrong.** Only count `python3` calls that do JSON parsing (replaceable with jq). Actual Python script invocations (token-extract.py, json-to-md.py) are NOT replaceable.

**Pitfall: RBAC fail-open catch block.** `catch(rbacErr) { /* allow request to proceed */ }` is a SECURITY vulnerability, not a graceful degradation. Fix: `catch(rbacErr) { return send(res, 500, { error: 'Internal error' }); }`

**Pitfall: /api/config as public endpoint.** Exposes .env contents (API keys, provider configs) without auth. Must require API key authentication on both GET and POST.

## Implementation Patterns

### Input Validation Middleware (JS)
Create `scripts/input-validation.js` with sanitizeString, validateIntent, validateLease, validateTaskCreate. Wire into route handlers:
```javascript
const v = validateIntent(data);
if (!v.ok) { send(res, 400, { error: 'validation', details: v.errors }); return true; }
```

### Shell Script Input Validation (Bash)
Add at top of script after arg parsing:
```bash
if [[ -n "$ID" && ! "$ID" =~ ^[a-zA-Z0-9._:/@\ -]+$ ]]; then
    echo "ERROR: Invalid characters in ID" >&2
    exit 1
fi
```

### Vitest Setup
1. Create package.json with vitest dev dependency
2. Create vitest.config.js with globals: true
3. Write tests in tests/*.test.js
4. Run: npm install && npx vitest run

### CI Pipeline
.github/workflows/ci.yml with: checkout → setup-node → npm install → vitest → self-test → syntax checks
