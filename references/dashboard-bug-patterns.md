# AIC Dashboard Bug Patterns (Verified Fixes)

## 1. Activity Log Infinite Spam — Root Causes (3-layer bug)

**Layer 1 — Server returns full audit array every poll (no drain):**
`/api/status` mapped `state.audit.map(...)` without clearing it. Every 5s poll returned the same entries.
**Fix:** Drain-on-read: map to `logs`, then `state.audit = []` before returning response.

**Layer 2 — Frontend APPEND_LOG grows forever:**
`useStatusPolling.ts` dispatched `APPEND_LOG` in a for-loop for each entry. Dedup check only compared last entry, so entries 2–N always passed.
**Fix:** Replace with `SET_LOGS` action that overwrites entire `logEntries` array each poll. Requires adding the action type to `types/index.ts` and case to `dashboardReducer.ts`.

**Layer 3 — Worker status never resets on task_complete:**
`/api/task-complete` only reset workers with `status === 'working'`. Workers set via other paths stayed stale forever.
**Fix:** Unconditionally reset ALL workers to `{status:'idle'}` in task_complete handler.

## 2. Pipeline / CurrentTask Blinking

**Cause:** `TaskInfoPanel.tsx` uses `<AnimatePresence key={state.currentTask.id}>`. Polling creates new object references every 5s even with identical data → Framer Motion exit/enter animation fires every cycle.
**Fix options:**
- Use `currentTask?.title` as key (stable string) instead of full object
- Or use `useRef` to memoize and compare before dispatching `MERGE_STATUS`
- Or disable `AnimatePresence` mode="wait" and use simple conditional rendering

## 3. Dispatcher Status Spam

**Symptom:** Setting `{"agent":"dispatcher","status":"working"}` caused `[reset] {}` and `[agent_status]` spam every 2s.
**Root cause (verified 2026-07-07):** Not a React reset call — was actually `watchdogd` background process + stale frontend cache. After killing watchdogd and clearing `state.json` + `audit.json`, spam stopped.
**Fix:** Kill all background watchdog processes. Clear `.aic/state.json` and `.aic/audit.json`. Hard-refresh browser. The `SET_LOGS` fix (pattern #1) also prevents reoccurrence.

## 4. PM Ghost-Status (worker shows working without being dispatched)

**Cause:** `MERGE_STATUS` reducer merges `incoming` agents with existing `state.agents`. If PM was ever set to working (by old dispatcher logic) and never explicitly reset, it persists across polls.
**Fix:** Server-side: `task_complete` now resets ALL workers (pattern #1 layer 3). Client-side: `MERGE_STATUS` should fully replace agent map, not deep-merge.
