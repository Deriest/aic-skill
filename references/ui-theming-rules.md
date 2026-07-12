# Dashboard UI Theming & Layout Rules

When modifying the AIC Pixel Dashboard (dashboard/src), strictly adhere to the visual rules established during IMP-001:

## 1. Unified Status Colors
A status must have exactly ONE color theme applied across all its visual components (border, text, glow, pulse). Do not mix colors.
- **WORKING:** Yellow (`border-aic-yellow`, `text-aic-yellow`, `bg-yellow-900/10`)
- **COMPLETE:** Green (`border-aic-green`, `text-aic-green`, `bg-green-900/10`)
- **IDLE:** Gray (`border-gray-600/50`, `text-gray-500`, `bg-gray-800/20`)

**Pitfall:** Always check isolated components (like `StatusBubble.tsx`) to ensure they don't override the main theme with legacy colors (e.g., blue for working). If you change a status color, update it everywhere.

## 2. Panel Heights & Proportions
- Do NOT use `h-full` for large main cards (like the Virtual Office container) if it stretches them to the absolute bottom edge. Leave a small gap (e.g., `h-[94%]`) for better visual rhythm and breathing room.
- Balance flex panels visually using proportionate ratios (e.g., `flex-[1.5]` for main view vs `flex-1` for sidebar), avoiding extreme imbalances like `flex-[2]`.

## 3. Element Spacing & Cleanliness
- **Text Legibility:** Ensure text elements never directly touch graphical boundaries. Add sufficient margin (e.g., `mt-2`) to separate text labels from structural elements like desks or avatars.
- **Decluttering:** Remove redundant or cluttered inline badges (e.g., removing the Opencode badge from worker cards) if the information is already conveyed by the worker's status or role.