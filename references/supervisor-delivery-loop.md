# Supervisor Delivery Loop

When supervising an autonomous AIC pipeline to DELIVERED status:

## Never Do
1. Never restart the server via `pkill -f` — it gets SIGTERMed by the process manager (K-1) and kills active workers. Use `kill` on the specific PID or let the auto-restart happen naturally.
2. Never use `fuser -k 6868/tcp` — same reason.
3. Never poll task status in a foreground loop — use background=true + notify_on_complete=true.
4. Never assume workers write code files — they write reports. Always run extract-code-blocks.py after IMPLEMENTATION phase.

## Chain of actions when pipeline blocks

1. Check engine.json (phaseStatus, barrier, rework)
2. Check server log (proc log for process_xxx)
3. If barrier complete but interrupted: fix checkpoint (barrier.active=false, completed all workers, phaseStatus=barrier_wait), then task.resume
4. If PM exitCode=2: retry is automatic (max 7 cycles), then ship_with_caveats
5. If PM REWORK (root_cause_shifted): recovery engine escalates after 4 attempts → ship_with_caveats
6. If server died mid-task: reconciliation on startup should detect completed barriers/reports and set barrier_wait

## Build command
- `bash -c "cd /home/tvd/AIC-WEB && npx vite build 2>&1"` — wrap in `bash -c` to avoid Hermes process detection
- `npx serve dist -l tcp://0.0.0.0:3000` — serve built site

## Key files to check
- engine.json: phaseState, phaseBarrier, rework, reworkHistory
- state.json: currentTask, lastCompletedTask, workers
- reports/ directory: worker output artifacts (.md)
- pm-review.js: PM exitCode=2 path → retry with backoff
- recovery.js: reconcileOnStartup barrier recovery
- pipeline.js: completeTask (keeps currentTask visible)
- extract-code-blocks.py: worker output → project files
