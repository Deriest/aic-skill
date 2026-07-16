# Dashboard Consolidated

> **Consolidated from 16 files.** Originals archived in `references/archive/`.

**Original files merged:**
- `dashboard-config-fetch-models.md`
- `dashboard-config-provider-selection-pitfall.md`
- `dashboard-config-save-pitfall.md`
- `dashboard-config-ui-pitfalls.md`
- `dashboard-design-preferences.md`
- `dashboard-documentation-workflow.md`
- `dashboard-fix022-selfhost-pixel-font.md`
- `dashboard-implementation-pitfalls.md`
- `dashboard-operations-control-center.md`
- `dashboard-refactoring-pitfalls.md`
- `dashboard-regression-audit-post-runtime-stability.md`
- `dashboard-sizing-freeze.md`
- `dashboard-source-workflow.md`
- `dashboard-specification.md`
- `dashboard-theming-and-workflow.md`
- `dashboard-ui-rules.md`

---

---

## Source: `dashboard-config-fetch-models.md`

# Dashboard Config — Fetch Models

## Behavior (current)

- UI: `dashboard/src/pages/ConfigPage.tsx` → `fetchModels()` calls **`POST /api/models`** on the AIC server (same-origin; satisfies CSP `connect-src 'self'`).
- Server: `scripts/server.js` → `fetchUpstreamModelsJson(baseURL, apiKey)` proxies to `{baseURL}/models` (HTTP or HTTPS, follows redirects server-side).
- Config load: `GET /api/config` reads `.env` + `~/.config/opencode/opencode.jsonc`; populates `baseURL` / `apiKey` from provider `options`.

## Failure signature

| Message | Likely cause |
|---------|----------------|
| `Failed to fetch` (CSP) | Browser blocked direct proxy URL — use `/api/models` proxy (implemented) |
| `Failed to fetch` (other) | Server down, wrong baseURL, upstream timeout |
| `HTTP error! status: 401` | Wrong or empty API key in form state |
| `Response data is not an array` | Non–OpenAI-compatible JSON (expect `{ data: [{ id }] }`) |

## Verify split

1. **From AIC server host:** `curl -H "Authorization: Bearer $API_KEY" "$BASE_URL/models"` → if 200, proxy is fine.
2. **From browser:** FETCH MODELS must hit `/api/models` only — never widen CSP to arbitrary hosts.

## Deploy note

`dashboard/dist/` is gitignored. After pull: `cd dashboard && npm run build`, then `scripts/deploy.sh restart`.

## Operator quick start

```bash
bash scripts/deploy.sh start   # port 6868
curl -s http://127.0.0.1:6868/health
```

## Version on landing (related)

Do not use `SKILL.md` `version:` as product version on promo sites — use CHANGELOG / global tag (PM: **v3.1.3**). See `references/promo-landing-site-pattern.md`.
---

## Source: `dashboard-config-provider-selection-pitfall.md`

# Dashboard Config Provider Selection & API Key Pitfalls

## Provider Selection (Multiple Custom Providers)
**Symptom:** After configuring the provider (e.g., `AIC`) and saving in the Dashboard UI, the `baseURL` and `providerKey` revert to a different provider (e.g., `INTERCEPT` / `127.0.0.1`) upon dashboard restart or page refresh.
**Root Cause:** In `ConfigPage.tsx`, the `useEffect` config loader uses `Object.keys(customProviders).find(k => k !== 'openai' && k !== 'anthropic')`. This returns the *first* custom provider it encounters in `opencode.jsonc`. If a legacy or interceptor provider is at the top of the file, it will always be selected over the intended one.
**Fix:** Manually edit `~/.config/opencode/opencode.jsonc` via CLI to remove the conflicting/unused provider blocks (e.g., delete the `INTERCEPT` block) so only the intended provider remains.

## API Key Masking Save Bug
**Symptom:** Saving the configuration from the Dashboard UI results in "Invalid Credentials" or authentication failures. The `opencode.jsonc` file ends up with `"apiKey": "***"`.
**Root Cause:** The `API KEY` input in `ConfigPage.tsx` is masked and set to `readOnly={!showApiKey}` with a default display value of `***`. If the user hits "Save" without first clicking the reveal (`◎`) button to expose the actual key text, the literal string `***` is captured and saved.
**Fix/Workaround:** The user must explicitly click the eye/reveal button (`◎`) next to the API Key field to show the plain text key *before* clicking "Save". Alternatively, configure the API Key directly in `.env` and `opencode.jsonc` via CLI.
---

## Source: `dashboard-config-save-pitfall.md`

# Dashboard Config Save Pitfall

## The Issue
When saving configuration via the Dashboard Web UI (`ConfigPage.tsx`), two critical regressions occur:

1. **API Key literal `***` corruption**: The input field uses `value={showApiKey ? apiKey : '***'}`. If the user clicks "Save" without first revealing the API key (clicking the eye/reveal button), the literal string `***` is saved to `opencode.jsonc` and `.env`, breaking authentication and causing "Invalid Credentials" errors.
2. **Model Hardcoding Override**: The `handleSave` function reconstructs `opencodeObj` and forcefully injects `Opus`, `Sonnet`, and `Haiku` as the models for the `AIC` provider. This overwrites any custom models (e.g., `mimo/mimo-v2.5-pro`, `xai/grok-composer-2.5-fast`) the user had manually configured.

## Workaround
- **Always reveal the API key** (click the ◉ button) before hitting "Save" in the UI.
- To preserve custom models, configure `.env` and `~/.config/opencode/opencode.jsonc` directly via CLI rather than using the Dashboard UI.

## Required Fix (Pending)
- `ConfigPage.tsx`: Modify the input component to separate visual masking (`type="password"`) from the actual underlying `value` state. Do not use ternary `***` literal for the `value` prop.
- `ConfigPage.tsx`: Prevent `handleSave` from hardcoding the `models` dictionary; it should merge or preserve existing model configurations.
---

## Source: `dashboard-config-ui-pitfalls.md`

# Dashboard Config UI Pitfalls

## 1. API Key Overwritten with `***`
**Symptom:** After saving configuration via the Dashboard UI (`ConfigPage.tsx`), API requests fail with authentication errors (e.g., "Invalid Credentials"). Checking `opencode.jsonc` shows `"apiKey": "***"`.
**Root Cause:** The API Key input field is `readOnly` by default when the text is masked (dots/asterisks). If the user edits the config and clicks SAVE *without* clicking the reveal eye icon (`◎`) to unmask the text, the form submits the literal masked string `***`.
**Fix/Workaround:** Always click the reveal icon (`◎`) so the actual key is visible before clicking SAVE. Alternatively, edit `opencode.jsonc` and `.env` directly via CLI.

