# AIC Dashboard Bug Patterns

## 1. Dispatcher `working` Status triggers `[reset] {}` Spam
When the `dispatcher` agent is set to `status: "working"`, the dashboard UI triggers an infinite loop of `POST /api/reset` calls, filling the activity log with `[reset] {}` and `[agent_status] {"agent":"dispatcher","status":"working"}` messages every 2 seconds.

**Cause:** The frontend React components contain a side-effect (likely in `DashboardContext.tsx` or a related effect hook) that inadvertently fires the `resetSystem()` function when it detects the dispatcher in a working state. This was mistakenly attributed to orphaned bash scripts, but the timing (exactly 2 seconds, matching the polling intervals) and the trigger condition (`dispatcher` ON) prove it is a frontend React render loop bug.

**Workaround:** 
Keep the Dispatcher in the `idle` state. Do NOT use `POST /api/agent-status {"agent":"dispatcher", "status":"working"}` to indicate Hermes is thinking.

**Permanent Fix Needed:** 
The React frontend needs to be audited to find where `resetSystem()` or `post('/api/reset')` is called as a side-effect of state changes, specifically tied to the `dispatcher` agent's status.