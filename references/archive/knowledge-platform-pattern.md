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