## 2. BaseURL and Provider reset to `INTERCEPT` / `127.0.0.1`
**Symptom:** Dashboard keeps reverting to `baseURL: 127.0.0.1:9991` and `provider: INTERCEPT`, ignoring the saved `AIC` proxy.
**Root Cause:** `ConfigPage.tsx` determines the active provider by selecting the *first* custom key it finds in `opencode.jsonc` (excluding `openai` and `anthropic`). If an old `INTERCEPT` block is positioned at the top of the JSON file, the dashboard will always select it over `AIC` on page load.
**Fix:** Remove the `INTERCEPT` provider block entirely from `~/.config/opencode/opencode.jsonc` so that `AIC` becomes the first and only custom provider.
---

## Source: `dashboard-design-preferences.md`

# Dashboard Design Preferences

## Constraints
When modifying the AIC Dashboard (`OverviewPage.tsx`, `PipelineTracker.tsx`, etc.), observe these strict layout rules that the user prefers and has explicitly confirmed.

### Sizing & Viewport
- **Strictly 100vh**: The dashboard MUST fit exactly within one desktop viewport (`h-screen overflow-hidden`).
- **Never Scroll**: The Virtual Office area (`OfficeFloor`) must never scroll. Content must compress or scale. The only element permitted to have internal scrolling is the Runtime Log (`overflow-y-auto`).
- **Fixed Component Heights**: 
  - `Current Task Card` must be strictly `h-[240px] shrink-0`.
  - `Pipeline Card` and `Runtime Gate Card` must be alongside each other, firmly locked at `h-[240px] shrink-0`.
  - `Worker Statistics` (the 3 cards for Working/Complete/Idle) must be `h-[150px] shrink-0`.
  - The decorative image (`AIC.png`) sits at the bottom, locked at `h-[180px] shrink-0 mt-auto mb-[50px]`.
  - `Virtual Office` container locked at `h-[94.5%]`.

### Organization & Aesthetics
- **No Decorative Titles**: Do not add unnecessary highlighted/colored generic section titles (e.g. "VIRTUAL OFFICE" with yellow styling). Match existing un-styled generic headers.
- **Worker Desk Hierarchy**: Enforce pixel-perfect strict hierarchy. The height per sub-area is fixed (`h-[160px]` total, card width `w-[175px]`):
  1. Character & Monitor (`h-[60px]`)
  2. Desk (`w-[150px] h-[36px]`) — desk is narrower than card
  3. Status Badge (inside desk surface, not below)
  4. Worker Info (`h-[28px]`)
  5. Actions (`h-[20px]`)
- **Status Bubble Format**: The `StatusBubble` must be a flat `rounded` rectangle, NEVER `rounded-full` or pill-shaped. It must perfectly match the corner radii of action buttons. Status `IDLE` must have `text-white` with a grey background. Each status has its own neon glow via `shadow-[0_0_5px_rgba(...)]` matching the border color.
- **Button Formatting**: The operational buttons (`DELEGATE`, `OPENCODE`) must be uppercase, background black, text white, with neon yellow borders. "OPENCODE" must be a single word without spaces. Button width `w-[80px]`.
- **Action Conditions**: Operational buttons render ONLY if `status === 'working'`. Hide them completely otherwise (do not render as disabled placeholders). The action area height (`h-[20px]`) is always reserved to prevent layout shift.
- **No Phase Duplication**: Pipeline tracks phases. Never duplicate the current phase text inside the Virtual Office or Current Task title area.
- **Department Sections (User Override)**: The user explicitly overrode the flat 5-5-5 layout to show department section labels (Leadership=2, Product=4, Engineering=5, Platform=4) with worker counts. This is a deliberate visual choice. When user asks to "see" a layout, comply without modifying specs.
- **Animations**: `animate-pulse-slow` must be standard. Keyframe: 3s cycle, opacity 1.0 → 0.4 → 1.0 (user found 0.8 too subtle).
- **CRT Overlay**: Use WHITE scanlines (`rgba(255,255,255,1)` at `opacity-[0.03]`) on dark backgrounds — black scanlines are invisible. Add radial vignette for CRT edge effect.

---

## Source: `dashboard-documentation-workflow.md`

# Dashboard Documentation Workflow

Deprecated — dashboard is Vite + React source in `dashboard/src/` with self-hosted font. See `references/dashboard-fix022-selfhost-pixel-font.md` and `docs/architecture/architecture-overview.md`.

---

## Source: `dashboard-fix022-selfhost-pixel-font.md`

# FIX-022 — Self-host Press Start 2P (dashboard)

## Symptom

Dashboard looks like smooth system monospace, not pixel bitmap. DevTools **computed** `font-family` shows `"Press Start 2P", monospace` but **Rendered fonts** is Menlo/Consolas.

## Root cause

Dashboard served from AIC `server.js` (`:6868`) uses CSP:

`style-src 'self' 'unsafe-inline'` — no `fonts.googleapis.com` / `fonts.gstatic.com`.

Google Fonts links in `index.html` do not load webfont files (`gstatic` requests = 0). Browser uses **monospace fallback** while still reporting Press Start 2P in computed style.

**Do not relax CSP** as the default fix — self-host under `font-src 'self'`.

## Fix (shipped pattern)

1. Download official TTF → `dashboard/public/fonts/PressStart2P-Regular.ttf` (Vite copies to `dist/fonts/` on build).
2. `dashboard/src/index.css`:

```css
@font-face {
  font-family: 'Press Start 2P';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/PressStart2P-Regular.ttf') format('truetype');
}
```

3. Remove Google Fonts `<link>` / preconnect from `dashboard/index.html`.
4. Remove `antialiased` from `body` `@apply` in `index.css` — pixel glyphs should render crisp (`webkitFontSmoothing: auto`).

Keep Tailwind `font-pixel` and family name **Press Start 2P** unchanged.

## Verify

- Network: **0** requests to `googleapis` / `gstatic`.
- Network: `PressStart2P-Regular.ttf` from same origin (`/fonts/...`, ~115KB).
- Ad-hoc: `OK_FIX022_SELFHOST_FONT` script (dist font exists, no googleapis in html, no antialiased on body, `npm run build`).
- Hard refresh after rebuild (`Ctrl+Shift+R`).

## Related

- `references/dashboard-regression-audit-post-runtime-stability.md` — p99 / cumulative task / font investigation
- `references/ui-theming-rules.md` — `font-body` undefined in Tailwind (class is no-op; inherits body)

## Milestone

Dashboard UI only — **not** Runtime Stability bundle (`45b04e8` excluded `dashboard/**`).
---

## Source: `dashboard-implementation-pitfalls.md`

# Dashboard Implementation Pitfalls

## Critical Pitfalls

