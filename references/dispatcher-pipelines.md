# Dispatcher Pipelines

> **Consolidated from 7 files.** Originals archived in `references/archive/`.

**Original files merged:**
- `dispatcher-dashboard.md`
- `dispatcher-github-readme.md`
- `dispatcher-opencode.md`
- `dispatcher-pipeline-ui.md`
- `dispatcher-planning-designer-website.md`
- `dispatcher-promo-website-pipeline.md`
- `dispatcher-auth-reset.md`

---

---

## Source: `dispatcher-dashboard.md`

# AIC Dashboard — Complete Reference

## Architecture

**Enforced Constraint:** The dashboard is strictly a read-only visual control plane ("Pure Virtual Office") combined with a minimal system config editor.

### Core Principles

- **No Chat or Action Logs:** All human-in-the-loop interaction, task creation, and logging occur strictly in the Hermes TUI via the Dispatcher. The dashboard must NOT implement chat UI, task input forms, or activity log feeds.
- **Visual State Sync:** The UI visually reflects `state.json` (worker statuses, current engines) via continuous polling to `/api/status`.
- **Pipeline Tracker:** The UI tracks the strict, non-negotiable 5-phase lifecycle: `Investigate → Planning → Implementation → Verification → Closeout`.
- **Config Management:** Exposes a simple editor for `.env` and `opencode.jsonc` via `/api/config` to allow hot-swapping providers or variables without restarting the control plane.
- **Minimal Backend (`server.js`):** Serves the static Vite build and acts as a strict state gatekeeper. It enforces the 5-phase lifecycle transitions and rejects out-of-bound worker activations.

---

## API Endpoints

### POST /api/task-start
Sets `currentTask` on state, resets all workers to idle. **Must be called before any worker spawns.**
```json
{"id": "TASK-YYYYMMDD-NNN", "title": "...", "type": "bugfix|feature|..."}
```

### POST /api/task-status
Sets `currentPhase` (and optionally `currentTask`). Use for phase transitions.
```json
{"currentPhase": "Investigate|Planning|Implementation|Verification|Closeout"}
```

### POST /api/agent-status
Sets individual worker status. Worker must be in allowed set for current phase (enforced server-side).
```json
{"agent": "pm", "status": "working|complete|idle"}
```

### POST /api/task-complete
Marks task done. **Does NOT reset workers** — they stay `complete` so dashboard shows who did what.
Workers reset to idle only on next `task-start`.

### POST /api/reset
Nuclear option — clears everything including currentTask/currentPhase.

---

## Pipeline Phase Lifecycle

Order: `Investigate → Planning → Implementation → Verification → Closeout`

PipelineTracker component renders phases as: `Investigate, Planning, Implementation, Verification, Closeout`
When `currentPhase === 'Closeout'`, ALL phases show green (task fully complete).

---

## Worker Status Visual

| Status | Color | CSS Pattern |
|--------|-------|-------------|
| working | Yellow | `border-aic-yellow shadow-[0_0_15px_rgba(255,255,0,0.15)] animate-pulse` |
| complete | Green | `border-aic-green shadow-[0_0_15px_rgba(0,255,136,0.15)] animate-pulse` |
| idle | Grey | `border-gray-500/30 shadow-[0_0_10px_rgba(128,128,128,0.1)] animate-pulse` |

---

## State Persistence

State stored in `.aic/state.json`. Persists across server restarts.
After `task-complete`, worker statuses are preserved in state.json until next `task-start`.

**Cleanup Rule:** The server `loadState()` MUST clean up obsolete worker keys (e.g. `researcher` vs `research`) that are no longer in the `WORKERS` constant array. Failure to do so leads to UI bugs where the dashboard renders total worker counts (e.g., 16 workers) that exceed the defined maximum of 15.

---

## Task Context Persistence

`POST /api/task-start` now creates `.aic/tasks/TASK-XXX/` with `context.json`, `state.json`, `reports/` dir.
Phase transitions (`POST /api/task-status`) persist to task `state.json` and save `report` field to `reports/<phase>.md`.
Worker output auto-saved to `reports/<worker>-output.md` by `spawn-worker.sh`.

