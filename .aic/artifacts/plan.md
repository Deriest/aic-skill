# Execution Plan - Dashboard Bugs (TASK-20260707-014)

## Execution Order
The bugs will be addressed in the following order:
1. **BUG-1** (Dispatcher avatar not showing 'working') - Critical for core system visualization.
2. **BUG-2** (CURRENT TASK and PIPELINE panels flicker) - Stabilizes UI components.
3. **BUG-3** (ACTIVITY LOG panel empty or spamming) - Corrects log state synchronization.

---

## BUG-1: Dispatcher avatar does not show 'working'

### File
`dashboard/src/components/office/DispatcherAvatar.tsx` (lines 1-31)
`dashboard/src/data/workers.ts` (lines 1-14)
`dashboard/src/components/office/WorkerGrid.tsx` (lines 1-43)

### Change
1. **`dashboard/src/data/workers.ts`**: Extract and export the `dispatcher` worker definition as a separate constant `DISPATCHER_WORKER` and remove it from the main `WORKERS` array.
2. **`dashboard/src/components/office/DispatcherAvatar.tsx`**: Remove the auto-fix `setInterval` polling that POSTs to `/api/agent-status`. Instead, import `DISPATCHER_WORKER` and render `WorkerDesk` with the dispatcher definition, status (from `state.agents.dispatcher?.status`), and engine.
3. **`dashboard/src/components/office/WorkerGrid.tsx`**: No functional code changes are required here, as the removal of `dispatcher` from `WORKERS` automatically excludes it from the main section-based grid, while `DispatcherAvatar` is already rendered separately at the top.

### Rationale
Removing the auto-fix `setInterval` eliminates conflicts with manual user controls. Rendering the `WorkerDesk` inside `DispatcherAvatar` ensures the dispatcher has proper visual presence on the dashboard reflecting its true state (`state.agents.dispatcher.status`). Removing the dispatcher from the main `WORKERS` list prevents it from being double-rendered in the office sections.

---

## BUG-2: CURRENT TASK and PIPELINE panels flicker every poll

### File
`dashboard/src/context/dashboardReducer.ts` (lines 30-45)

### Change
Implement helper comparison functions (`isTaskEqual`, `isPhasesEqual`, `isWorkflowEqual`) to compare incoming status updates with existing state. In the `MERGE_STATUS` reducer case, perform a deep check of `currentTask`, `phases`, `workflow`, and `agents`. Only update the state properties (and preserve their stable object references) if the incoming data has actual changes. If nothing changed, return the unmodified `state`.

### Rationale
The React components (`TaskInfoPanel`, `PipelinePanel`) re-render because `useStatusPolling` triggers a state update with newly constructed object references on every 5s poll. By enforcing stable references in the reducer and returning the original state if no values changed, we prevent unnecessary React reconciliation passes and eliminate the panel flickers.

---

## BUG-3: ACTIVITY LOG panel is empty or spams

### File
`dashboard/src/hooks/useStatusPolling.ts` (lines 41-55)

### Change
Replace the log appending logic. Instead of blindly prepending all logs on every poll (which duplicates them since the server logs are persistent), map the incoming `data.logs` array from the server. For each log entry, look up the existing log in the client state by matching `message` and `type` to preserve its `id` and `timestamp`. Generate new IDs and timestamps only for truly new logs. Dispatch `SET_LOGS` with the updated list (reversed for correct chronological order) only if there is a change in the log count or messages.

### Rationale
This prevents log spam by stopping the client from infinitely prepending the persistent server log list on every poll. Preserving the `id` (React key) and `timestamp` of existing logs ensures that only newly added logs trigger the framer-motion entry animation, preventing existing entries from re-rendering or flickering.

---

STATUS: COMPLETE