### 1. Iterative Redesign Without Frozen Docs
**Symptom:** Multiple UI revisions in one session, each undoing the previous.
**Root cause:** Implementation started before documentation was complete.
**Fix:** ALWAYS complete ADR → SPEC → UX SPEC → CHANGESET → PLAN → PM REVIEW before writing any dashboard code.

### 2. Worker Count Mismatch
**Symptom:** Dashboard shows 10 workers, runtime expects 15.
**Root cause:** `workers.ts` not synchronized with `WORKER-REGISTRY.md`.
**Fix:** Always compare `workers.ts` against `spawn-worker.sh` PHASE_MAP and SPEC-001 Worker Dependency Matrix.

### 3. Phase Label Duplication
**Symptom:** Phase shown in both Virtual Office header AND Pipeline panel.
**Root cause:** Current Task card includes phase info that belongs in Pipeline only.
**Fix:** Header = `[TASK-XXX] Title` only. Phase = Pipeline panel only.

### 4. Generic Runtime Gate Labels
**Symptom:** Runtime Gate shows "Execution" or "Worker Executing" with no context.
**Root cause:** Gate panel not binding to actual runtime fields.
**Fix:** Gate must show: type, owner, waiting for, barrier progress, PM review, elapsed timer, next action.

### 5. Missing Waiting PM Review State
**Symptom:** Worker shows "complete" while PM review is still active for that phase.
**Root cause:** Worker state not derived from `pmReview.phase`.
**Fix:** `if (status === 'complete' && pmReview?.phase === worker.phase) → waiting_pm`

### 6. Sub-workers Appearing as Worker Cards
**Symptom:** Dashboard creates new desk cards for sub-workers.
**Root cause:** Sub-worker list rendered as additional Virtual Office entries.
**Fix:** Sub-workers = contextual info on Head Worker card (count, expandable list). Never new cards.

### 7. Section Labels in Virtual Office
**Symptom:** "Leadership", "Product", "Engineering" labels visible in Virtual Office.
**Root cause:** `groupWorkersBySection()` used with section headers.
**Fix:** Flat 5-5-5 layout. No section labels. Organization exists in documentation only.

### 8. Progress Bar Calculation Error
**Symptom:** Progress shows wrong percentage or hardcoded value.
**Root cause:** Using `Object.values(state.workers)` instead of `WORKERS` array.
**Fix:** `WORKERS.filter(w => w.phase !== 'Global')` for total, filter by `status === 'complete'` for done.

### 9. Pipeline and Runtime Gate Merged Into One Card
**Symptom:** Pipeline and Runtime Gate share a single card container.
**Root cause:** Combined into one panel to save space.
**Fix:** ALWAYS separate into two independent cards. Pipeline = lifecycle only. Runtime Gate = runtime info only. They are different components with different responsibilities.

### 10. Reserved Empty Action Buttons
**Symptom:** Delegate/OpenCode buttons visible on idle or complete workers.
**Root cause:** Buttons reserved for "future use" regardless of state.
**Fix:** Dispatcher shows "Delegate" ONLY when status=working. All other workers show "OpenCode" ONLY when status=working. Hide action row completely when not working. No reserved empty buttons.

### 17. Card Height Alignment (Flex vs Grid)
**Symptom:** Cards side-by-side (like Pipeline and Runtime Gate) have unequal heights when content length differs, even with `flex-1`.
**Root cause:** Dynamic content pushes `justify-between` boundaries in flex layouts.
**Fix:** Use a CSS grid (`grid grid-cols-2`) wrapper with a fixed height (e.g., `h-[160px]`), and set the inner cards to `h-full` or the same fixed height to stretch equally.

### 18. Title Container Height Sync
**Symptom:** Two adjacent cards are misaligned at the bottom despite grid wrapping.
**Root cause:** Titles above the cards have different line counts or text sizes, shifting the cards below.
**Fix:** Give title wrappers an explicit, identical fixed height (e.g. `h-[28px]`).

### 11. Progress Bar in Wrong Location
**Symptom:** Progress bar placed in Virtual Office header or as separate component.
**Root cause:** Header treated as generic container.
**Fix:** Progress bar = right-aligned in Current Task header row. Same horizontal line as "CURRENT TASK" title. Compact: `w-20 h-1.5` bar + percentage label.

### 12. Runtime Gate Gap Between PM and Next
**Symptom:** Large empty space between PM Review row and Next Action row.
**Root cause:** `mt-auto` on Next row pushes it to bottom of card.
**Fix:** Remove `mt-auto`. Next row = `pt-0.5 border-t border-aic-border/20` directly below PM row. Compact spacing.

### 13. Worker Card Info Hierarchy Wrong
**Symptom:** Worker name, role, or actions in wrong order or missing.
**Root cause:** No defined hierarchy.
**Fix:** Hierarchy = Sprite → Status Bubble → Name → Role → Sub-worker count → Action button. Action button at bottom, only when working.

### 14. Layout Flex Squashing vs Fixed Lock
**Symptom:** Critical operational panels shrink or get clipped when other content expands.
**Root cause:** Using `flex-1` or percentage heights in a 100vh layout for panels that require stable legibility.
**Fix:** Lock critical panel heights with fixed pixels and `shrink-0` (e.g. `h-[240px] shrink-0`, `h-[150px] shrink-0`). Push non-critical/decorative content to the bottom using `mt-auto`. See `references/dashboard-sizing-freeze.md`.

### 15. CRT / Overlay Mixing in Dark Mode
**Symptom:** Scanlines or CRT overlays are completely invisible.
**Root cause:** Using `mix-blend-overlay` over deep dark backgrounds (`bg-[#0d0d1e]`) hides dark/black lines entirely.
**Fix:** Render scanlines explicitly as low-opacity white (`rgba(255, 255, 255, 1)` at `opacity-[0.03]`) combined with radial gradient vignetting instead of attempting dark blend modes.

### 16. Server Backgrounding Pitfalls
**Symptom:** Terminal tool exits with "Foreground command uses '&' backgrounding" error.
**Root cause:** Trying to run a long-lived server process (like `node server.js &`) in a standard foreground terminal tool call.
**Fix:** Always use `terminal(background=true, notify_on_complete=false)` with a `watch_patterns` check for long-lived processes. Wait for the server-ready message before continuing.

## Workflow Lessons

### User Communication During UI Refinement
- User gives visual instructions in Indonesian. "tulisan pipeline di atas card" = move title above card. "space nya di kurangin" = reduce spacing. "di naikan" = move up. Don't over-interpret.
- User says "coba" (try) = experiment with a value. If they follow with "saja saya lebih suka" = that's the final value.
- Don't produce lengthy reports for simple UI tweaks. Just implement, verify build, confirm in 1-2 lines.
- When user says "revisi satu persatu" = change one thing at a time, verify, then move to next.

