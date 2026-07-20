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

6. **`@tailwindcss/postcss` always missing** — workers include `postcss.config.js` with `@tailwindcss/postcss`
   plugin but forget to add it to `devDependencies`. Fix: `npm install -D @tailwindcss/postcss --legacy-peer-deps`.

## R3F / Three.js TypeScript Fixes

Workers frequently produce code with these TypeScript errors. Fix patterns:

### `<line>` → `<Line>` from drei
```tsx
// WRONG — <line> is SVG line element, R3F complains
<line geometry={geometry}>
  <lineBasicMaterial color="#2a2a4a" />
</line>

// CORRECT — use drei's Line component
import { Line } from '@react-three/drei'
<Line points={[from, to]} color="#2a2a4a" lineWidth={1} />
```

### bufferAttribute args
```tsx
// WRONG — count/array/itemSize props not recognized
<bufferAttribute attach="attributes-position" count={n} array={a} itemSize={3} />

// CORRECT — use args array
<bufferAttribute attach="attributes-position" args={[a, 3]} />
```

### Missing useFrame import
Workers often use `useFrame` in scene components but forget to import it:
```tsx
import { useFrame } from '@react-three/fiber'
```

### useFrame outside Canvas (blank page crash)
`useFrame` MUST be inside a `<Canvas>` component. If a component uses `useFrame` but is rendered as a sibling to `<Canvas>`, it crashes silently → blank page.

**Detection:** ErrorBoundary shows `R3F: Hooks can only be used within the Canvas component!`

**Fix:** Convert to native `requestAnimationFrame` for DOM-level effects (see anti-pattern #29 in engine-anti-patterns-and-fixes.md)

## Lucide React Icon Renames (v0.344+)

| Old Name | New Name |
|----------|----------|
| Github | GitBranch or ExternalLink |
| Twitter | Globe |
| Linkedin | ExternalLink |
| Test | FlaskConical |

Always check: `node -e "const l = require('lucide-react'); ['IconName'].forEach(n => console.log(n, n in l))"`

## React 19 + R3F Version Compatibility

Workers generate `package.json` with old R3F versions. R3F v8 does NOT support React 19 → blank page (silent runtime crash, no visible error).

**Required versions for React 19:**
```json
"@react-three/fiber": "^9.0.0",
"@react-three/drei": "^10.0.0",
"three": "^0.170.0",
"@types/three": "^0.170.0"
```

**Detection:** Browser shows blank white page. HTML/CSS/JS all return 200. No error in curl. Only visible in browser console.

**Verification:** `node -e "console.log('r3f:', require('@react-three/fiber/package.json').version)"`

## Blank Page Debugging (React + R3F)

When browser shows blank white page but HTML/CSS/JS all return 200:

1. **Add ErrorBoundary** wrapper around App to capture runtime errors
2. **Check React + R3F version compatibility** — R3F v8 doesn't support React 19
3. **Check browser console** — silent crash shows nothing in curl/terminal
4. **Verify with**: `node -e "console.log(require('@react-three/fiber/package.json').version)"`

**Common blank-page causes:**
- R3F v8 + React 19 → upgrade to R3F v9 + Drei v10
- Missing dependency → check `npm install` output
- Import path typo → `grep -rn "from '\.\." src/` to find unresolved imports

## Vite Build Caveats

Hermes blocks `vite build` as "long-lived server/watch process". Always use:
```
terminal(background=true, notify_on_complete=true, command="npx vite build 2>&1")
```

`npx serve dist` also blocked. Same approach:
```
terminal(background=true, command="npx serve dist -l tcp://0.0.0.0:3000 2>&1")
```

## Post-Extraction Verification Checklist

After code extraction, ALWAYS run before declaring done:

1. `npx tsc --noEmit` — TypeScript check
2. `npx vite build` — verify build succeeds (background=true)
3. Check R3F/React version compatibility (v9+ for React 19)
4. Check missing devDeps: `@tailwindcss/postcss`, `@types/three`
5. Check lucide-react icon names: `node -e "const l=require('lucide-react'); console.log('Github' in l)"`
6. Check `<line>` → `<Line>` from drei (SVG vs Three.js conflict)
7. Check `bufferAttribute` uses `args` prop, not count/array/itemSize
8. Check `useFrame` import exists in scene components
10. Remove any accidentally created files (e.g. Maintenance.tsx from agent confusion)

## ErrorBoundary Pattern

Always wrap App with ErrorBoundary to surface runtime errors (React swallows them silently, blank page):

```tsx
// src/ErrorBoundary.tsx
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error } }
  render() {
    if (this.state.hasError) {
      return <div style={{ padding: 40, background: '#0f0f23', color: '#ff4444' }}>
        <h1>Runtime Error</h1><pre>{this.state.error?.message}\n{this.state.error?.stack}</pre>
      </div>
    }
    return this.props.children
  }
}

// main.tsx
<ErrorBoundary><App /></ErrorBoundary>
```