---

## Work Package Decomposition

`POST /api/work-packages` — saves WP array to `.aic/tasks/TASK-XXX/work-packages.json`.
`GET /api/work-packages/:taskId` — returns WPs for a task. WP status: `pending | active | complete | blocked`.
Blocked = `depends_on` has incomplete WPs.

---

## Dashboard Tabs

Tabs: OVERVIEW (1) → HISTORY (2) → COSTS (3) → CONFIG (4)
- **HistoryPage.tsx** — task list with expand/collapse for WP tree. INTERRUPTED = red `#ff0000` badge (NOT yellow). RESUME button triggers `/api/task-status`. Uses `bg-aic-bg-panel`, `font-pixel`, `text-px-base` per theme.
- **api/index.ts** — added `getTasks()`, `getTaskDetail(taskId)`, `getWorkPackages(taskId)`.

---

## Config Page

Both `.env` and `opencode.jsonc` panels are mirror-identical. Fields: PROVIDER_ID, BASEURL, API_KEY (masked), FETCH_MODELS, MODEL_THINKER/CRAFTER/SPRINTER.
Server reads real `~/.config/opencode/opencode.jsonc` (not template).

---

## UI/UX Rules (Cyberpunk Pixel-Art)

The AIC Dashboard is a pure React frontend built with Vite and Tailwind CSS. It specifically adheres to an 8-bit retro pixel-art aesthetic heavily leaning into a cyberpunk theme (navy/black bg, cyan accents, neon yellow alerts).

### Core Layout Constraints

- **Fixed Full-Height:** The dashboard must fit on a single screen without vertical scrolling (`h-full`, `min-h-0`, `overflow-hidden` on parent containers). Do NOT use `overflow-y-auto` on the main page wrapper.
- **Header / Navigation:** Uses `App.tsx` state (`activeTab`) to switch between pages without `react-router`. Uses `font-pixel`, text shadows (`text-shadow-cyan`), and tracking-widest for retro feel.
- **Overview Page:** Serves the 3D-ish isometric/flat hybrid `OfficeFloor`.
  - **Pipeline Tracker:** Resides dynamically on the right sidebar, tracing the strict 5-phase lifecycle. Scales to fill available height (`flex-1`).
  - **Worker Statistics (Active/Complete/Idle):** Resides at the bottom of the right sidebar, directly beneath the pixel art scene. Do NOT place stats beneath the Virtual Office grid.
- **Config Page:** Resides in a separate tab (`CONFIG (4)`). Contains form-based key-value pairs mapping `.env` and `opencode.jsonc`, omitting raw `<textarea>` inputs for usability.

- **Costs Page Layout:**
  - Token Over Time chart: 40% width (`md:w-2/5`).
  - Token By Worker chart: 60% width (`md:w-3/5`).
  - Uses an asymmetric horizontal layout to prevent worker labels from bunching, preserving the UI legibility across 15 Head Workers.

### Positioning & Pixel Aesthetics

- **Avatars (`WorkerDesk`):** Powered by `framer-motion` and HTML5 Canvas (`usePixelCanvas.ts`). Rendered strictly with `imageRendering: 'pixelated'`.
- **Negative Space (Breathability):** Use generous vertical spacing (`space-y-12`, `py-6`) between department sections. Use generous horizontal gaps (`gap-6 md:gap-8`) between desks. Desk width should be modest (e.g., `w-[150px]`) to avoid overpowering the screen.
- **Alignment:** Worker grids MUST be center-aligned (`flex justify-center`, `flex flex-col items-center`), never left-aligned.
- **Z-Indexing:** Desks overlap gracefully. Hover effects create neon box-shadows (`shadow-[0_0_15px_rgba(0,255,255,0.2)]`). Idle workers should have reduced opacity (`opacity-80`) and no glowing borders to emphasize active ones.
- **Worker Sorting Hierarchy:** The grid strictly sorts workers top-to-bottom: `Leadership` (Dispatcher + Governor) -> `Product` -> `Engineering` -> `Platform`. Ensure `groupWorkersBySection` returns a sorted array tuple. Use subtle borders beneath section headers.
- **Desk Accents:**
  - *Monitor*: Anchored relative to desk using `-top-12 right-2`. Do NOT let it float offside.
  - *Status Plat/Bubble*: Anchored `top-2 left-1/2 -translate-x-1/2` directly on the wooden surface div.

