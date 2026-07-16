# Model Selection & Process Management Pitfalls

## Sonnet (crafter) Cannot Edit Large Files

**Discovered:** 2026-07-08 during TASK-20260708-020

Sonnet (crafter tier) fails silently when editing files >100 lines. It reads the file, creates a todo list, then exhausts output tokens thinking without ever calling write/edit tools. The worker reports "completed successfully" but the file is unchanged.

**Test results:**
| File | Size | Model | Result |
|------|------|-------|--------|
| `/tmp/opencode-test.txt` | 1 line | Sonnet | ✅ Success |
| `requirements.json` (new file) | ~50 lines | Sonnet | ✅ Success |
| `architecture.md` (new file) | ~50 lines | Sonnet | ✅ Success |
| `ConfigPage.tsx` (existing) | 368 lines | Sonnet | ❌ Failed 4x |
| `ConfigPage.tsx` (existing) | 368 lines | Opus | ✅ Success 1st try |

**Rule:** Use Opus (thinker) for Frontend/Backend Engineer when editing existing files >100 lines. Sonnet is fine for PM, Architect (creating new files), QA, and small edits.

## `pkill -9 node` Is Unverified

**Discovered:** 2026-07-08

`pkill -9 node` may fail silently or kill unrelated Node processes. Verified: PID 42163 survived `pkill -9 node` but died immediately with `kill -9 42163`.

**Rule:** Always use `kill -9 <PID>` with the specific PID obtained from `pgrep -f "server.js 6868"` or `lsof -i :6868`.

## `write_file` Secret Redaction

The `write_file` tool's built-in secret detection redacts API key patterns to `***` in terminal output. The FILE itself is correct — only the display is redacted.

**Verification:** Check file content length or use `includes()` pattern matching instead of visual inspection.