### Build Verification is Mandatory After EVERY Change
```bash
cd /home/tvd/.hermes/skills/workflows/aic/dashboard && npm run build 2>&1 | tail -1
```
Run this after EVERY file modification. Don't batch multiple changes and hope.

### Preferred Sizing Values (User-Approved)
- Virtual Office: `h-[94.5%]` (user iterated through 75→80→90→93→94→94.5%)
- Pipeline + Runtime Gate: `h-[240px] shrink-0` (locked)
- Current Task: `h-[240px] shrink-0` (locked)
- Stats cards: `h-[150px] shrink-0` with `text-4xl` values, `text-[11px]` labels (locked)
- Decorative Image (AIC.png): `h-[180px] shrink-0 mt-auto mb-[50px]` (locked)
- Pipeline text: `text-base` (16px), `tracking-wider`, `py-1.5 px-1.5` padding
- Worker cards: `w-[175px] h-[160px]` (card), desk surface `w-[150px] h-[36px]` (locked)
- Pulse animation: 3s cycle, opacity 1.0→0.4→1.0 (user found 0.8 too subtle)
- StatusBubble: `rounded` (not `rounded-full`), neon glow per status, idle text white
- Action buttons: `w-[80px]`, black bg, white text, neon yellow border, only when working
- CRT overlay: white scanlines at 3% opacity (black invisible on dark bg)

### Stats Cards Must Be Inside Same Flex Container as Pipeline
Place stats cards inside the same `<div className="flex-1 min-h-0 flex flex-col">` as PipelineTracker, with only `mt-2` gap. This eliminates the empty space between Pipeline/Gate and stats.

### Documentation-First Saves Time
The session spent ~80% on documentation and ~20% on implementation. This is correct. Without frozen docs, every implementation attempt gets undone by the next requirement change.

### KEEP → EXTEND → INTEGRATE
Never rewrite working components. Preserve existing animations, SSE subscriptions, runtime bindings. Only add new capabilities on top.

### Worker Registry is Source of Truth
`WORKER-REGISTRY.md` defines the canonical 15 workers. Every component (workers.ts, CostsPage, spawn-worker.sh) must align with it.

---

## Source: `dashboard-operations-control-center.md`

# Dashboard Operations Control Center — IMP-001 Patterns

> **Related:** `references/layout-foundation.md` (IMP-002), `references/polling-consolidation.md` (FIX-003)

## Dispatcher State Machine

**NEVER show "Idle" or "Complete" for dispatcher state.**

Frontend mapping (PipelineTracker.tsx gate logic):
- No currentTask → **ONLINE** (green)
- Rework active → **RECOVERING** (red)
- PM Review + rework verdicts → **RECOVERING** (red)
- PM Review pending → **WAITING APPROVAL** (yellow)
- Runtime Gate blocked → **RECOVERING** (red)
- Phase Barrier active + incomplete → **MONITORING** (yellow)
- Active workers → **DISPATCHING** (cyan)
- Phase executing → **MONITORING** (yellow)
- Default fallback → **ONLINE** (green)

Source: `state.workers?.dispatcher?.status` from backend + frontend context.

## Runtime Timer (RUNTIME GATE header)

**NEVER use `state.startedAt`, `/health` uptime, or engine uptime** — those are server/process clocks.

Implementation: `TaskRuntimeTimer` in `PipelineTracker.tsx` + `dashboard/src/utils/taskTimer.ts`.

| State | Display |
|-------|---------|
| `currentTask === null` | `00:00:00` |
| Task running | `now - startedAt`, tick every 1s |
| Terminal (`COMPLETE`, `BLOCKED`, `failed`, `cancelled`) | **Frozen** at `finishedAt - startedAt` |

**Task timestamps (no Runtime API change):** poll existing public `GET /api/tasks/:id` — `context.createdAt` → `startedAtMs`; `state.lastActivity` (or `finishedAt`) → freeze end. Re-fetch when `task.id` or terminal fields change so dashboard refresh restores correct elapsed/frozen value.

Pitfall (pre-2026-07-14): fallback `state.startedAt` made the gate timer look like **server uptime** after restart.

Pitfall: `currentTask` on `/api/status` does **not** include `startedAt` — do not assume task fields on status payload alone.

## Performance Panel

Replaces the static AIC.png image. **Single-column vertical layout** (`flex flex-col`). Live data from `/api/metrics/summary` (polls every 5s):

| Metric | API Path | Display | Color |
|--------|----------|---------|-------|
| RSS | `memory.rss` | `{Math.round(rss/1048576)} MB` | yellow |
| Heap | `memory.heapUsed` | `{Math.round(heap/1048576)} MB` | yellow |
| Load 1m | `cpu.loadAvg[0]` | `toFixed(2)` | cyan |
| Load 5m | `cpu.loadAvg[1]` | `toFixed(2)` | cyan |
| Cores | `cpu.cores` | direct | white |
| Total Requests | `totalRequests` | direct | green |
| Total Input | `totalInput` | `{Math.round(total/1000)}k` | green |
| Total Output | `totalOutput` | `{Math.round(total/1000)}k` | green |

**Title "PERFORMANCE"** renders ABOVE the card (not inside it). Pattern: `▶ PERFORMANCE` heading in a wrapper div, then the `bg-aic-bg-panel` card below.

No backend changes required — all data already exposed via existing endpoints.

## Right Panel Order (top to bottom)

1. **Pipeline & Runtime Gate** — `flex-none`, shared container
2. **PERFORMANCE** — single-column metric list
3. **STATUS** — 4-column grid with `mt-1` spacing above

## Layout Ratios (Updated: IMP-002)

| Section | Value |
|---------|-------|
| Virtual Office (left) | `flex-[1.5] min-h-0` (no `h-full`, no `h-[94%]`) |
| Right panel | `flex-1 min-h-0` |
| Office height | `flex-1 min-h-0` (natural flex, no magic %) |
| Current Task card | `h-[250px]` |
| PipelineTracker cards | `h-[180px]` each, `h-[215px]` container |
| STATUS cards | `h-[140px]` fixed |

**Layout foundation**: Viewport chain = `html/body/#root` all `height:100%; overflow:hidden`. App root = `h-screen`. OverviewPage = `flex-1 min-h-0` (NOT `h-screen`). See `references/layout-foundation.md` for full patterns.

**Right panel scroll**: Wrapped in `ScrollContainer` with CSS scroll shadows. All panels inside use `shrink-0`.

## Polling Architecture (FIX-003)

**Single source per endpoint.** All polling lives in `DashboardProvider`:

| Endpoint | Interval | Consumer |
|----------|----------|----------|
| `/api/status` | 5s | `dispatch(SET_STATE)` → React Context |
| `/api/metrics/summary` | 5s | `setMetrics()` → React Context `metrics` |