### Component Constraints

- **No Activity Log:** Do not add or restore Activity Logs. The UI relies strictly on the Virtual Office avatars and the Pipeline Tracker.
- **No Scrolling:** Do not apply overflow containers that prompt scrollbars on the main dashboard view. The components must compress or flex to share viewport bounds perfectly.

### Typescript Strictness

- Avoid using `sed` or bash scripts to update `.tsx` types. Rely on LSP or explicit `write_file`. The dashboard expects nested `{ status, engine }` primitive extractions from the `DashboardContext`, so visual components like `StatusBubble` must be passed `status={state?.status ?? 'idle'}`.

---

## Source: `dispatcher-github-readme.md`

# AI Engineering Company (AIC) — Hermes Skill

10-worker orchestration system for AI-powered software development.

Your Hermes agent becomes a **Dispatcher** that classifies tasks, spawns specialized workers, and manages the full development pipeline — from requirements to deployment.

## Workers

| Worker | Tier | Purpose |
|--------|------|---------|
| PM | Thinker | Requirements, acceptance criteria |
| Architect | Thinker | System design, API contracts |
| Researcher | Crafter | Investigation, analysis |
| Designer | Crafter | UX/UI specs |
| Frontend Engineer | Crafter | UI implementation |
| Backend Engineer | Crafter | API implementation |
| Infrastructure Engineer | Crafter | Deployment, CI/CD |
| QA Engineer | Sprinter | Testing, validation |
| Governor | Crafter | Compliance review |

**Tier aliases** — workers reference `Thinker`, `Crafter`, `Sprinter` (not model IDs). You pick the actual models during setup.

**Context limits per tier** (configured in `opencode.jsonc`):

| Tier | Context Window | Output | Use for |
|------|---------------|--------|---------|
| Thinker | 800K tokens | 64K | PM, Architect — large codebase analysis, complex reasoning |
| Crafter | 512K tokens | 32K | Engineers, Governor — focused coding tasks |
| Sprinter | 256K tokens | 16K | QA — fast validation, targeted testing |

## Worker Hierarchy

Each worker is a **Head** who can work AND spawn sub-workers for parallel tasks:

```
Dispatcher (Hermes)
  └── PM (Head, Thinker) → can spawn Researcher, Designer
  └── Architect (Head, Thinker) → can spawn Researcher, multiple Engineers
  └── Frontend (Head, Crafter) → can spawn Designer, sub-Frontend
  └── Backend (Head, Crafter) → can spawn Researcher, sub-Backend
  └── QA (Head, Sprinter) → can spawn sub-QA for parallel test suites
  └── ... (all 9 heads can spawn sub-workers)
```

Sub-workers use same or lower tier than their head (Thinker→Crafter, Crafter→Sprinter).

## Quick Start

```bash
curl -fsSL https://raw.githubusercontent.com/Deriest/aic-skill/main/scripts/setup.sh | bash
```

Or manually:
```bash
npm install -g opencode-ai@latest
git clone https://github.com/Deriest/aic-skill.git /tmp/aic-skill
cp -r /tmp/aic-skill/* ~/.hermes/skills/workflows/aic/
hermes
> /aic build a REST API with JWT auth
```

## Setup

```
[1/4] Checking dependencies...     ✓ Node.js, npm, jq
[2/4] Installing OpenCode...       ✓ opencode-ai
[3/4] Configure your AI provider...
      1) Connect to API            → URL, API key, auto-detect models
      2) Free models               → zero config
      3) Skip                      → manual

      Select Thinker model [1]:    ← pick the complex reasoning model
      Select Crafter model [2]:    ← pick the standard coding model
      Select Sprinter model [3]:   ← pick the fast/lightweight model

[4/4] Installing AIC skill...      ✓ dashboard + deps
```

