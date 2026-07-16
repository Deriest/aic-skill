# Dispatcher Pitfalls

> **Consolidated from 5 files.** Originals archived in `references/archive/`.

**Original files merged:**
- `dispatcher-pitfalls-browser.md`
- `dispatcher-pitfalls-dashboard.md`
- `dispatcher-pitfalls-heredoc.md`
- `dispatcher-pitfalls-history.md`
- `dispatcher-pitfalls-ui.md`

---

---

## Source: `dispatcher-pitfalls-browser.md`

# Browser / GUI Access Restrictions and Capabilities

## X11/Desktop Reachability (Computer Use)
- X11 is functional (`DISPLAY=:1`, `XDG_SESSION_TYPE=x11`) and accessible via `computer_use`.
- **Known Issue (Blank Screen):** When the desktop is locked or in screen blanking mode (idle), `computer_use(action='capture', mode='vision')` will return a completely black image (0 interactable elements, no applications).
- **Attempted Workarounds:** Attempting to wake the screen via terminal commands (`xset s off -dpms`, `gsettings set org.gnome.desktop.session idle-delay 0`) or simulating mouse movement does not successfully unlock or wake the session if it's deeply locked or if a remote desktop connection (like XRDP/RustDesk) has been minimized/disconnected.
- **Resolution:** The user MUST manually wake/unlock the display by logging in or reconnecting their remote desktop client before `computer_use` can capture the UI or interact with applications like Firefox.

## Browser_Navigate Restrictions
- **Cloudflare/Bot Detection:** Navigating to certain sites (e.g., `https://chatgpt.com`) using the headless `browser_navigate` tool will be blocked by Cloudflare (resulting in a "Just a moment..." page or bot detection warnings).
- **Alternative:** Use desktop Firefox via `computer_use` instead, provided the desktop is unlocked (see above).
---

## Source: `dispatcher-pitfalls-dashboard.md`

# AIC Dashboard Pitfalls — Complete Reference

## 1. UI and API State Synchronization

- **Polling Endpoints:** The frontend MUST poll `GET /api/status` to retrieve the full dashboard state (`currentTask`, `phases`, `agents`, `logs`). Polling `/api/workers` is a legacy route that only returns agent lists, causing the Pipeline, Current Task, and Activity Log to remain empty.
- **Worker ID Mapping:** The `WORKERS` array in the backend (`scripts/server.js`) MUST be a 1:1 match with the IDs defined in the frontend (`src/data/workers.ts`) (e.g., `['pm', 'frontend', 'backend', ...]`). If the backend uses legacy IDs (like `frontend_engineer`), status updates via `POST /api/agent-status` will be silently ignored and the UI will not reflect the working state.
- **Status Fallbacks in UI:** When rendering styles based on backend status strings, always provide a fallback to prevent Babel/React crashes. Example: `const config = statusConfig[phase.status as keyof typeof statusConfig] || statusConfig.pending;`. Without this, an unknown status from the backend will result in `config is undefined` and crash the entire UI.

## 2. Server Stability

- **Audit Log Deduplication:** The backend's `audit()` function must deduplicate identical consecutive logs. Without this, infinite render loops or aggressive polling scripts will spam the `audit.json` file, flooding the Activity Log and crashing the frontend state.
- **Watchdogs:** Avoid aggressive infinite `while true; curl` bash watchdogs for status updates, as they can easily DDOS the lightweight Node.js server. Handle status resets gracefully within the task lifecycle or via manual `/aic stop`.

## 3. OpenCode CLI Integration

- **Model Provider Names:** Custom AI proxies often reject requests if the model string includes a prefix they don't recognize. If `opencode run` fails with `UnknownError: Unexpected server error` or `No active credentials for provider`, verify that the model names in `.env` (e.g., `Sonnet`) perfectly match the proxy's expected IDs, and that `opencode.jsonc` has the correct provider mapping.

## 4. Typescript Prop Drilling and Primitive Refactoring

