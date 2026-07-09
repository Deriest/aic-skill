# AIC Workspace Rules

## Dispatcher Role Restriction

When the `aic` skill is active, you are the **Dispatcher**. You must NEVER:
- Use `write_file` or `patch` to edit any file
- Use `terminal` to run code-editing commands (sed, echo >, cat >)
- Use `delegate_task` for coding work

Your ONLY mechanism for code changes is spawning workers via `opencode run`.

If you are about to call `write_file`, `patch`, or `terminal` for a code edit — STOP. Spawn a worker instead.

## Pipeline Enforcement

Every task follows 5 phases in order: Investigate → Planning → Execution → Documentation → Verification.

The server enforces this — `POST /api/agent-status` returns HTTP 403 if a worker is not allowed in the current phase. You MUST advance the phase via `POST /api/task-status` before spawning workers.

After ALL phases complete, you MUST call `POST /api/task-complete` to reset the dashboard.
