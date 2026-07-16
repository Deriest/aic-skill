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

### Logical Git Commit Grouping
After EIP implementation, do NOT commit all files in one commit. Group by type:
1. `refactor: EIP implementation` — core scripts/ code changes
2. `feat: testing infrastructure + CI` — package.json, tests/, .github/
3. `docs: version alignment` — README, SKILL.md, dashboard/package.json, docs/INDEX.md
4. `refactor: reference docs consolidation` — references/ (archive moves + active)
5. `docs: EIP documentation` — reports/ (use `git add -f` since reports/ is in .gitignore)

Always use `git add -f` for .gitignore'd report files. Commit messages reference EIP phase + item counts.

## Pitfalls (Session 2)

**Pitfall: Self-test count drift between EIP phases.** Baseline was 24/0/1 for EIP-1 through EIP-3, shifted to 23/0/2 for EIP-4. The shift: a test previously passing now emits a warning (server-not-running). NOT a regression. The FAIL count (0) is the true signal. Always compare FAIL counts across phases, not total pass counts.

**Pitfall: Subagent fixes can conflict with parent changes.** When delegating parallel tasks via `delegate_task`, file domains MUST be non-overlapping. In this session, the injection-fix subagent applied escape sanitization to knowledge-*.sh while the parent also applied allowlist validation. The subagent's changes were overwritten. Solution: check subagent file modifications before applying your own fixes, or apply your own fixes AFTER subagents complete.

**Pitfall: Bash regex `[-]` in character class.** `[[ "$X" =~ ^[a-zA-Z0-9._:/@ -]+$ ]]` breaks bash syntax when `-` appears near `]` in the character class. Fix: quote the entire regex: `[[ "$X" =~ "^[a-zA-Z0-9._:/@ -]+$" ]]`. Alternatively, place `-` at the start or end of the character class or escape with `\ `.

**Pitfall: .gitignore blocks EIP report commits.** `reports/` is in .gitignore. Use `git add -f reports/eip-*.md` to force-add EIP documentation. Otherwise the 11 report files won't be committed.

**Pitfall: Verification second pass may find new data.** Running Master Verification twice is valid — the second pass confirmed all findings from the first pass and added 30-item evidence register. If the first verification was fast/cursory, a comprehensive second pass is worthwhile.

**Pitfall: Version bump edit ≠ committed.** A Release Management phase can edit all version references (README.md, SKILL.md, dashboard/package.json, context lines in SKILL.md decision tree) and report "done", but the changes only exist in the working directory. They are NOT committed, NOT pushed, and no git tag exists. A subsequent VERSION AUDIT will reveal the repo on GitHub still shows the old version. **Rule:** After version bump, ALWAYS verify with `git diff --stat` and `git log --oneline -1` that the commit exists. The complete release sequence is:
1. Edit all version references (including SKILL.md decision tree context lines like "IF v3.X.0 master plan")
2. `git add` the changed files
3. `git commit -m "chore: bump version to vX.Y.Z"`
4. `git push origin main`
5. `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
6. `git push origin vX.Y.Z`
7. Verify: `git tag -l 'vX.*'` shows the new tag
8. Verify: `git log --oneline origin/main..HEAD` returns empty (all pushed)

**Pitfall: SKILL.md decision tree context lines reference old version.** When bumping versions, the SKILL.md decision tree entries like `IF v3.3.0 master plan / pipeline resilience...` contain the version in their trigger text. These must be updated too — otherwise the decision tree still triggers on the old version string. Use `replace_all=true` when patching version strings in SKILL.md.