When modernizing legacy `DashboardContext` (Context API) into direct props mapping (Polling API):
*   Do not blindly convert TS Object Interfaces (`{status: string, engine: string}`) into primitive types (`string`) if child leaf nodes (like `StatusBubble`, `DeskComputer`, and `usePixelCanvas`) explicitly expect string types. This mismatch causes `Object is not a string` or `overlap` errors.
*   **Resolution:** Prefer maintaining the Object Interface definition in the root `types.ts`, and explicitly mapping object primitive fields to child components: `status={workerState?.status ?? 'idle'}` at the point of injection (e.g. inside `WorkerGrid.tsx` map iterators).

## 5. Refactoring Overuse of Regex (Sed)

When resolving Typescript Type overlaps inside React functional components, **DO NOT** use `sed` replacements (e.g. `sed -i 's/status ===/status.status ===/g'`).
*   **Reason:** `sed` operates line-by-line and will inadvertently destroy ES6 component imports, interface brackets (`{}`), and object spread syntax resulting in broken TSX files (e.g. `TS1005: ';' expected`).
*   **Fix:** Use explicit `write_file` replacements or `patch` mode for complex React components to maintain structural integrity.

## 6. Recharts Chart Pitfalls

### Dashboard Vite circular chunk warning
`manualChunks` splitting `recharts` into a separate `ui` chunk from `vendor: ['react']` causes circular dependency. Browser refuses the circular JS = blank page. Dev mode (port 6869) works fine because Vite doesn't bundle — only production build (port 6868) breaks. FIX: merge into same chunk: `vendor: ['react', 'react-dom', 'framer-motion', 'recharts']`. Never split dependencies that share transitive imports into separate manualChunks.

### Vite dev server vs API server port conflict
`server.js` and Vite (`npm run dev`) both default to port 6868 in the current config. When testing dashboard UI changes, running `npm run dev` will block `server.js` if it's already running.
**Fix:** Do not run Vite dev server. Instead, run `npm run build` and let `server.js` serve the static output (`dist/`) via `node server.js 6868`.

### Dashboard + API same port
`server.js` on 6868 serves both API endpoints and dashboard static files. No separate port.

### React Dashboard UI Stats sync
Dashboard states must account for `subWorkers`. 
**Pitfall:** Calculating 'complete' workers by filtering `status === 'complete'` causes false positives if the head worker finished its prompt generation but its sub-workers are still running.
**Fix:** Filter by `w.status === 'complete' && (!w.subWorkers || w.subWorkers.every(sw => sw.status === 'complete'))`.

### AreaChart Single Data Point
Recharts AreaChart with only 1 data point renders as a dot, not a filled area. Use BarChart for categorical/discrete data (worker names). AreaChart is for timeseries with 2+ data points.

### BarChart White Hover Background
Recharts BarChart default cursor highlights bars on hover with light color clashing dark themes. FIX: `<Tooltip cursor={{ fill: 'transparent' }} />`.

### XAxis Label Auto-Skip
Recharts auto-skips XAxis labels when too many categories. FIX: `interval={0}` + reduce `tick={{ fontSize: 9 }}`.

### Chart Type Consistency
User prefers same chart type for all visualizations on a page. Don't mix AreaChart and BarChart without asking.

### Pre-populate All Workers
Always include all 9 workers (excluding dispatcher) with 0 values to reserve X-axis space. Use SHORT_NAMES (Aria, Atlas, etc.) for chart labels, WORKER_NAMES (Aria (PM), Atlas (Architect), etc.) for table display.

### Worker Display Name Hierarchy
Chart X-axis = SHORT_NAMES (short, fits 9 bars). Tooltip + Table = WORKER_NAMES (full name + jobdesc). Dispatcher excluded from all tracking (not spawned via opencode run).

## 7. Cache Hit Rate Formula

**Wrong**: `cache / (input + output)` → nonsensical % (e.g. 4904%). **Correct**: `cache / (cache + input)` → valid 0-100% ratio.

## 8. Prompt File Location

NEVER save prompt files to `/tmp/` (cleaned up). Always save to `.aic/prompts/` inside the project directory.

## 9. spawn-worker.sh JSON Escaping

