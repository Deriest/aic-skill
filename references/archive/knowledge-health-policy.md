# Knowledge Platform Path Drift & Health Check Policy

**Symptom:**
Health check (`health-check.sh`) reports `degraded` for the Knowledge subsystem on a fresh installation or cold start.

**Root Cause:**
1. The Knowledge subsystem is designed as an **optional, lazy-created, best-effort ledger**. The folder is only created after the first successful task completes.
2. A path drift existed where `engine/index.js` pointed to `knowledge/` while the bash scripts and health check pointed to `.aic/knowledge/`.

**Resolution (Implemented in v3.1.6):**
1. The canonical path for the Knowledge Platform is strictly **`.aic/knowledge/`**.
2. The health check evaluates a missing `.aic/knowledge/` directory as `lazy` rather than `unhealthy`.
3. A `lazy` status on the Knowledge subsystem does **not** degrade the overall system health, ensuring a fresh installation remains `healthy`.

**Workflow Note:**
Do not manually create `.aic/knowledge/` just to satisfy older health checks. Let the engine create it naturally on the first successful task completion (`triggerKnowledgeAsync()`).