Components read from context — no independent `fetch` calls. `PerfPanel` reads `useDashboardContext().metrics`. 

**Deleted hooks:** `useStatusPolling.ts` (merged into provider), `useDashboardState.ts` (duplicate poller).

**Anti-pattern:** Multiple components polling the same endpoint independently causes HTTP 429. Always consolidate into a single provider/context.

**MetricsState shape:**
```typescript
interface MetricsState {
  memory?: { rss: number; heapUsed: number; heapTotal: number };
  cpu?: { loadAvg: number[]; cores: number };
  totalRequests?: number;
  totalInput?: number;
  totalOutput?: number;
}
```

## Dispatcher Status (WorkerGrid Override)

**When server is connected, dispatcher ALWAYS shows `working` status.** Override in WorkerGrid.tsx:

```typescript
if (worker.id === 'dispatcher' && state.connected) uiStatus = 'working';
```

This applies to both the card rendering and the OverviewPage stats counter. Backend may return `idle` for dispatcher — the frontend override ensures the card always shows yellow WORKING theme when the server is live.

DELEGATE badge renders when `worker.id === 'dispatcher' && status === 'working'`.

## Worker Summary Cards (STATUS section)

4-column grid, fixed `h-[100px]` per card:
- WORKING (yellow) — with progress bar
- COMPLETE (green) — with progress bar
- IDLE (gray)
- TOTAL (white)

Title "▶ STATUS" above the grid. Data: `WORKERS.filter()` based on `state.workers[w.id].status` (with dispatcher override to always count as working when connected).

## Spacing Rules

- Parent flex container has NO `gap` — spacing is per-section via `mt-*` / `mb-*`
- Pipeline/Runtime Gate container: shared, `grid grid-cols-2` for equal card heights
- Between PERFORMANCE and STATUS: `mt-2` (8px)
- STATUS title `mb-1` above cards
- Right panel: no parent `gap` — all spacing is explicit per-section
- All right-panel sections use `shrink-0` inside `ScrollContainer`

---

## Source: `dashboard-refactoring-pitfalls.md`

# Dashboard Refactoring Pitfalls

## 1. Modifying Layout Structure vs Modifying Styling

When asked to move a UI component (like the Worker Statistics Panel) from one container to another:
- Do **NOT** rely solely on changing flexbox properties (`flex-col`, `order-`) if the goal is to physically relocate a component across major structural sections (e.g., from the Left Main Content to the Right Sidebar).
- Cut and paste the component's JSX block into the target parent container.
- Run an ad-hoc Node/bash verification script to parse the TSX code using Regex (`content.match()`) to definitively confirm the DOM hierarchy matches the requested relocation before building.

## 2. Dynamic Component Registration (Hardcoded Arrays)

When adding new elements that depend on a predefined array (like `WORKERS` and `WORKER_NAMES`):
- Ensure that *all* dependent arrays, mappings, or hardcoded dictionaries across the application (e.g., `CostsPage.tsx`, `OverviewPage.tsx`, `data/workers.ts`) are updated simultaneously.
- If a new worker is added to the backend API but omitted from a frontend metrics mapping dictionary, it will silently drop from specific dashboard views.
- **Verification Rule:** Write a quick script that extracts keys from the Source of Truth (`data/workers.ts`) and asserts their existence in the dependent view files before compiling.

## 3. Asymmetric Dashboard Layouts

When replacing symmetric grids (`grid-cols-2`) with asymmetric layouts (e.g., 60% / 40% splits):
- Use Tailwind CSS responsive flex classes (`flex flex-col md:flex-row`).
- Assign specific proportional widths to the child containers (e.g., `md:w-3/5` and `md:w-2/5`).
- Remove the old `grid` wrapper entirely to prevent CSS conflicts.

## 4. State Cleanup on Reload (Stale State Injection)

If the dashboard relies on a `state.json` written by the backend API:
- Stale objects (like a renamed worker role, e.g., `researcher` -> `research`) may persist in the state file if the backend merely merges the file at startup.
- This causes the dashboard to render ghost objects (e.g., showing 16 total agents instead of 15).
- **Fix:** The backend API's state-loading function must explicitly filter out keys from the JSON object that are no longer defined in the source-of-truth constants array before serving the state to the frontend.

## 5. False Positives in Health Monitoring

If a script uses `pgrep -f "node.*server.js"` to verify the API server is alive:
- It may falsely match unrelated processes running on the machine (e.g., `tsserver.js` for TypeScript Language Server).
- **Fix:** Verify active network ports (`ss -tlnp | grep 6868`) or hit the health endpoint directly (`curl -sf http://localhost:6868/health`) rather than relying on broad process string matching.

## 6. "Working" Status Derivation (Sub-worker Sync)
The dashboard needs to show a worker as "Working" (yellow) if the Head Worker is working OR if any of its sub-workers are working.
- **Bug:** Using `Object.values(state.workers)` to map rendering fails when trying to access `.phase` or `.id` because `state.workers` only contains the status payload, not the worker metadata constants.
- **Fix:** Always map over `WORKERS` (from `data/workers.ts`) and use `w.id` to look up the runtime state:
  ```typescript
  const ws = state.workers?.[w.id];
  const isWorking = ws?.status === 'working' || ws?.subWorkers?.some(s => s.status === 'working');
  ```

## 7. Waiting PM Review Derivation
A worker must only show "WAITING PM REVIEW" if it has completed execution, but the PM review for that phase is still pending.
- **Fix:**
  ```typescript
  const isWaitingPM = ws?.status === 'complete' && state.pmReview?.phase === w.phase && !state.rework?.failedWorkers?.includes(w.id);
  ```

## 8. Complete Status Calculation
A worker is only truly "Complete" if its own status is complete AND all its sub-workers are complete AND the PM Review phase has advanced past it.
- **Fix:**
  ```typescript
  const isComplete = ws?.status === 'complete' && (!ws?.subWorkers || ws.subWorkers.every(s => s.status === 'complete')) && state.pmReview?.phase !== w.phase;
  ```

## 9. Layout: Flex vs Fixed Height in 100vh
When trying to make the left column (Virtual Office) and right column (Pipeline + Gate) equal height within a 100vh viewport (`h-screen overflow-hidden`), using `h-[XX%]` can cause layout drift. 
- **Fix:** Use `flex-1 min-h-0` on container wrappers, and allocate exact heights (`h-[240px]`) with `shrink-0` to the specific cards you want hard-locked. If filling remaining space with a decorative image, use `flex-1 min-h-0` or `mt-auto` on the image wrapper so it absorbs the slack without overflowing the page.

## 10. Action Buttons (Reserved Space)
When reserving space for future action buttons ("Delegate", "OpenCode") in a worker card, do not show disabled/grey buttons when the worker is idle or complete. It clutters the UI.
- **Fix:** Only render the buttons conditionally when `status === 'working'`. Wait for the status to change before revealing the actions.

