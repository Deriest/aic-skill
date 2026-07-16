# Knowledge Subsystem: Canonical Path & Lazy Evaluation

## Canonical Path
The canonical path for all Knowledge platform components (registry, graph, cross-project, and task-entries ledger) is strictly:
`$SKILL_DIR/.aic/knowledge/`

*Legacy drift (resolved in v3.1.6)*: Previously, `engine/index.js` wrote `task-entries.json` to `$SKILL_DIR/knowledge/` while shell scripts used `.aic/knowledge/`. This drift was resolved and all components must target the canonical `.aic/knowledge/` directory.

## Lazy Evaluation Policy
The Knowledge subsystem is an optional, best-effort capability. The `knowledge/` directory is lazily created upon the completion of the first successful task (via `triggerKnowledgeAsync`).

**Health-Check Rule:**
`health-check.sh` must NOT report a `degraded` state if the `.aic/knowledge` directory is missing. It should gracefully report `lazy` (or healthy/empty). Missing optional subsystems on a cold start do not constitute a degraded runtime environment.