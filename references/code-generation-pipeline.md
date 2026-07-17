# AIC Code Generation Pipeline

Session: 2026-07-17. Workers wrote reports but never created actual project files.
Root cause: workers are LLM calls that produce markdown reports, not file-writing agents.

## The Problem

Pipeline completed all 5 phases → dashboard showed COMPLETE → but `/home/tvd/AIC-WEB/` was empty.
Workers (backend, frontend) wrote reports like "The index.html already exists with Hello World" 
but never created any files. Reports describe what SHOULD exist but don't CREATE it.

## Solution: Code Block Extraction

Convention: workers embed fenced code blocks with file paths in their reports.
A post-process script extracts these into actual project files.

### Worker Output Convention

````markdown
# Implementation Report

## Files Created

```tsx src/components/Hero.tsx
export function Hero() {
  return <div>Hello</div>;
}
```

```html index.html
<!DOCTYPE html>
<html><body><div id="root"></div></body></html>
```

```css src/index.css
body { margin: 0; }
```
````

### Extraction Script

**File:** `scripts/extract-code-blocks.py`

```bash
python3 scripts/extract-code-blocks.py <report_file> <project_dir> [--dry-run]
```

- Parses ```` ```<lang> <filepath> ```` and ```` ```file:<filepath> ```` patterns
- Writes to `<project_dir>/<filepath>` with `os.makedirs` for directories
- Skips if file already exists with identical content
- Validates extension against known types (.tsx, .ts, .jsx, .js, .css, .html, .json, .md, .py, .sh, .yaml, .yml, .toml, .svg)
- Exit 0 = files extracted, 1 = no blocks found, 2 = bad args

### Integration in phase-runner.sh

After barrier completes for IMPLEMENTATION phase:

```bash
# In phase-runner.sh, after "ALL WORKERS PASSED"
if [[ "${PHASE,,}" == "implementation" ]]; then
  for worker in backend frontend; do
    python3 extract-code-blocks.py reports/${worker}-output.md "$PROJECT_DIR"
  done
fi
```

### Worker Prompt Update

Implementation workers (backend, frontend) receive this in their prompt:

```
CRITICAL — FILE GENERATION:

You MUST create actual project files. Do NOT just write a report describing what files should exist.

For EVERY file you need to create, include a fenced code block with the EXACT file path:
    ```tsx src/components/MyComponent.tsx
    // actual code here
    ```

Rules:
- File path MUST be on the same line as the opening backticks (after the language tag)
- Use RELATIVE paths from the project directory
- Generate COMPLETE files — no placeholders, no "...", no truncation
- Every file referenced in imports MUST be generated
- package.json, tsconfig.json, vite.config.ts, index.html — generate ALL config files needed
- The system will extract these code blocks into actual files automatically
```

## Pitfalls

1. **Language tag ≠ filepath**: ```` ```tsx src/Foo.tsx ```` is parsed as lang=`tsx`, path=`src/Foo.tsx`.
   ```` ```typescript src/Foo.tsx ```` also works — the parser takes the second token as path.
   BUT ```` ```tsx ```` with no path is skipped. Workers MUST include the path.

2. **Absolute paths rejected**: If a worker writes ```` ```tsx /home/tvd/AIC-WEB/src/App.tsx ````, 
   the script checks if it starts with `project_dir` prefix. If yes, converts to relative. 
   Otherwise skips (security: don't write to arbitrary paths).

3. **Overwrite semantics**: If file exists with same content, skip. If different content, overwrite.
   This allows repair cycles to update files without manual deletion.

4. **Only IMPLEMENTATION phase extracts**: Planning/architect/research workers write reports only.
   Backend + frontend in IMPLEMENTATION generate actual code via code blocks.

5. **Server must be restarted** after changing `phase-runner.sh` — the server's in-memory state
   doesn't pick up shell script changes. Kill PID and let auto-restart handle it.