## 11. UI Sizing Hard-Freezes
During the AIC dashboard development, the following fixed sizing constraints became permanent. Do **not** modify them to "improve" responsive behavior without an explicit SPEC review.

| Component | Target CSS Constraint |
| --- | --- |
| Current Task Card | `h-[240px] shrink-0` |
| Pipeline Card | `h-[240px] shrink-0` |
| Runtime Gate Card | `h-[240px] shrink-0` |
| Worker Statistics | `h-[150px] shrink-0` |
| Image Overlay (`AIC.png`) | `h-[180px] shrink-0 mt-auto mb-[50px]` |
| Virtual Office Box | `h-[94.5%]` |

## 12. JSX Nesting
When patching files with regex (`sed`) or targeted patches:
- Missing closing divs `</div>` frequently break the build.
- Rather than a multi-pass regex sequence, sometimes a full component rewrite is significantly safer for complex React tree structures.

---

## Source: `dashboard-regression-audit-post-runtime-stability.md`

# Dashboard regression audit — after Runtime Stability commit (45b04e8)

Runtime bundle **excluded** `dashboard/**`. UI drift vs IMP-001 baseline is **uncommitted local work** + **persisted runtime state**, not FIX-008–021.

## Uncommitted dashboard files (separate UI commit)

| File | Change | Milestone |
|------|--------|-----------|
| `DashboardContext.tsx` | `MetricsState.latency.sli`, `total` | Dashboard Observability |
| `OverviewPage.tsx` | API p99, Err budget left, `metrics.total` fallback | Dashboard Observability |
| `types/index.ts` | `pipelineState`/`phaseStatus` on task, `engine`, `failed`, `leaseId` | UI parity with engine |

**Not required for Runtime Stability.** Runtime does not break if excluded.

## “Current task feels cumulative”

- **CURRENT TASK** panel = single `state.currentTask` from `/api/status` (not task history).
- Commit **`3bc022d`**: persist last task when pipeline stops.
- Engine clears `currentTask` only on **COMPLETE**; **failed/BLOCKED** tasks remain visible while idle.
- Workers in `.aic/state.json` may still show old `currentTask` ids — office looks “stacked.”
- **Total Requests** in PERFORMANCE = lifetime `metrics.json` count — cumulative by design, not per-task.

## Performance panel scope creep

- Baseline IMP-001/FIX-003 (`692aefd`): RSS, heap, load, cores, totalRequests/Input/Output only.
- **p99 / error budget** rows: **uncommitted** UI; data from **`summary.latency`** already returned by `server.js` (45b04e8) — backend adjacent, not user-requested dashboard scope.

## Font regression (investigation)

- Intended: **Press Start 2P** via Google Fonts + `font-pixel`.
- Not changed in 45b04e8. Perceived drift: `body { antialiased }`, undefined Tailwind `font-body` on `App.tsx`/`HistoryPage`, CDN/cache miss → monospace fallback.

## Minimal corrective actions (dashboard milestone)

1. ~~Revert or isolate observability rows until approved.~~ **Done** (2026-07-14): p99 + error budget rows removed from `OverviewPage.tsx`; PERFORMANCE restored to 7-row baseline. Data still in API/polling for future observability pages.
2. Label **LAST TASK** or clear UI when `pipelineRunning === false` + terminal `phaseStatus` (UI-only ok).
3. Rebuild `dashboard/dist` after source decisions.
4. ~~Font: drop `antialiased` on pixel body; define `fontFamily.body` or use `font-pixel` consistently.~~ **Done** (2026-07-14): FIX-022 self-hosted Press Start 2P, removed `antialiased`, removed Google Fonts CDN. See `references/dashboard-fix022-selfhost-pixel-font.md`.

## Related

- `references/dashboard-operations-control-center.md` — PERFORMANCE baseline + timer
- `references/polling-consolidation.md` — metrics provider
---

## Source: `dashboard-sizing-freeze.md`

# Dashboard Sizing Freeze & Layout Rules

## Locked Component Heights

The following component dimensions in the Right Sidebar (Overview Page) are strictly locked. No future implementation may modify these values.

| Component | Container | Dimensions | CSS Class |
|-----------|-----------|------------|-----------|
| **Worker Card** | `WorkerDesk.tsx` | `175px × 160px` | `w-[175px] h-[160px]` |
| **Worker Desk Surface** | `WorkerDesk.tsx` | `150px × 36px` | `w-[150px] h-[36px]` |
| **Virtual Office** | `OverviewPage.tsx` | `94.5%` height | `h-[94.5%]` |
| **Current Task Card** | `PipelineTracker.tsx` | Fixed `240px` | `h-[240px] shrink-0` |
| **Pipeline Card** | `PipelineTracker.tsx` | Fixed `240px` | `h-[240px] shrink-0` |
| **Runtime Gate Card** | `PipelineTracker.tsx` | Fixed `240px` | `h-[240px] shrink-0` |
| **Worker Statistics** (Working, Complete, Idle) | `OverviewPage.tsx` | Fixed `150px` | `h-[150px] shrink-0` |
| **Decorative Image** (`AIC.png`) | `OverviewPage.tsx` | Fixed `180px` | `h-[180px] shrink-0 mt-auto mb-[50px]` |

## Layout Justification

- **`shrink-0` Enforcement:** This guarantees that none of the target panels will be arbitrarily squashed by flexbox mechanics if content inside them grows.
- **Fixed Values vs Percentages:** Fixed pixel heights ensure stable legibility across all desktop aspect ratios, avoiding unexpected UI shifts.
- **`mt-auto mb-[50px]` Spacer:** The `mt-auto` helper on the bottom image element ensures that any remaining empty vertical space in the Right Column pushes the decorative image firmly to the bottom, without expanding or shrinking the locked operational panels. The `mb-[50px]` lifts it from the bottom edge.

## Enforcement Policy

Any future pull request, ticket, or implementation instruction attempting to alter `h-[240px]` on the operational panels or `h-[150px]` on the stat cards MUST be rejected outright, pending explicit PM override.

---

## Source: `dashboard-source-workflow.md`

# Dashboard Source Development Workflow

## Source Location

Dashboard source code lives in `dashboard/src/` (NOT compiled-only).

## Component Structure

