# Pitfall: Bash Heredoc Escaping in Worker Spawn Scripts

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
   Never inline a prompt payload directly into the string execution of another process if it contains quotes or newlines. Always write the payload to a text file (e.g., `/tmp/prompt.txt`) and have the runner script read it from disk (`fs.readFileSync`).