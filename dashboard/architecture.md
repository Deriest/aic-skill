# Architecture Plan: Pipeline Tracker Scaling

## Target File
`src/components/new_layout/PipelineTracker.tsx`

## Proposed Changes

### 1. Increase Text Size
- **Location**: Line 63
- **Action**: Replace `text-px-sm` with `text-px-lg` (or `text-[11px]` / `text-px-md`) to fill the `h-[240px]` card proportionally.

### 2. Spacing and Alignment
- **Location**: Line 45 (Parent flex container) & Line 64 (Icon container)
- **Action**: 
  - Change parent flex element classes from `flex flex-col justify-between z-10 flex-1 min-h-0` to `flex flex-col gap-4 z-10 flex-1 min-h-0`.
  - Change icon container class from `w-8` to `w-10` to maintain alignment.

### 3. Scroll Container Verification
- **Verification**: Keep `overflow-y-auto` ONLY on the Current Task description (line 29), ensuring it does not exist on the pipeline tracker container.