```
dashboard/src/
├── App.tsx                          # Router
├── main.tsx                         # Entry point
├── index.css                        # Global styles
├── context/
│   └── DashboardContext.tsx          # State management (useReducer)
├── data/
│   └── workers.ts                   # Worker registry (15 workers)
├── types/                           # TypeScript types
├── pages/
│   ├── OverviewPage.tsx             # Main dashboard (Office + Pipeline + Stats)
│   ├── HistoryPage.tsx              # Task history
│   ├── CostsPage.tsx                # Token costs
│   └── ConfigPage.tsx               # Configuration
├── components/
│   ├── office/                      # Virtual Office
│   │   ├── OfficeFloor.tsx          # Office container
│   │   ├── WorkerGrid.tsx           # 5-5-5 worker grid
│   │   ├── WorkerDesk.tsx           # Individual worker card
│   │   ├── DeskComputer.tsx         # Worker computer visual
│   │   └── StatusBubble.tsx         # Status indicator
│   ├── new_layout/                  # Pipeline & Runtime Gate
│   │   ├── PipelineTracker.tsx      # Pipeline phases + Runtime Gate + ElapsedTimer
│   │   └── WorkspaceScene.tsx       # Workspace scene
│   ├── shared/                      # Reusable components
│   │   ├── MetricCard.tsx           # Metric display card
│   │   ├── DataTable.tsx            # Data table
│   │   ├── EmptyState.tsx           # Empty state placeholder
│   │   ├── ErrorBoundary.tsx        # Error boundary
│   │   └── PageShell.tsx            # Page wrapper
│   └── layout/                      # Layout components
│       ├── DashboardLayout.tsx      # Main layout
│       ├── CRTOverlay.tsx           # CRT scanline effect
│       ├── ConnectionIndicator.tsx   # Connection status
│       └── FloatingParticles.tsx    # Particle effect
```

## Build Process

```bash
cd dashboard && npm run build
```

Output: `dashboard/dist/` (served by server.js at `http://localhost:6868`)

## Key Layout Ratios (OverviewPage)

- Left (Virtual Office): `flex-[1.5]`
- Right (Pipeline + Stats + Performance): `flex-1`
- PipelineTracker: two panels at `h-[190px]` each
- Worker Summary: `grid grid-cols-4`
- Performance Panel: live data from `/api/metrics/summary`

## State Flow

```
DashboardContext (useReducer)
  → SET_STATE action (from SSE /api/events)
  → state.workers, state.currentTask, state.currentPhase
  → OverviewPage reads state
  → PipelineTracker, WorkerGrid, PerfPanel consume state
```

## API Endpoints Used

| Endpoint | Used By | Data |
|----------|---------|------|
| `/api/status` | DashboardContext (SSE) | Workers, task, phase |
| `/api/metrics/summary` | PerfPanel | CPU, memory, load |
| `/api/metrics` | CostsPage | Token usage, cost |
| `/api/tasks` | HistoryPage | Task history |
| `/api/config` | ConfigPage | Runtime config |
| `/api/pipeline/status` | PipelineTracker | Phase state |

## Pitfalls

### Tailwind Config
NEVER overwrite `tailwind.config.js`. Use `patch` to add entries only. Existing config has custom `aic` colors, `pixel` font, `fontSize` tokens.

### Fixed Heights
PipelineTracker panels use fixed `h-[190px]`. When adjusting, ensure total right column fits in viewport (100vh). Too tall = Performance panel cut off at bottom.

### Performance Panel Data
`/api/metrics/summary` returns flat object: `{memory: {rss, heapUsed}, cpu: {loadAvg, cores}}`. The full `/api/metrics` returns `{metrics, summary}` with cost in `summary.cost`. Use `/api/metrics/summary` for live perf panel (simpler shape).

---

## Source: `dashboard-specification.md`

# Dashboard Specification v1.0

**Status:** OFFICIAL BASELINE
**Authority:** ADR-002, Dashboard Specification Freeze

---

## Philosophy

Dashboard is an **observability layer** — NOT a control center.
- Displays runtime state
- Never owns business logic
- Never controls execution
- Never computes scheduler state
- Consumes `server.js` API as Single Source of Truth

## Information Hierarchy

| Priority | Panel | Question Answered |
|----------|-------|-------------------|
| 1 | Virtual Office | Who is working? |
| 2 | Current Task | What is being executed? |
| 3 | Pipeline | Which lifecycle phase is active? |
| 4 | Runtime Gate | Why hasn't execution advanced? |
| 5 | Worker Statistics | What is workforce status? |

## Layout

```
┌──────────────────────────┬────────────────────┐
│                          │                    │
│   VIRTUAL OFFICE         │   PIPELINE         │
│   (flex-2, ~60%)         │   (flex-1.2, ~40%) │
│                          │                    │
│                          │  ┌──────────────┐  │
│                          │  │ Current Task  │  │
│                          │  ├──────────────┤  │
│                          │  │ Pipeline +    │  │
│                          │  │ Runtime Gate  │  │
│                          │  └──────────────┘  │
│                          │                    │
├──────────────────────────┤                    │
│ WORKING│COMPLETE│ IDLE   │                    │
└──────────────────────────┴────────────────────┘
```

- 100vh, no scrolling
- Only log areas may scroll internally
- Virtual Office never scrolls

## Component Rules

| Panel | Shows | NEVER Shows |
|-------|-------|-------------|
| Virtual Office | Worker positions, state, department | Pipeline, logs, task details |
| Current Task | Task ID, title, type, log | Pipeline, runtime gate |
| Pipeline | 5 lifecycle phases only | Worker names, task details |
| Runtime Gate | Gate type, owner, barrier, PM review, elapsed | Pipeline info, worker info |
| Statistics | Working, Complete, Idle (3 cards) | Charts, graphs, history |

## Colors

| State | Color |
|-------|-------|
| Working | Yellow |
| Idle | Grey |
| Complete | Green |
| REWORK | Red |
| Waiting PM | Cyan accent |
| Current phase | Cyan + glow |
| Completed phase | Green + glow |
| Future phase | Grey |

## Principles

1. Virtual Office never scrolls
2. Overview fits in one viewport
3. Pipeline shows lifecycle only
4. Runtime Gate explains bottlenecks
5. Statistics remain three cards
6. Dashboard never computes runtime state
7. No duplicated information across panels
8. Every panel answers ONE question

---

## Source: `dashboard-theming-and-workflow.md`

# AIC Dashboard Theming & Workflow Rules

## 1. Git Workflow: STRICTLY No Auto-Commit
- **Rule:** NEVER automatically `git commit` after finishing an implementation or fix. 
- **Why:** The user ("tvd") requires manual review of the visual and functional state before changes are committed ("ga ada yang suruh commit"). Auto-committing disrupts their review flow and requires reverting.
- **Action:** Stage changes (`git add .`), visually verify them, report readiness to the user, and **WAIT** for their explicit command to commit.

