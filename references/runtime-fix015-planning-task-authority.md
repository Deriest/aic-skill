# FIX-015 — Planning workers bound to context.json

**When:** Planning PM REWORK for inconsistent pm/architect/research (IMP-013, OAT 037). `context.json` is authoritative; Planning pm invented different epic.

**Fix:** `phase-runner.sh` — when `PHASE=Planning`, inject `PLANNING_AUTHORITY_BLOCK` before `TASK_SCOPE` for pm, architect, research. Requires verbatim `## Task Authority (verbatim)` with title + description; forbids rename/roadmap/epic outside task.

**Not:** Runtime, WECP, PM transport.

**OAT:** New task after server up; Planning PM must align before FIX-014 E2E.