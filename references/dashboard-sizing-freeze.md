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