Works with **any** OpenAI-compatible API: OpenRouter, Anthropic, OpenAI, local proxies, LiteLLM, etc.

## Usage

```
hermes                  # start Hermes
/aic                    # activate Dispatcher mode (once per session)
build a REST API with JWT auth   # Dispatcher classifies → spawns workers
fix the login bug on mobile      # routes to bug pipeline
/aic stop               # deactivate, return to normal Hermes
```

> `/yolo` — enable no-permission mode. Workers run without approval gates.

| Command | What it does |
|---------|-------------|
| `/aic` | Activate Dispatcher mode (stays active for the session) |
| `/aic dashboard` | Start dashboard + API server |
| `/aic status` | Show current task progress |
| `/aic stop` | Deactivate Dispatcher mode |
| `/yolo` | Toggle YOLO mode (no permission prompts) |

## Task Types

| Say this | Type | Pipeline |
|----------|------|----------|
| `build X` | feature | PM → Architect → [Designer] → Engineers → QA → Governor |
| `fix X` | bug | Engineer (→ QA if complex) |
| `research X` | research | Researcher (→ PM if actionable) |
| `design Y` | design | Designer |
| `audit X` | security | Backend → Governor |
| `deploy X` | infra | Infra → QA |
| `try/spike X` | experiment | Researcher → Architect (POC, not production) |
| `optimize X` | optimize | Architect → Engineers → QA |
| `improve X` | iterate | PM → Engineers → QA |
| `edit/fix X that doesn't match` | refine | Engineer(s) (targeted fix) |
| `migrate X to Y` | migrate | Architect → Engineers → QA → Governor |
| `clean up X` | maintain | Engineers → QA |
| `plan X` | planning | PM → Architect (specs only, no code) |
| `develop X` | develop | PM → Architect → Engineers → QA (multi-session) |

## Dashboard

| Service | Port | URL |
|---------|------|-----|
| Status API (Node) | 6868 | http://localhost:6868/api/status |
| Dashboard (Vite) | 6969 | http://localhost:6969 |

## License

MIT

---

## Source: `dispatcher-opencode.md`

# OpenCode Free Models — Tested Configuration

## Recommended Model

**`opencode/deepseek-v4-flash-free`** — fast, reliable, no auth required.

```bash
opencode run "task" --model opencode/deepseek-v4-flash-free
```

## All Free Models

| Model | Speed | Status | Notes |
|---|---|---|---|
| `opencode/deepseek-v4-flash-free` | Fast | ✅ Tested | Best for coding workers |
| `opencode/mimo-v2.5-free` | Medium | Untested | |
| `opencode/nemotron-3-ultra-free` | Medium | Untested | |
| `opencode/north-mini-code-free` | Slow | ⚠️ Timeout | Observed timeout >60s |
| `opencode/big-pickle` | Slow | Untested | |

## Verified Test (2026-07-06)

```bash
# Basic hello — worked in <5s
opencode run "Say hello" --model opencode/deepseek-v4-flash-free
# Output: Hello

# Code creation + execution — worked in <10s
opencode run "Create a file called test.py with a function hello() that returns 'OpenCode works!' and a test for it. Then run the test." \
  --model opencode/deepseek-v4-flash-free
# Created file, ran test, confirmed pass
```

## Pitfalls

- `north-mini-code-free` can timeout on non-trivial tasks. Use `deepseek-v4-flash-free` instead.
- `opencode run` (one-shot) does NOT need `pty=true`. Only the interactive TUI does.
- Free models have rate limits — if you get 429s, wait or switch to a paid provider.
# OpenCode Custom Provider Configuration

## Overview

OpenCode supports custom OpenAI-compatible providers. This guide shows how to configure your own proxy or API endpoint.

## Critical Rule

**Always use `npm: "@ai-sdk/openai-compatible"` for custom providers.**

Do NOT use `provider.openai` with a custom baseURL — it silently fails.

