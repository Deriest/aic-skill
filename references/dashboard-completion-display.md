# Dashboard Completion Display Pattern (2026-07-17)

When a task pipeline reaches COMPLETE, the dashboard must preserve task visibility until a new task starts.

## State Shape

Added `lastCompletedTask` to `DashboardState` (types/index.ts):
```typescript
lastCompletedTask?: { id: string; title: string; completedAt: string } | null;
```

## Engine Behavior

### `pipeline.js` — `completeTask()`
- Does NOT nullify `currentTask` — keeps it visible with `pipelineState='COMPLETE'`
- Sets `runtimeGate = {status:'complete'}`
- Sets `currentPhase = 'Closeout'`
- Sets `lastCompletedTask = {id, title, completedAt}`
- Clears both on next `task.create` intent (in `intent.js`)

### `recovery.js` — `reconcileOnStartup()`
- COMPLETE checkpoint → preserve `currentTask`, set runtimeGate + lastCompletedTask
- CANCELLED/BLOCKED → clear currentTask as before

## Dashboard Rendering

| Component | When COMPLETE | Shows |
|-----------|--------------|-------|
| Current Task | `currentTask.pipelineState === 'COMPLETE'` | Full task info (id, title, description) |
| Current Task | `!currentTask && lastCompletedTask` | "✓ TASK COMPLETE" with ID, title, timestamp |
| Runtime Gate | `runtimeGate.status === 'complete'` | `COMPLETE` (green) |
| Pipeline | `currentTask.pipelineState === 'COMPLETE'` | All 5 phases ✓ |
| Progress Bar | `pipelineComplete` flag | 100% |
| Gate Label | Before checking `!currentTask` | `COMPLETE` not `ONLINE` |

## Pitfalls

1. **Progress bar must check `pipelineComplete` FIRST** — workers reset to idle on restart, so counting `workers.filter(status === 'complete')` returns 0. The shortcut `if (pipelineComplete) completeRequired = required.length` ensures 100%.

2. **Gate logic order matters** — check `pipelineState === 'COMPLETE'` BEFORE checking `!currentTask` (which returns `ONLINE`). Order in `PipelineTracker.tsx`:
   ```
   if (!currentTask && !lastCompletedTask) → ONLINE
   if (currentTask.pipelineState === 'COMPLETE' || runtimeGate.status === 'complete') → COMPLETE
   // ... rest of gate states
   ```

3. **`lastCompletedTask` is redundant when `currentTask` is present** — it's a fallback for edge cases where `currentTask` gets cleared (e.g., forced cancel then manual state repair). Dashboard shows `currentTask` data when available, falls back to `lastCompletedTask`.

4. **Clear on new task** — `lastCompletedTask` is set to `null` in `task.create` intent so the previous completion doesn't bleed into the new task.
