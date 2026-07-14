# Dispatcher cold start — `/aic` without a task

**Trigger:** User invokes `/aic`, or sets `./aic project <path>`, without describing work in the same message.

## Correct sequence

1. Preflight (`opencode`, `/health`)
2. `POST /api/agent-status` (dispatcher working)
3. Confirm project directory exists
4. Reply: compact status + **"What do you want to do in this project?"**

## Forbidden on cold start

- Long milestone / OAT / IMP-024 / freeze-C reports
- Assuming continuation of another chat's task
- Creating freeze or verify prompt files under `.aic/prompts/` without user request
- Spawning workers before user gives a task

## User signal (2026-07-14)

Indonesian frustration when Dispatcher over-delivered on activation only: *"lah laporan itu untuk apa saya baru start aic saja?"* — treat as **format/scope** correction, not a request for more documentation.

## After user gives intent

Classify request → normal pipeline (Investigate → …) or read-only investigation per scope.