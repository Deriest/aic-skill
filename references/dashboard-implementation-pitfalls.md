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