## Configuration Pattern

### File Location

```
~/.config/opencode/opencode.jsonc
```

### Template

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "YOUR_PROVIDER_ID": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Your Provider Name",
      "options": {
        "baseURL": "https://your-api.com/v1",
        "apiKey": "sk-..."
      },
      "models": {
        "opus": { "name": "your-opus-model" },
        "sonnet": { "name": "your-sonnet-model" },
        "haiku": { "name": "your-haiku-model" }
      }
    }
  }
}
```

### Usage

```bash
opencode run "task" --model YOUR_PROVIDER_ID/sonnet
```

## Provider Examples

### Self-hosted Proxy

```jsonc
{
  "provider": {
    "myproxy": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "My Proxy",
      "options": {
        "baseURL": "https://my-api.com/v1",
        "apiKey": "sk-..."
      },
      "models": {
        "opus": { "name": "GPT-4" },
        "sonnet": { "name": "GPT-3.5 Turbo" },
        "haiku": { "name": "GPT-3.5 Turbo" }
      }
    }
  }
}
```
Usage: `opencode run --model myproxy/opus` → sends `GPT-4` to API.

⚠️ Model keys MUST be `opus`, `sonnet`, `haiku` (generic). The `name` field holds the actual API model name. Do NOT use the API model name as the key — it breaks `opencode run`.

### OpenRouter

```jsonc
{
  "provider": {
    "openrouter": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "OpenRouter",
      "options": {
        "baseURL": "https://openrouter.ai/api/v1",
        "apiKey": "sk-or-..."
      },
      "models": {
        "opus": { "name": "anthropic/claude-3-opus" },
        "sonnet": { "name": "anthropic/claude-3-sonnet" },
        "haiku": { "name": "anthropic/claude-3-haiku" }
      }
    }
  }
}
```

### Anthropic (Direct)

```jsonc
{
  "provider": {
    "anthropic": {
      "npm": "@ai-sdk/anthropic",
      "name": "Anthropic",
      "options": {
        "apiKey": "sk-ant-..."
      },
      "models": {
        "claude-3-opus-20240229": { "name": "Claude 3 Opus" },
        "claude-3-sonnet-20240229": { "name": "Claude 3 Sonnet" },
        "claude-3-haiku-20240307": { "name": "Claude 3 Haiku" }
      }
    }
  }
}
```

### OpenAI (Direct)

```jsonc
{
  "provider": {
    "openai": {
      "npm": "@ai-sdk/openai",
      "name": "OpenAI",
      "options": {
        "apiKey": "sk-..."
      },
      "models": {
        "gpt-4o": { "name": "GPT-4o" },
        "gpt-4o-mini": { "name": "GPT-4o Mini" },
        "gpt-4-turbo": { "name": "GPT-4 Turbo" }
      }
    }
  }
}
```

## Debugging

```bash
# Check if provider is loaded
opencode debug config

# List available providers
opencode providers list

# Test with a simple prompt
opencode run "say hello" --model YOUR_PROVIDER_ID/sonnet
```

## Common Issues

| Error | Cause | Fix |
|---|---|---|
| `No active credentials for provider: openai` | Model key = API model name instead of generic `opus/sonnet/haiku` | Use generic keys, put API name in `name` field |
| `No active credentials for provider: openai` | Using `provider.openai` with custom baseURL | Use custom provider ID |
| `API key invalid` | Wrong API key | Check provider dashboard |
| `Model not found` | Model ID mismatch | Check `/v1/models` endpoint, verify `name` field matches |
| `Connection refused` | Wrong baseURL | Verify URL format |
| `Binary locked` (Windows) | OpenCode process running | `taskkill /F /IM opencode.exe` |
| `Binary locked` (Linux/macOS) | OpenCode process running | `pkill opencode` |

---

## Source: `dispatcher-pipeline-ui.md`

# Pipeline Card UI Sizing Lessons

## Problem
Pipeline card text was either too large (`text-px-base md:text-px-lg` = pixel-font base/large) or too small (`text-[8px]` = barely readable). The user explicitly rejected both extremes.

## Solution (verified 2026-07-08)
For a fixed-height Pipeline card (`h-[240px]`) with 5 phases:

```tsx
// Card container: tight padding, flex-1, no scroll
<div className="bg-aic-bg-panel border-2 border-aic-border/50 rounded-lg p-4 flex-1 shadow-lg flex flex-col relative overflow-hidden">
  // Inner wrapper: justify-between distributes 5 items evenly, NO overflow-y-auto
  <div className="flex flex-col justify-between z-10 flex-1 min-h-0">
    {phases.map((p, idx) => (
      // Phase label: text-px-sm (10px) is the sweet spot
      <div key={p} className={`flex items-center gap-3 font-pixel text-px-sm transition-all duration-300 ${textColor} ${isActive ? 'scale-105 ml-2' : ''}`}>
        <span className="w-8 text-center">{icon}</span>
        <span className="uppercase tracking-widest">{p}</span>
      </div>
    ))}
  </div>
