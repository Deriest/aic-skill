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
