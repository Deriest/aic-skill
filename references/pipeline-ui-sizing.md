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
