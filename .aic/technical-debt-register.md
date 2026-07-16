# AIC Skill v3.4.0 — Technical Debt Register

## Acceptable Debt (does not block production)

### D-10: Event bus not persisted to disk
- **Severity:** LOW
- **Component:** scripts/engine/events.js
- **Description:** Event bus emits work in-memory but no JSONL file is written. The event-store module exists but is not wired to the bus persistence hook.
- **Production impact:** None during normal operation. Events are lost on server restart.
- **Classification:** Acceptable debt — future milestone
- **Upgrade path:** Wire `event-store.js` persistence hook to `bus.on('*', ...)` in engine factory.

### Stale 3.1.3 references in historical docs
- **Severity:** NONE (documentation history)
- **Component:** SKILL.md (pitfall reference), references/eip-consolidated.md, references/git-and-release.md
- **Description:** Historical EIP investigation documents reference version 3.1.3 as a finding. These are accurate records of what was found during that investigation, not live code.
- **Classification:** No action needed — historical accuracy
- **Note:** SKILL.md line 156 references "DEFECT-04" as a pitfall. The defect is fixed but the pitfall documentation is still valid as a troubleshooting reference.

### 9 workers not assigned to FSM phase plans
- **Severity:** LOW
- **Component:** scripts/config.js (WORKERS array) vs scripts/engine/fsm.js (PHASE_PLANS)
- **Description:** 15 workers defined, 6 used in pipeline phases. The remaining 9 (devops, dba, security, performance, integration, documentation, governor, dispatcher, crafter) are registered but not reachable through the pipeline.
- **Classification:** Acceptable debt — these may be used via direct spawn-worker.sh invocation or future phases
- **Production impact:** None

## Must Fix Before Release
None. All Critical and High defects are closed.

## Future Milestone
- D-10: Event persistence (wire event-store to bus)
- Consider adding integration tests for pipeline phases
- Consider adding /api/workers, /api/state standalone GET endpoints (currently only via /api/status)