</div>
```

## Key Decisions
- **Font:** `text-px-sm` — readable, fits 5 lines in 240px card with room to breathe
- **Spacing:** `justify-between` instead of `gap-N` — automatically distributes evenly regardless of card height
- **Padding:** `p-4` (not `p-6`) — gives more internal space for the text
- **No scroll:** Pipeline phase list is always exactly 5 items, never changes → scroll is wrong here
- **Current Task:** This one DOES need `overflow-y-auto` because task descriptions vary in length

## What NOT to do
- `text-[8px]` — too small, user explicitly rejected
- `text-px-base md:text-px-lg` — too big, causes overflow or requires scroll
- `gap-1` or `gap-2` with `overflow-y-auto` — scroll is wrong for a fixed 5-item list
- Using `min-h-[xxx]` on sidebar cards — causes expansion on dynamic content

---

## Source: `dispatcher-planning-designer-website.md`

# Planning: Designer required for website / promo UI tasks

**User (2026-07-13):** *"kita ga pakai designer ? kan ini website"*

## When mandatory

Spawn **Luna (Designer)** in **Planning** when the deliverable is user-facing UI:

- Marketing one-page / landing for aic-skill
- Any **website**, dashboard skin, or static publishable front door
- Work packages assign **Luna** to Plan tasks (design tokens, dashboard mock) — if Luna was never spawned, Planning is **incomplete**

A **design-brief** in `.aic/prompts/` (Dispatcher-written constraints) is **not** a substitute for `docs/design-spec.md` (or `ux-spec.md`) from Luna.

## Correct Planning sequence (promo / website)

1. **Architect** → `docs/architecture-spec.md`
2. **Designer** → `docs/design-spec.md` (tokens, section layout, typography, dashboard mock rules, responsive breakpoints)
3. **PM Review** on **both** artifacts (and `discovery-report.md` / `work-package.md` from Investigate)
4. **Implementation** → Frontend (Leo) reads arch + **design spec** + design-brief

Do **not** spawn Frontend after Architect-only Planning when user asked for dashboard-matched visuals.

## If Frontend already running without design spec

1. Ask user: **strict** (kill Frontend → spawn Luna → PM Review → re-spawn Frontend) vs **pragmatic** (finish Leo → Luna/QA visual rework)
2. Default when user challenged missing designer: **strict** unless they choose pragmatic

## PM Review artifact list

```bash
pm-review.sh Planning /project \
  docs/architecture-spec.md \
  docs/design-spec.md
```

## Cross-refs

- `references/promo-landing-site-pattern.md`
- `references/dispatcher-lifecycle.md`
- `dispatcher-discipline-aic` → `references/pipeline-strictness.md`
---

## Source: `dispatcher-promo-website-pipeline.md`

# Promo Website Pipeline — Dispatcher Playbook

Session-hardened flow for one-page static sites promoting `github.com/Deriest/aic-skill`: English copy, dashboard-matched visuals.

## User constraints (freeze early)

Write `<project>/.aic/prompts/<TASK-ID>-design-brief.md`:

- **Language:** full English (no Indonesian in public UI)
- **Visual:** match AIC Operations Control Center — `#0f0f23`, `#1a1a2e`, `#00d4ff`, status yellow/green/gray
- **Publish target:** static (GitHub Pages), no backend v1

