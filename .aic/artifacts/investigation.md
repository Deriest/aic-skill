# Investigation Report - Dashboard Bugs (TASK-20260707-013)

## BUG-1: Dispatcher avatar does not show 'working'

**Symptom:** User sees Dispatcher avatar dim/idle on dashboard even when server reports `dispatcher: {status: 'working'}` via curl.

**Root Cause:** The `DispatcherAvatar.tsx` component in dashboard/src/components/office/ runs a self-healing setInterval every 2s that POSTs to /api/agent-status when status is not 'working'. This auto-fix conflicts with the user's manual control, AND the component returns null (no visual feedback). The avatar relies on WorkerGrid mapping which filters by 'idle' state in some render paths.

**File:Line:**
- dashboard/src/components/office/DispatcherAvatar.tsx (entire file - the auto-fix logic)
- dashboard/src/data/workers.ts:13 (worker ID 'dispatcher' registration)
- dashboard/src/components/office/WorkerGrid.tsx (rendering logic)

**Recommended Fix:** Remove DispatcherAvatar's auto-fix setInterval. Avatar should be purely visual based on state.agents.dispatcher.status.

---

## BUG-2: CURRENT TASK and PIPELINE panels flicker every poll

**Symptom:** Right-side panels blink/flicker (muncul-hilang) every 5 seconds.

**Root Cause:** Despite the previous fix that removed AnimatePresence from TaskInfoPanel.tsx and PipelinePanel.tsx, the polling in useStatusPolling.ts still creates new object references for currentTask/phases on every fetch. React reconciliation treats this as a re-mount, but the key={state.currentTask?.id} creates a flicker when state goes through transitions.

**File:Line:**
- dashboard/src/hooks/useStatusPolling.ts:25-30 (MERGE_STATUS dispatch)
- dashboard/src/context/dashboardReducer.ts:MERGE_STATUS case (creates new object)

**Recommended Fix:** Use shallow comparison or memoization. Only dispatch if data actually changed. Or use stable references in the reducer.

---

## BUG-3: ACTIVITY LOG panel is empty or spams

**Symptom:** Activity log shows "Waiting for activity..." even when server returns logs. Occasionally ngespam.

**Root Cause:** The server drains audit logs on /api/status read. Once drained, the next render gets empty logs array. The ActivityLog.tsx probably checks `if (state.logEntries.length === 0)` which shows the placeholder. Combined with the polling that runs every 2-5s, the log briefly shows entries then empties them, causing flicker-or-empty.

**File:Line:**
- scripts/server.js:267-269 (audit drain on read)
- dashboard/src/hooks/useStatusPolling.ts:38-54 (SET_LOGS dispatch logic)
- dashboard/src/components/sidebar/ActivityLog.tsx (rendering)

**Recommended Fix:** Either: (a) keep server logs persistent and only drain on explicit /api/audit endpoint, OR (b) keep accumulating logs in client state (append, not replace).
