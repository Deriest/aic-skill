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