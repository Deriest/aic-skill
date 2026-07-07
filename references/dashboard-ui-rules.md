# Dashboard UI/UX Rules (Cyberpunk Pixel-Art)

The AIC Dashboard is a pure React frontend built with Vite and Tailwind CSS. It specifically adheres to an 8-bit retro pixel-art aesthetic heavily leaning into a cyberpunk theme (navy/black bg, cyan accents, neon yellow alerts).

## 1. Core Layout Constraints
- **Fixed Full-Height:** The dashboard must fit on a single screen without vertical scrolling (`h-full`, `min-h-0`, `overflow-hidden` on parent containers). Do NOT use `overflow-y-auto` on the main page wrapper.
- **Header / Navigation:** Uses `App.tsx` state (`activeTab`) to switch between pages without `react-router`. Uses `font-pixel`, text shadows (`text-shadow-cyan`), and tracking-widest for retro feel.
- **Overview Page:** Serves the 3D-ish isometric/flat hybrid `OfficeFloor`.
  - **Pipeline Tracker:** Resides dynamically on the right sidebar, tracing the strict 5-phase strict lifecycle. Scales to fill available height (`flex-1`).
- **Config Page:** Resides in a separate tab (`CONFIG (2)`). Contains form-based key-value pairs mapping `.env` and `opencode.jsonc`, omitting raw `<textarea>` inputs for usability.

## 2. Positioning & Pixel Aesthetics
- **Avatars (`WorkerDesk`):** Powered by `framer-motion` and HTML5 Canvas (`usePixelCanvas.ts`). Rendered strictly with `imageRendering: 'pixelated'`.
- **Negative Space (Breathability):** Use generous vertical spacing (`space-y-12`, `py-6`) between department sections. Use generous horizontal gaps (`gap-6 md:gap-8`) between desks. Desk width should be modest (e.g., `w-[150px]`) to avoid overpowering the screen.
- **Alignment:** Worker grids MUST be center-aligned (`flex justify-center`, `flex flex-col items-center`), never left-aligned. 
- **Z-Indexing:** Desks overlap gracefully. Hover effects create neon box-shadows (`shadow-[0_0_15px_rgba(0,255,255,0.2)]`). Idle workers should have reduced opacity (`opacity-80`) and no glowing borders to emphasize active ones.
- **Worker Sorting Hierarchy:** The grid strictly sorts workers top-to-bottom: `Leadership` (Dispatcher + Governor) -> `Product` -> `Engineering`. Ensure `groupWorkersBySection` returns a sorted array tuple. Use subtle borders beneath section headers.
- **Desk Accents:**
  - *Monitor*: Anchored relative to desk using `-top-12 right-2`. Do NOT let it float offside.
  - *Status Plat/Bubble*: Anchored `top-2 left-1/2 -translate-x-1/2` directly on the wooden surface div.

## 3. Component Constraints
- **No Activity Log:** Do not add or restore Activity Logs. The UI relies strictly on the Virtual Office avatars and the Pipeline Tracker.
- **No Scrolling:** Do not apply overflow containers that prompt scrollbars on the main dashboard view. The components must compress or flex to share viewport bounds perfectly.

## Typescript Strictness
- Avoid using `sed` or bash scripts to update `.tsx` types. Rely on LSP or explicit `write_file`. The dashboard expects nested `{ status, engine }` primitive extractions from the `DashboardContext`, so visual components like `StatusBubble` must be passed `status={state?.status ?? 'idle'}`.