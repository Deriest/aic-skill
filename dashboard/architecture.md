# Right Sidebar Layout Architecture

To prevent elements in the right sidebar from expanding vertically under dynamic content, the following Tailwind changes should be applied:

## `src/components/new_layout/PipelineTracker.tsx`

1. **Current Task Card Container:**
   - Change from `shrink-0 flex flex-col min-h-[220px]` to `shrink-0 flex flex-col h-[220px]`.
   - This sets a rigid fixed height of exactly 220px instead of allowing the card to grow.
2. **Inner Description Block:**
   - Keep `flex-1 min-h-0 overflow-y-auto` class on the inner container (e.g., `<div className="text-aic-text-bright/90 font-pixel text-[11px] ... flex-1 min-h-0 overflow-y-auto">`) to handle overflow correctly without affecting parent height.
3. **Pipeline Container:**
   - Ensure the wrapper container uses `flex-1 min-h-0 relative` so it takes the remaining height strictly and remains scrollable/contained.

## `src/pages/OverviewPage.tsx`

1. **Right Sidebar Container:**
   - Ensure the outer sidebar element utilizes `flex-1 flex flex-col gap-3 h-full min-w-[400px] overflow-hidden` or is otherwise strictly constrained to avoid vertical expansion.
