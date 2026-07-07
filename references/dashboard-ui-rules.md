# Dashboard UI/UX Rules (Cyberpunk Pixel-Art)

The AIC Dashboard is a pure React frontend built with Vite and Tailwind CSS. It specifically adheres to a 8-bit retro pixel-art aesthetic heavily leaning into a cyberpunk theme (navy/black bg, cyan accents, neon yellow alerts).

## Core Layout

- **Header / Navigation:** Uses `App.tsx` state (`activeTab`) to switch between pages without `react-router`. Uses `font-pixel`, text shadows (`text-shadow-cyan`), and tracking-widest for retro feel.
- **Overview Page:** Serves the 3D-ish isometric/flat hybrid `OfficeFloor`.
  - **Pipeline Tracker:** Resides dynamically on the right sidebar, tracing the strict 5-phase strict lifecycle.
- **Config Page:** Resides in a separate tab (`CONFIG (2)`). Contains form-based key-value pairs mapping `.env` and `opencode.jsonc`, omitting raw `<textarea>` inputs for usability.

## Positioning & Pixel Aesthetics

- **Avatars (`WorkerDesk`):** Powered by `framer-motion` and HTML5 Canvas (`usePixelCanvas.ts`). Rendered strictly with `imageRendering: 'pixelated'`.
- **Z-Indexing:** Desks overlap gracefully. Hover effects create neon box-shadows (`shadow-[0_0_15px_rgba(0,255,255,0.2)]`).
- **Worker Sorting Hierarchy:** The grid strictly sorts workers top-to-bottom: `Dispatcher` -> `Governance` -> `Product` -> `Engineering`. Ensure `groupWorkersBySection` returns a sorted array tuple.
- **Desk Accents:**
  - *Monitor*: Anchored relative to desk using `-top-12 right-2`.
  - *Status Plat/Bubble*: Anchored `top-2 left-1/2 -translate-x-1/2` directly on the wooden surface div.

## Typescript Strictness

Avoid using `sed` or bash scripts to update `.tsx` types. Rely on LSP or explicit `write_file`. The dashboard expects nested `{ status, engine }` primitive extractions from the `DashboardContext`, so visual components like `StatusBubble` must be passed `status={state?.status ?? 'idle'}`.