## Phase sequence (no skips)

| Phase | Workers | Artifacts | PM Review |
|-------|---------|-----------|-----------|
| Investigate | PM (thinker) | `docs/discovery-report.md`, `docs/work-package.md` | Both files |
| Planning | Architect (thinker) | `docs/architecture-spec.md` | With design-spec |
| Planning | **Designer Luna (thinker)** | `docs/design-spec.md` | With architecture-spec |
| Implementation | Frontend Leo (crafter) | Vite app, `npm run build` PASS | Per impl report |
| Verification | QA Eve (**crafter** if file mandatory) | `docs/verification-report.md` | `VERDICT: PASS` on disk |
| Closeout | Documentation Echo (**crafter** if file mandatory) | `docs/closeout-summary.md` | Optional Governor |

**Do NOT** spawn Frontend until `design-spec.md` exists when user asked for Designer or strict pipeline (*"kita ga pakai designer?"* → **yes for website**).

## Prompt files

Persist under `<project>/.aic/prompts/` (not `/tmp`):

- `TASK-*-pm-investigate-v2.txt` — concise docs only, reduce Opus timeout risk
- `TASK-*-architect-plan.txt`, `TASK-*-designer-spec.txt`
- `TASK-*-frontend-impl.txt` — list `design-spec.md` as authoritative UX

## Pause / config change

1. `process.kill` active spawn; `pkill -f opencode run.*<project>`
2. Set workers `idle` via API
3. Resume after user saves OpenCode config and says *lanjut*

## Post-spawn verification

- Run `npm run build` in project for Implementation evidence
- If QA exit 0 but `verification-report.md` missing, **rerun** with tier **`crafter`** — see `references/qa-rerun-until-pass.md`
- Loop until `grep 'VERDICT: PASS' docs/verification-report.md` (*tetap rerun sampai done*)
- **REWORK** (e.g. Lighthouse): `vite preview` + `npx lighthouse`, `docs/lighthouse-evidence.txt`, rerun QA
- `pm-review.sh`: trust `VERDICT: PASS` in output; exit 1 may be `xargs` quote bug

## User handoff

*"buat sampai jadi, nanti ku cek"* — complete pipeline without skips; **no git commit** until user asks.

## Related

- `references/promo-landing-site-pattern.md`
- `dispatcher-discipline-aic` — QA evidence, Dispatcher never edits site code
---

## Source: `dispatcher-auth-reset.md`

# Dispatcher Auth Reset Pitfall

**Symptom:**
When moving the AIC environment (e.g., from PC to Server) or setting up a fresh project folder, API calls to `localhost:6868/api/agent-status` fail with `{"error":"Invalid API key"}` or `Missing API key`, even after the server starts. 

**Root Cause:**
The server uses a local `credentials.json` at `.aic/auth.json` (or `.aic/credentials.json`) that does not exist or has mismatched keys in the new environment. The server might be up, but the Dispatcher cannot authenticate to it.

**Fix Pattern (CLI):**
1. Stop the running server: `killall node`
2. Clear the stale `.aic` directory in the project folder: `rm -rf .aic`
3. Generate new credentials via the Node script directly (to avoid script wrapping issues):
   `node -e "const auth = require('/home/tvd/.hermes/skills/workflows/aic/scripts/auth.js'); const key = auth.addApiKey('system-dispatcher'); console.log('NEW_KEY=' + key);"`
4. Start the server again in the background.
5. Use that new key in the `X-API-Key` header for subsequent curl requests.
6. When sending status, ensure the `agent` property is included in the payload to avoid `{"error":"unknown agent: "}`:
   `-d '{"agent":"dispatcher", "status":"active", "message":"..."}'`

**Warning:** Generating credentials must happen BEFORE the server starts so the server picks up the correct API keys in its memory state.