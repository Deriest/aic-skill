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