When editing curl POST calls in spawn-worker.sh, ALWAYS escape JSON quotes with `\\\"` inside double-quoted strings. `{"agent":"$WORKER"}` is WRONG — it silently fails because bash breaks the string at the first unescaped quote. Correct: `{\\\"agent\\\":\\\"$WORKER\\\",\\\"status\\\":\\\"complete\\\"}`. The `|| true` at the end swallows the error, making this extremely hard to debug.

**Proven bug (2026-07-08):** worker status stuck at "working" because complete call had unescaped quotes. User: "pipeline tidak terupdate saat pengetestan, worker juga cuma dispatch yang update".

## 10. Git Auto-Commit Guard

The Governor worker and Dispatcher (you) must NEVER automatically `git commit` or `git merge`. Always stop and ask the user to explicitly choose the action (commit to main, new branch, or merge).

---

## Bug Patterns (Verified Fixes)

### 1. Activity Log Infinite Spam — Root Causes (3-layer bug)

**Layer 1 — Server returns full audit array every poll (no drain):**
`/api/status` mapped `state.audit.map(...)` without clearing it. Every 5s poll returned the same entries.
**Fix:** Drain-on-read: map to `logs`, then `state.audit = []` before returning response.

**Layer 2 — Frontend APPEND_LOG grows forever:**
`useStatusPolling.ts` dispatched `APPEND_LOG` in a for-loop for each entry. Dedup check only compared last entry, so entries 2–N always passed.
**Fix:** Replace with `SET_LOGS` action that overwrites entire `logEntries` array each poll. Requires adding the action type to `types/index.ts` and case to `dashboardReducer.ts`.

**Layer 3 — Worker status never resets on task_complete:**
`/api/task-complete` only reset workers with `status === 'working'`. Workers set via other paths stayed stale forever.
**Fix:** Unconditionally reset ALL workers to `{status:'idle'}` in task_complete handler.

### 2. Pipeline / CurrentTask Blinking

**Cause:** `TaskInfoPanel.tsx` uses `<AnimatePresence key={state.currentTask.id}>`. Polling creates new object references every 5s even with identical data → Framer Motion exit/enter animation fires every cycle.
**Fix options:**
- Use `currentTask?.title` as key (stable string) instead of full object
- Or use `useRef` to memoize and compare before dispatching `MERGE_STATUS`
- Or disable `AnimatePresence` mode="wait" and use simple conditional rendering

### 3. Dispatcher Status Spam

