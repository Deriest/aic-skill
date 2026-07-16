# PITFALL: git checkout destroys uncommitted session work

## Symptom
Running `git checkout -- <file>` to fix a syntax error or corrupted file resets the file to the **last committed state**, wiping ALL session-level implementation that was never committed.

## Root Cause
When working under "Do NOT commit" instructions, no session work exists in git history. `git checkout` cannot distinguish between "revert my bad patch" and "revert to committed baseline" — it always goes to committed state.

## Incident (v3.3.0 Release)
- M1 and M2 were fully implemented via `patch` tool across `pm-review.sh` and `engine/index.js`
- A bad python script rewrite via `execute_code` corrupted `engine/index.js` syntax
- `git checkout engine/index.js pm-review.sh` was run to "fix" the corruption
- Result: ALL M1 (`--auto`, retry loop, degraded mode, ArtifactProvider) and M2 (EDP parser, dispatcher routing, owner mapping) work was permanently destroyed
- Recovery was only possible because LLM session history retained the exact patch strings
- Full restoration required writing entire files from memory + re-applying 6 sequential patches

## Rule
**NEVER use `git checkout`, `git restore`, or `git reset` on files with uncommitted session work.**

### Safe alternatives when a file is corrupted:
1. **Re-read and re-patch** — read the file again, identify the bad patch, apply a targeted fix
2. **Write the entire file** — use `write_file` with the complete correct content from session history
3. **Manual targeted `patch`** — use the `patch` tool to fix only the broken section
4. **Backup first** — `cp <file> /tmp/aic-backup-<date>/` before any fix attempt

### If git checkout is absolutely necessary:
- First `git diff <file>` to see exactly what uncommitted changes exist
- First backup: `cp <file> <file>.bak`
- Only checkout if the uncommitted changes are themselves the problem AND you have another recovery source

## Recovery Sources (priority order)
When session work is lost:
1. **LLM session history** — `patch` and `write_file` tool calls contain exact strings
2. **Editor backup files** — `*.bak`, `*~`, `*.swp`
3. **Temp files** — `/tmp/aic-*`, `/tmp/hermes-*`
4. **git stash** — `git stash list`
5. **Hermes session DB** — `session_search` can recover tool call parameters

## Prevention
- Save critical file states to `/tmp/aic-backup-<date>/` before attempting any file-level fix
- When doing multi-milestone work without commits, periodically snapshot working files