## 2. Strict Single-Theme Status Colors
The dashboard UI enforces a strict "one theme per status" rule. Do not mix colors for a single state (e.g., blue borders with yellow text). All elements of a worker's representation (border, text, pulse/glow, badges, background tints) must share the same base color:
- **WORKING:** Yellow (`text-aic-yellow`, `border-aic-yellow`, yellow shadow/glow).
- **COMPLETE:** Green (`text-aic-green`, `border-aic-green`, green shadow/glow).
- **IDLE:** Gray/Muted (`text-gray-500`, muted borders and backgrounds).
- **REWORK / BLOCKED:** Red (`text-red-400` or `text-red-500`, red shadow/glow).

*Pitfall:* Watch out for duplicated state mappings. Components like `WorkerDesk.tsx` and `StatusBubble.tsx` may both have their own `statusConfig` objects. If you change a status color, you must update it in **all** localized config objects to maintain the single-theme rule.

## 3. Visual Spacing & Proportions
- **Avoid 100% Heights:** When adjusting large structural panels (like the Virtual Office floor), prefer percentage heights that leave a slight gap (e.g., `h-[94%]`) over `h-full` unless explicitly requested. The user dislikes panels that stretch entirely to the bottom edge without breathing room.
- **Readability Margins:** Ensure text labels (like worker names) placed below structural elements (like desks) have sufficient margin (e.g., `mt-2`) so the text does not touch or overlap the structural borders.
- **Gap vs Per-Section Spacing:** `gap-N` on a parent flex/grid container applies to ALL children equally. If the user wants different spacing between specific sections, remove the parent `gap` and use per-section `mt-*` / `mb-*` instead. User was frustrated when `gap-2` caused unwanted space between STATUS cards and PERFORMANCE panel.

## 4. Vite Build Timing Pitfall (CRITICAL)
After editing dashboard source files, `npm run build` may succeed but the `dist/` output can be OLDER than the source if the build ran before the last edit. The AIC server serves from `dist/`, so the browser shows stale content.

**Verification pattern:**
```bash
stat -c '%Y %y' dashboard/dist/index.html
stat -c '%Y %y' dashboard/src/pages/OverviewPage.tsx
```
If source timestamp > dist timestamp, run `npm run build` again before restarting the server.

**Why this happens:** Multiple rapid edits + one `npm run build` in between. The build captures everything up to that point, but subsequent `patch` edits are not included.

**Fix:** Always rebuild AFTER the last edit, then restart server, then tell user to hard-refresh (`Ctrl+Shift+R`).

## 5. Python Replace + Unicode Pitfall
Python `str.replace()` silently fails when the search string contains unicode characters (e.g., `▶`, `✓`) that don't match the encoded representation in the file. The replace returns without error but doesn't change anything.

**Fix:** Use the `patch` tool instead of Python string replace for files containing unicode characters. The `patch` tool handles encoding correctly.

**Example:** `▶` in `<span className="text-aic-accent text-[10px]">▶</span>` — Python replace with this literal character failed silently. `patch` tool worked immediately.

## 6. Performance Panel: Single Column Layout
The Performance panel uses `flex flex-col gap-0.5` (not `grid grid-cols-2`). User explicitly requested vertical single-column layout. All metrics stack vertically: RSS, Heap, Load 1m, Load 5m, Cores, Total Requests, Total Input, Total Output.

Title "▶ PERFORMANCE" is ABOVE the card, not inside it (consistent with PIPELINE/RUNTIME GATE/STATUS titles).

Task Runtime was REMOVED from the Performance panel — it lives in the Pipeline/Runtime Gate section instead.

## 7. Dispatcher Always Working When Connected
When the AIC server is online, the dispatcher (Hermes) worker must ALWAYS display `working` status — it is never `idle`. The backend may report `status: 'idle'` for the dispatcher, but the UI must override this.

**Implementation:** In `WorkerGrid.tsx`, after resolving `uiStatus`:
```typescript
if (worker.id === 'dispatcher' && state.connected) uiStatus = 'working';
```
The `DELEGATE` badge on the dispatcher card is also tied to `status === 'working'`, so it always renders when connected.

The OverviewPage stats (working/complete/idle counts) must also treat dispatcher as always working:
```typescript
if (w.id === 'dispatcher' && state.connected) return true; // always working
```

## 8. Right Panel Layout Order
The right panel vertical order is: **Pipeline/Runtime Gate → PERFORMANCE → STATUS**.

User explicitly requested STATUS be moved below PERFORMANCE. When iterating on layout order, confirm the final sequence with the user before committing — they may want to swap sections again.

## 9. Pipeline/Runtime Gate Height Sync
Both Pipeline and Runtime Gate cards must have the same fixed height (`h-[180px]`) to stay bottom-aligned. Use `grid grid-cols-2` for the parent container instead of `flex` to guarantee equal heights regardless of content. The title areas also need fixed height (`h-[28px]`) to prevent misalignment when one title has extra content (e.g., timer in Runtime Gate title).
---

## Source: `dashboard-ui-rules.md`

# AIC Dashboard UI & Layout Rules

## Core Philosophy
- **Read-Only Observability:** The dashboard never computes scheduler state, owns business logic, or controls runtime. It strictly visualizes state received via SSE from `server.js`.
- **Single Source of Truth:** `server.js` state. No pseudo-state transitions or local UI state derivation (e.g., waiting for PM review is explicitly derived from `state.pmReview.phase`).
- **Control Room Paradigm:** The UI must fit exactly within a 100vh desktop viewport without any vertical page scrolling. Virtual Office never scrolls (content scales/compresses). Only internal logs may scroll (`overflow-y-auto`).

## Sizing Freezes (STRICT)
The user has strictly frozen the heights of the right-column operational panels to ensure a balanced, scroll-free 100vh layout. Do NOT alter these without explicit PM override:
- **Current Task Card:** Fixed `h-[240px] shrink-0`
- **Pipeline Card:** Fixed `h-[240px] shrink-0`
- **Runtime Gate Card:** Fixed `h-[240px] shrink-0`
- **Worker Statistics (Working/Complete/Idle):** Fixed `h-[150px] shrink-0`
- **Decorative Image (AIC.png):** Fixed `h-[200px] shrink-0 mt-auto`

## Ad-Hoc Verification Strategy
When modifying Tailwind layout classes, standard `npm run build` and `tsc` will not catch visual regression or accidentally stripped classes.
**Pitfall Prevention:** Always write a temporary bash script (e.g., `/tmp/hermes-verify-layout.sh`) that uses `grep -q "h-\[240px\] shrink-0"` on the target `.tsx` file to explicitly assert the layout constraints remain intact *before* declaring the task complete.

## JSX Patching Pitfalls
When updating dense React components (like `PipelineTracker.tsx`), be extremely cautious with `patch` or `sed`. Similar HTML tags (`<div className="flex-1">`) often result in matching the wrong block, causing orphaned closing tags or duplicated variable declarations. When making structural UI changes, rewriting the component or using highly targeted, unique contextual lines is mandatory.