**Symptom:** Setting `{"agent":"dispatcher","status":"working"}` caused `[reset] {}` and `[agent_status]` spam every 2s.
**Root cause (verified 2026-07-07):** Not a React reset call — was actually `watchdogd` background process + stale frontend cache. After killing watchdogd and clearing `state.json` + `audit.json`, spam stopped.
**Fix:** Kill all background watchdog processes. Clear `.aic/state.json` and `.aic/audit.json`. Hard-refresh browser. The `SET_LOGS` fix (pattern #1) also prevents reoccurrence.

### 4. PM Ghost-Status (worker shows working without being dispatched)

**Cause:** `MERGE_STATUS` reducer merges `incoming` agents with existing `state.agents`. If PM was ever set to working (by old dispatcher logic) and never explicitly reset, it persists across polls.
**Fix:** Server-side: `task_complete` now resets ALL workers (pattern #1 layer 3). Client-side: `MERGE_STATUS` should fully replace agent map, not deep-merge.

---

## Source: `dispatcher-pitfalls-heredoc.md`

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


---

## Source: `dispatcher-pitfalls-history.md`

# AIC Pitfalls — Detailed History

Historical anecdotes and detailed troubleshooting stories. For actionable rules, see SKILL.md Pitfalls section.

---

## ❌ Over-extending analysis requests into full pipelines

When the user asks for analysis (e.g., "coba kasih saran", "how to", "what are the options", "give me suggestions"), they want **recommendations only** — NOT a full pipeline implementation. Do NOT spawn PM → Architect → Engineer → QA → Governor for an analysis request. Only spawn the single relevant worker (usually PM for requirements) to produce the analysis. The user will tell you when they want to implement.

**User correction (2026-07-06):** "engga saya ga suruh fix dashboard sekarang, saya minta cari tau cara untuk menaikan efesiensi waktu" — I spawned a full 5-phase pipeline when the user only wanted efficiency analysis. Over-extending wastes time and ignores the actual request scope.

---

## ❌ Dispatcher writing code directly instead of spawning workers

When the user invokes `/aic` with ANY task (including "improve dashboard", "fix this", "add feature"), you MUST follow the full Dispatcher workflow — classify, plan, spawn workers, chain phases. Do NOT write code directly yourself, even if the task seems simple or is about the skill itself. The user explicitly expects to see the pipeline (Phase 1/5, 2/5, etc.) and worker results. Violating this defeats the entire purpose of the AIC system.

**User correction (2026-07-06):** "padahal saya pakai skill aic untuk improve dashboard apakah sudah sesuai perkerjaan nya? soalnya tidak ada report phase 1-5 etc" — The user was frustrated that `/aic dashboard improve` was handled by directly editing files instead of spawning workers through the pipeline.

**⚠️ PRE-FLIGHT CHECK — run this BEFORE every `/aic` task:**
```
Am I about to write code / edit files / run terminal commands?
  → YES = STOP. Spawn a worker via delegate_task instead.
  → NO  = Proceed (classification, planning, reporting is Dispatcher work).
```
The Dispatcher's ONLY tools for code work are: `delegate_task` (orchestration) and `opencode run` (worker spawn). If you catch yourself reaching for `write_file`, `patch`, or `terminal` for code edits — that's a Rule #1 violation. Stop immediately and spawn a worker.

---

## ❌ Bypassing the pipeline when handed a pre-formatted TASK HANDOFF

A `=== TASK HANDOFF ===` block (with TASK ID, TYPE, SCOPE, ACCEPTANCE CRITERIA, PRIORITY) is a worker dispatch — it tells the recipient worker what to build, NOT an instruction for the Dispatcher to execute the work itself. The correct response is:
1. **Acknowledge** as Dispatcher
2. **Verify** the prior phases ran (or run them now if missing)
3. **Spawn the next phase worker** via `opencode run` (coding) or `delegate_task` (thinking) — point them at the handoff block as `goal`
4. **Report** each phase transition to the Operator

**Recurring failure (2026-07-06, task TASK-20260706-001):** The user pasted a fully-formed feature handoff for the React AIC dashboard rebuild. The Dispatcher read it, then executed the full 32-file scaffold + build verification directly using its own tools — no PM handoff, no Architect review, no QA pass, no Governor sign-off. The user got a working dashboard but the multi-agent pipeline the AIC skill exists to demonstrate was bypassed. The `Priorities/Rule #1` rule applies even when the handoff text is detailed enough to execute: the value of the system is the pipeline, not just the deliverable.

---

## ❌ CSS overflow-hidden must go on the RIGHT container

When clipping absolutely-positioned children with negative offsets (e.g., `top-[-35px]`), `overflow-hidden` must go on the **innermost container** that wraps ONLY the elements to be clipped — NOT the outermost parent. The outermost parent often has its own absolutely-positioned children (labels, overlays) that also use negative offsets and must NOT be clipped.

**Pattern:**
```tsx
// ❌ WRONG — clips the "VIRTUAL OFFICE" label (top-[-12px]) AND the StatusBubble (top-[-35px])
<div className="... overflow-hidden">
  <div className="absolute top-[-12px]">VIRTUAL OFFICE</div>
  <div className="relative overflow-hidden">  {/* ← this is where overflow-hidden belongs */}
    <WorkerGrid />
  </div>
</div>

// ✅ CORRECT — clips only the StatusBubble inside WorkerGrid
<div className="...">
  <div className="absolute top-[-12px]">VIRTUAL OFFICE</div>
  <div className="relative overflow-hidden">
    <WorkerGrid />
  </div>
</div>
```

**Diagnostic:** If a fix clips things that should stay visible, you put `overflow-hidden` on the wrong ancestor. Move it one level deeper.

---

## ❌ Cross-platform path cleanup after upstream sync

When pulling updates from the external repo (e.g., `Deriest/aic-skill`), the upstream may contain Windows-only hardcoded paths (`C:/Users/TVD/...`, `taskkill`, `netstat -ano`, `start http://...`). After rsync, **immediately** run a verification grep and bulk-fix with `sed -i` — do NOT use the `patch` tool for this (it fails on escaped backslashes in Windows paths). Use:

```bash
# Verify
grep -rn 'C:/Users\|C:\\Users\|taskkill\|findstr\|netstat -ano\|\.exe' ~/.hermes/skills/workflows/aic/ --include="*.md" --include="*.sh"

# Bulk fix
sed -i 's|C:/Users/TVD/AppData/Local/hermes/skills/workflows/aic|~/.hermes/skills/workflows/aic|g' SKILL.md
```

Canonical cross-platform patterns to enforce:
| Windows-only | Cross-platform |
|---|---|
| `C:/Users/TVD/...` | `~/.hermes/...` or `$HOME/.hermes/...` |
| `taskkill /F /IM opencode.exe` | `pkill opencode` (Linux/macOS) / `taskkill` (Windows) |
| `netstat -ano \| findstr :PORT` | `lsof -ti:PORT \| xargs kill` (Linux/macOS) |
| `start http://...` | `xdg-open` (Linux) / `open` (macOS) |

**Upstream repo:** https://github.com/Deriest/aic-skill — sync with `rsync -av --exclude='.git'`

---

## ❌ Dashboard Vite fails after fresh clone or repo sync (`ERR_MODULE_NOT_FOUND: vite`)

The dashboard's `node_modules` are NOT in the git repo (`.gitignore` excludes them). After cloning or syncing from upstream, `npx vite --port 6969` will fail with `Cannot find package 'vite'`. **Always run `npm install` in the dashboard directory before starting Vite:**

```bash
cd ~/.hermes/skills/workflows/aic/dashboard && npm install
```

Add this as a prerequisite check in the `/aic dashboard` startup flow — if `node_modules/` doesn't exist, install first.

---

## ❌ First-run config should detect existing OpenCode setup

Before running the full "enter API key → choose model tier" flow, **always check** if `~/.config/opencode/opencode.jsonc` (or `%APPDATA%/opencode/opencode.jsonc` on Windows) already exists and has a provider configured. If it does:
1. Read the existing config (provider name, baseURL, apiKey, model IDs)
2. Ask the Operator: "OpenCode sudah terdeteksi dengan provider [name]. Mau pakai config yang sama?"
3. If yes → auto-generate `.env` from the existing config (no re-entry needed)
4. If no → proceed with full interactive flow

This avoids redundant re-entry when the user already set up OpenCode previously.

---

## ❌ OpenCode config: model key ≠ API model name

In `opencode.jsonc`, the **model key** (used in `--model provider/KEY`) is NOT the same as the **model name** sent to the API. OpenCode sends the `name` field to the API endpoint, NOT the key.

**Correct pattern (tier names as keys):**
```jsonc
"models": {
  "Thinker": { "name": "ActualModelNameFromAPI" },
  "Crafter": { "name": "AnotherModelName" },
  "Sprinter": { "name": "ThirdModelName" }
}
```
Usage: `opencode run --model myprovider/Thinker` → sends `ActualModelNameFromAPI` to API.

**WRONG (causes "No active credentials for provider: openai"):**
```jsonc
"models": {
  "ActualModelNameFromAPI": { "name": "ActualModelNameFromAPI" }
}
```

**Root cause (2026-07-07):** `setup.sh` was generating keys equal to model names. OpenCode couldn't find the key and fell back to `openai` provider. Fixed by using tier keys (`Thinker`, `Crafter`, `Sprinter`) with `name` set to the actual API model name. Tier names were renamed from Opus/Sonnet/Haiku on 2026-07-07 to be provider-agnostic.

---

## ❌ Setup.sh: auto-fetch models from proxy, don't make user type them

The setup flow for custom proxy should:
1. Ask for base URL and API key first
2. Auto-fetch available models from `{BASE_URL}/models` (with auth header)
3. Display numbered list of available models
4. Let user pick model for each tier (Thinker/Crafter/Sprinter) by number, with sensible defaults (1/2/3)
5. Generate `opencode.jsonc` with correct key/name mapping + `.env`

**User correction (2026-07-07):** User wanted auto-detection, not manual typing of model names. Setup was simplified from 6 provider options to 3 (API/Free/Skip) with universal OpenAI-compatible flow.

---

## ❌ Node.js auto-install via apt/brew gets ancient versions

`setup.sh` tried `sudo apt-get install nodejs npm` which installs v12/v14 on most distros. OpenCode requires Node 18+. Replace auto-install with version check:
```bash
NODE_VERSION=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 18 ]; then
    echo "Node.js >= 18 required. Install from https://nodejs.org/"
    exit 1
fi
```

---

## ❌ `write_file` redacts secret-like patterns in shell scripts

The `write_file` tool has a security redactor that silently replaces patterns matching secrets (e.g. `${API_KEY}`, `sk-...`) with `***` in the written content. When writing shell scripts that contain credential variables in heredocs (like `Authorization: Bearer ***`), **always verify** the written file afterward with `grep` or `read_file`. If redaction occurred, use `patch` to restore the variable reference — `patch` does NOT trigger the redactor.

**Caught (2026-07-07):** `setup.sh` configure_proxy() heredoc had `Authorization: Bearer ***` rewritten to `Authorization: Bearer ***`. Fixed via `patch` tool.

**Workaround pattern:**
1. Write the script with `write_file` using a placeholder like `__API_KEY_PLACEHOLDER__`
2. Use `patch` to replace the placeholder with `${API_KEY}`
— OR —
3. Write the file, then `grep` for `***`, then `patch` any redacted lines back

---

## ❌ OpenCode `limit.context` per model — discovered 2026-07-07

OpenCode supports `limit` per model in `opencode.jsonc`. This controls context window and output token caps **per model tier**, independent of the model's actual max context.

**Schema (from `https://opencode.ai/config.json`):**
```jsonc
"limit": {
  "context": <number>,  // max context tokens (required)
  "input": <number>,    // max input tokens (optional)
  "output": <number>    // max output tokens (required)
}
```

**AIC tier limits (for 1M context models):**
```jsonc
"Thinker":  { "name": "...", "limit": { "context": 800000, "output": 64000 } },
"Crafter":  { "name": "...", "limit": { "context": 512000, "output": 32000 } },
"Sprinter": { "name": "...", "limit": { "context": 256000, "output": 16000 } }
```

**Why this matters:** Even if the underlying model supports 1M tokens, setting `limit.context` constrains OpenCode's context window per tier. Thinker gets more room for codebase analysis, Sprinter stays fast with less context. Combined with tier-aware `context-gather.sh --tier`, this prevents context overflow and controls cost.

---

## ❌ Dashboard activity log loop — drain-on-read fix (2026-07-07)

**Symptom:** Dashboard Activity Log showed duplicate entries that grew with every poll cycle. Each poll re-delivered the same logs, and the client re-appended them.

**Root cause:** `GET /api/status` returned `state.logs` without clearing it. Every 2-second poll returned the full log history, and the React client appended every entry again.

**Fix (server.js lines 126-130):**
```js
// Drain logs so client doesn't re-append the same entries each poll
const logsOut = state.logs.slice();
const logOut = state.log;
state.logs = [];
state.log = null;
flush();  // persist the cleared state to disk
```

**Pitfall:** Must clear BOTH `state.logs` (array) AND `state.log` (backward-compat single entry) AND call `flush()`. Missing `state.log` causes grep-based tests to find "ghost" entries. Missing `flush()` causes restart to re-deliver drained logs from disk.

**Verification:** Seed 7 events via POST, poll 3 times: poll 1 gets 7, poll 2 gets 0, poll 3 gets 0.

---

## ❌ test-api.sh false failures from test ordering (2026-07-07)

**Symptom:** `test-api.sh` reported 23/25 pass, 2 fail. Step 9 checked `currentTask == null` and `agents == empty` after "task-complete", but saw stale state from step 8.

**Root cause:** Step 8 created a new task ("Concurrent-Test") with 10 agents but didn't call `task-complete` + `reset` before step 9 verified clean state. Step 9 expected reset state from step 6's `task-complete`, but step 8 overwrote it.

**Fix:** Add cleanup after step 8:
```bash
# Clean up concurrent test state
post /api/task-complete '{}'
post /api/reset '{}'
```

**Lesson:** Test scripts that create side effects must clean up before downstream assertions that assume clean state. Every "create" should have a matching "destroy" before the next verification block.

---

## ❌ Hardcoded provider presets get stale model IDs (2026-07-07)

**Symptom:** `setup.sh` had separate functions for OpenRouter, Anthropic, OpenAI with hardcoded model IDs (`claude-3-opus-20240229`, `anthropic/claude-3-opus`). By 2026-07-07 these were outdated — Claude 4 models exist.

**Root cause:** Preset functions encoded model IDs at write time. As models update, presets rot silently.

**Fix:** Delete all preset functions. Use one universal OpenAI-compatible flow for ALL providers:
1. User enters base URL + API key
2. Script auto-fetches `/v1/models`
3. User picks Thinker/Crafter/Sprinter by number
4. Generate config with actual current model IDs

This works for OpenRouter, Anthropic, OpenAI, local proxies, LiteLLM — anything with an OpenAI-compatible API.

**Lesson:** Never hardcode model IDs. Auto-detect from the API, or let the user pick from a live list.

---

## ❌ Sub-worker tier assignment — must be same or lower than head

When a Head spawns sub-workers, the sub-worker tier must be **same or lower** than the head. A Thinker head should not spawn a Thinker sub-worker — that wastes expensive context on a narrow sub-task.

**Rules:**
- Thinker head → Crafter sub-worker (default), Sprinter (fast tasks)
- Crafter head → Sprinter sub-worker (default)
- Sprinter head → Sprinter only
- **Exception:** Researcher sub-workers can use Crafter even under a Thinker head, because research needs reasoning depth

**Why:** Sub-workers handle focused sub-tasks (one file, one component, one endpoint). They don't need the full context window. The head coordinates; sub-workers execute narrowly.

**User correction (2026-07-07):** User pointed out that sub-workers shouldn't just be "head but smaller" — they're specialists with narrower scope, not reduced-power copies. The head-of-worker hierarchy exists for parallelism (3 sub-workers finishing in 1/3 the time), not for power scaling.

---

## ❌ context-gather.sh must use --tier flag per worker tier

When gathering context before spawning a worker, always pass the `--tier` flag matching the worker's tier. This controls tree depth, file line caps, and output size:

```bash
bash ~/.hermes/skills/workflows/aic/scripts/context-gather.sh <project_dir> --tier thinker   # 128KB, depth 4, 500 lines/file
bash ~/.hermes/skills/workflows/aic/scripts/context-gather.sh <project_dir> --tier crafter   # 64KB, depth 3, 300 lines/file
bash ~/.hermes/skills/workflows/aic/scripts/context-gather.sh <project_dir> --tier sprinter  # 32KB, depth 2, 150 lines/file
```

**Pitfall:** Using the default (no --tier) gives crafter-level context. For Thinker workers (PM, Architect) analyzing large codebases, always use `--tier thinker` to get deeper tree + more file content. For Sprinter workers (QA), use `--tier sprinter` to keep context fast and focused.

**Wrong:** `context-gather.sh .` for a Thinker worker → only 16KB, misses deeper files.
**Right:** `context-gather.sh . --tier thinker` → 128KB, depth 4, catches nested modules.

**Lesson:** The --tier flag isn't optional decoration — it's the mechanism that matches context gathering to the worker's actual context window (800K/512K/256K). Without it, Thinker workers get Sprinter-level context and miss the deep analysis they're designed for.

---

## ❌ Dispatcher skipping workflow to fire workers directly

When the user invokes `/aic` and a new task starts, the Dispatcher historically jumped straight to spawning engineers (e.g. `agent-status backend: working` while `phase: "PM (Translation)"`), bypassing the PM/Architect spec phases entirely. The user reported: "tolong di fix ini workflow aic, suka langsung di tembak ke front end padahal workflow sudah di buat".

**Root cause:** `state.phase` was a free-form string — any caller could write `phase: "PM (Translation)"` and then immediately set `backend: working` with no server-side check. The state machine existed in docs only, not in code.

**Fix (2026-07-07):** Added a 5-phase **outer task lifecycle** state machine in `scripts/server.js` that wraps (does not replace) the 6-phase worker workflow:
- `Investigate` → `Planning` → `Implementation → Verification → Closeout`
- `LIFECYCLE_PHASES` + `LIFECYCLE_ALLOWED_WORKERS` constant at top of `server.js`
- `POST /api/task-start` now ALWAYS sets `state.workflow.current = "Investigate"` and resets ALL workers to idle (no auto-spawn)
- `POST /api/agent-status` with `status: "working"` returns HTTP 403 if the worker is not in the allowed set for the current lifecycle phase (engineers forbidden in Investigate/Planning; governor only in Closeout)
- `POST /api/phase-start` with `lifecyclePhase` rejects backwards transitions
- `POST /api/phase-advance` stops at Closeout (no wrap-around)
- `reconcileLifecycle()` runs at boot to handle legacy `state.json` with workers already working

The 6-phase **worker workflow** (PM → Architect → Engineers → QA → Governor) in `SKILL.md` is preserved unchanged. The lifecycle is a separate orthogonal axis: it governs which workers may be `working` at a given moment, while the workflow describes the typical sequence for a given task type. Both can coexist because the lifecycle's allowed-set table is a superset of the workflow's typical sequence (e.g. PM works in Planning, Engineers work in Implementation, Governor works in Closeout).

---

## Source: `dispatcher-pitfalls-ui.md`

# Dashboard UI & Server Pitfalls

## Node.js Static Server Crashes on Vite Rebuilds
**Symptom:** The backend API server (`server.js`) crashes with an `ENOENT` error when the frontend runs `npm run build`.
**Root Cause:** Vite temporarily deletes `dist/index.html` during the build process. If the server receives a request and attempts an SPA fallback (`res.sendFile('index.html')`) at that exact moment, it throws an unhandled error and dies.
**Fix:** Always wrap static fallback reads with `fs.existsSync`. If the file is missing, gracefully return an HTTP 503 (e.g., "Dashboard is building") instead of attempting to serve a non-existent file.

## SVG Overflow with object-fit
**Symptom:** Pixel-art SVGs overflow their parent containers despite having inline `width: 100%`, `height: 100%`, and `objectFit: "cover"`.
**Root Cause:** The SVG's native `preserveAspectRatio="none"` attribute overrides CSS `object-fit`.
**Fix:** Change the SVG attribute to `preserveAspectRatio="xMidYMid slice"`. This is the SVG-native equivalent of `object-fit: cover` and ensures the graphic scales proportionally and clips correctly without bleeding out of `overflow-hidden` containers.

## Optical Alignment of Pixel Icons
**Symptom:** Text-baseline alignment (`flex items-center`) leaves pixel-art icons (like `▶`) visually misaligned (usually too low).
**Fix:** Do not rely solely on flexbox for pixel-perfect optical alignment of mixed icon/text elements. Remove flex centering from the icon wrapper and apply explicit translation: `className="inline-block -translate-y-[2px]"`.

## Config Form Jsonc Parsing
**Symptom:** The opencode.jsonc config file appears blank in the UI.
**Root Cause:** Raw textarea representations are unsafe and the UI doesn't know how to parse trailing comments in JSONC.
**Fix:** Provide a two-column form UI. Parse `opencode.jsonc` by stripping comments (`replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1')`) before passing to `JSON.parse`. Include a "Fetch Models" button that hits `baseURL + '/models'` with the provided API key, maps the available IDs, and populates dropdown selects.

## Dispatcher "SOP Harga Mati" & Server Lifecycle
**Symptom:** PM or Governor workers silently fail to activate (stay "idle" on dashboard) despite being spawned successfully.
**Root Cause:** The server's `PHASE_ALLOWED` array lacks the worker for that specific phase, returning a 403 Forbidden silently to `spawn-worker.sh`.
**Fix:** Ensure backend lifecycle logic perfectly mirrors the strict SOP. `pm` MUST be allowed in `investigate` and `planning`. `governor` MUST be allowed in `documentation` and `verification`. The Dispatcher is ABSOLUTELY FORBIDDEN from bypassing phases, even for trivial visual tasks (SOP Harga Mati).