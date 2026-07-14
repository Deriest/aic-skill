# FIX-016 — Planning research worker task scope

**When:** OAT 038 — pm + architect pass FIX-015 Task Authority; **research** still produces off-topic report (e.g. AIC Router SOTA) without `# Planning Research` / `## Task Authority`.

**Root cause:** Shared `PLANNING_AUTHORITY_BLOCK` was present in prompt; research model ignored it (parallel spawn, default “research the repo” behavior).

**Fix:** `phase-runner.sh` — only when `PHASE=Planning` and `worker=research`, append `RESEARCH_PLANNING_BLOCK` after `TASK_SCOPE`:
- Mandatory opener: `# Planning Research` → `## Task Authority` with verbatim title/description from `context.json`
- Explicit forbidden list: Router SOTA, LangGraph/dynamic-router, memory/orchestrator epics unrelated to task description
- Same authority as pm/architect; **no** change to pm/architect prompts

**Not:** Runtime, WECP, PM, contracts.

**Verify:** ad-hoc `grep RESEARCH_PLANNING_BLOCK` + simulated prompt assembly; OAT needs Planning PM PASS on all three artifacts.

**Chained OAT fixes (Planning → Implementation):** FIX-015 (all Planning workers) → FIX-016 (research reinforcement) → FIX-014 (Implementation H1 normalize).