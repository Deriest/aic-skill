# Pitfall: Bash Heredoc Escaping in Worker Spawn Scripts

## The Problem (FIXED 2026-07-08)

The original `spawn-worker.sh` used `execSync` in its Node.js runner to execute `opencode`. This spawned a shell that interpreted backticks in gathered context as command substitution, causing "Syntax error: end of file unexpected" or "EOF in backquote substitution" (exit 2).

**Root cause:** NOT the heredoc itself (which was already safe with single-quoted delimiter). The bug was `execSync` passing a shell command string that bash interpreted.

**Fix:** Replaced `execSync` with `execFileSync` — passes args as array, no shell involved:
```javascript
// BEFORE (broken):
execSync(`opencode run ${JSON.stringify(prompt)} -m ${model} --auto`, { stdio: 'inherit' });

// AFTER (fixed):
execFileSync('opencode', ['run', promptFile, '-m', model, '--auto'], { stdio: 'inherit' });
```

The `--no-context` workaround flag is no longer needed for backtick crashes.

## Heredoc Safe Pattern

When building wrapper scripts (like `spawn-worker.sh`) that write out secondary execution scripts (e.g., Node.js runners) via heredoc, strict escaping rules apply:

1. **Never nest heredocs inside `bash -c` or `eval`**: 
   Wrapping a heredoc like `bash -c 'cat << "EOF" > script.js ... EOF'` frequently fails with `Syntax error: unexpected EOF` because the outer quotes conflict with the inner string boundaries and newline evaluations.
2. **Safe Pattern**: 
   Write the script to a temp file first using a standard, top-level heredoc, then execute it.
   ```bash
   NODE_RUNNER=$(mktemp "${TMPDIR:-/tmp}/runner-XXXXXX.js")
   cat << 'NODESCRIPT' > "$NODE_RUNNER"
   const fs = require('fs');
   // ... Node code
   NODESCRIPT
   
   node "$NODE_RUNNER"
   ```
3. **Payload Passing**:
   Never inline a prompt payload directly into the string execution of another process if it contains quotes or newlines. Always write the payload to a text file (e.g., `/tmp/prompt.txt`) and have the runner script read it from disk (`execFileSync` passes the file path, not content).

4. **Dispatcher Prompt File Pattern (2026-07-08)**:
   When the Dispatcher (Hermes) spawns workers, inline `cat << 'EOF'` heredocs from the terminal tool will fail if the prompt contains special characters. Use `write_file` tool to write prompts to `/tmp/prompt-*.txt`, then call `spawn-worker.sh` with those paths.

## Nested JSON in Bash -c Pitfall (IMP-024-A, 2026-07-14)

**Symptom:** After editing `spawn-worker.sh`, `bash -n` reports `unexpected EOF while looking for matching ')'` on line 198. The whole task pipeline fails with `pm failed` / `line 198: unexpected EOF`.

**Root cause:** Payload line constructing `COMPLETE_PAYLOAD` with `python3 -c "import json; print(json.dumps({'exitCode': int('${EXIT_CODE}'), 'artifactPath': '''${ARTIFACT_PATH}'''}))"` — the `'''${ARTIFACT_PATH}'''` triple-single-quote trick breaks when script is written via `write_file` / Replit heredoc interpolation. The closing `)` of `$()` is inside mangled quoting → unclosed command substitution.

**Fix pattern (always use this for JSON payloads in bash):**

```bash
# WRONG — nested ''' interpolation
COMPLETE_PAYLOAD=$(python3 -c "import json; print(json.dumps({'exitCode': int('${EXIT_CODE}'), 'artifactPath': '''${ARTIFACT_PATH}'''}))")

# RIGHT — env vars + single-quoted python -c
FINAL_EXIT="$EXIT_CODE" FINAL_PATH="$ARTIFACT_PATH" COMPLETE_PAYLOAD=$(python3 -c 'import json,os; print(json.dumps({"exitCode": int(os.environ.get("FINAL_EXIT","0")), "artifactPath": os.environ.get("FINAL_PATH","")}))')
```

**Rule:** Never interpolate bash vars inside a `python3 -c "double-quoted"` that constructs JSON. Use `FOO="$bar" python3 -c 'single-quoted reads os.environ'` instead. Validate with `bash -n` after every edit touching this line.

