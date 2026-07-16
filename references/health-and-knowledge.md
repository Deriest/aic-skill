# Health And Knowledge

> **Consolidated from 4 files.** Originals archived in `references/archive/`.

**Original files merged:**
- `health-check-knowledge-lazy-evaluation.md`
- `health-check-knowledge-pitfall.md`
- `knowledge-health-policy.md`
- `knowledge-platform-pattern.md`

---

---

## Source: `health-check-knowledge-lazy-evaluation.md`

# Knowledge Subsystem: Canonical Path & Lazy Evaluation

## Canonical Path
The canonical path for all Knowledge platform components (registry, graph, cross-project, and task-entries ledger) is strictly:
`$SKILL_DIR/.aic/knowledge/`

*Legacy drift (resolved in v3.1.6)*: Previously, `engine/index.js` wrote `task-entries.json` to `$SKILL_DIR/knowledge/` while shell scripts used `.aic/knowledge/`. This drift was resolved and all components must target the canonical `.aic/knowledge/` directory.

## Lazy Evaluation Policy
The Knowledge subsystem is an optional, best-effort capability. The `knowledge/` directory is lazily created upon the completion of the first successful task (via `triggerKnowledgeAsync`).

**Health-Check Rule:**
`health-check.sh` must NOT report a `degraded` state if the `.aic/knowledge` directory is missing. It should gracefully report `lazy` (or healthy/empty). Missing optional subsystems on a cold start do not constitute a degraded runtime environment.
---

## Source: `health-check-knowledge-pitfall.md`

# Knowledge Subsystem: Lazy Creation & Health Check Pitfall

## Background
The Knowledge Subsystem is an **optional, best-effort** ledger appended by the runtime engine (`triggerKnowledgeAsync`) when a task completes successfully.

By design, the `.aic/knowledge` directory is **lazy-created**. It does not exist on a fresh installation and is not initialized by `setup.sh`.

## The Pitfall
Pre-v3.1.6, `health-check.sh` erroneously checked `[[ -d "$SKILL_DIR/.aic/knowledge" ]]` as a strict requirement. On a cold start (no tasks run yet), this caused the global health state to report as **`degraded`** despite the system being fully functional.

Simultaneously, path drift existed where `engine/index.js` wrote to `$SKILL_DIR/knowledge/` while the shell scripts checked `$SKILL_DIR/.aic/knowledge/`.

## Resolution (v3.1.6)
1. **Canonical Path:** The canonical path for the Knowledge Subsystem is strictly `.aic/knowledge`.
2. **Lazy Health Status:** `health-check.sh` now classifies an absent `.aic/knowledge` directory as **`lazy`** rather than `unhealthy`.
3. **Global Status Protection:** The `lazy` state explicitly does **not** trigger a global `degraded` system state.

If the user reports `degraded` status on a fresh start with `knowledge: unhealthy`, they are likely running a pre-v3.1.6 `health-check.sh` script or have experienced a path regression.

Do NOT fix this by modifying `setup.sh` to create empty directories. Fix the health-check policy and ensure path canonicalization.

## Refinement (v3.2.0): Knowledge never triggers degradation — by design
The `for r in "$R_SERVER" "$R_AUTH" "$R_KNOWLEDGE" "$R_FS"` loop checks each component for `"unhealthy"`. But `check_knowledge()` only ever returns `"healthy"` or `"lazy"` — never `"unhealthy"`. This means knowledge is **naturally excluded** from triggering the degradation condition without needing any special handling or redundant guard lines.

Any code like `[[ "$STATE" == "healthy" && "$R_KNOWLEDGE" == "lazy" ]] && STATE="healthy"` is a no-op and should be removed. The protection is inherent in the two-value return contract of `check_knowledge()`.

If someone proposes adding `"unhealthy"` as a third return value for knowledge, that would break this implicit protection. Knowledge's two-value contract (`healthy`/`lazy`) is the deliberate design choice that makes it a safe best-effort subsystem.
---

## Source: `knowledge-health-policy.md`

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
---

## Source: `knowledge-platform-pattern.md`

# Knowledge Platform Implementation Pattern

## Context

Milestone H implemented a Knowledge & Artifact Platform with 9 new scripts and 2 modified scripts. This reference captures the architecture decisions and implementation patterns for future knowledge platform work.

## Scripts Created

| Script | Purpose | WP |
|--------|---------|-----|
| artifact-registry.sh | Register, version, query artifacts (JSON registry) | H-1 |
| knowledge-lifecycle.sh | Draft→Validated→Approved→Deprecated state machine | H-1 |
| knowledge-index.sh | Build/update metadata index by type/tag/worker | H-2 |
| knowledge-search.sh | Keyword search with scoring over index | H-3 |
| knowledge-reuse.sh | Suggest approved artifacts for new tasks | H-4 |
| knowledge-memory.sh | Persistent key-value store with metadata | H-5 |
| knowledge-lessons.sh | Capture/query patterns and anti-patterns | H-6 |
| knowledge-graph.sh | JSON graph of artifacts/workers/decisions | H-7 |
| knowledge-cross-project.sh | Cross-project reference links | H-8 |

## Scripts Modified

| Script | Change |
|--------|--------|
| worker-validation.sh | Added `knowledge-validate` action (check $1 before default behavior) |
| worker-memory.sh | Added `knowledge-store`/`knowledge-retrieve` actions (override KEY/VALUE positions) |

## Architecture Decisions

- **JSON Registry** in `.aic/knowledge/registry.json` — single source of truth for all artifacts
- **Grep-based Search** — no vector DB, keyword matching with scoring (title=3pts, tags=2pts, desc=1pt)
- **SHA256 Versioning** — hash-based version tracking, increment on re-registration
- **JSON Knowledge Graph** — nodes + edges in `.aic/knowledge/graph.json`
- **4-state Lifecycle** — Draft → Validated → Approved → Deprecated (enforced transitions)
- **Suggest-then-Approve** — only approved artifacts are reusable; unapproved blocked

## Key Implementation Lessons

1. All Python-in-bash uses heredocs (`python3 << PYEOF`) with %-format strings
2. `worker-validation.sh` checks $1 for special actions before falling through to default WORKER validation
3. Version field stores bare `"v1"` format; print format uses `%s` (no hardcoded `v` prefix)
4. Search runs against the index (not raw registry) for performance
5. All scripts initialize their data files on first run (idempotent)

## Integration Points

- `worker-validation.sh knowledge-validate` → calls `artifact-registry.sh update-status`
- `worker-memory.sh knowledge-store` → calls `knowledge-memory.sh store`
- All scripts share `.aic/knowledge/` directory for data storage
- No server.js endpoints added (deferred — scripts work standalone)
