# Baseline H — Knowledge & Artifact Platform

**Date:** 2026-07-10
**Commit:** 4c25e43
**Tag:** baseline-h

---

## Scripts (11)

| Script | Lines | Purpose |
|--------|-------|---------|
| artifact-registry.sh | 84 | Artifact CRUD + versioning |
| knowledge-lifecycle.sh | 59 | draft→validated→approved→deprecated |
| knowledge-index.sh | 64 | Index rebuild, stats, query |
| knowledge-search.sh | 45 | Keyword search with scoring |
| knowledge-reuse.sh | 50 | Suggest (approved-only), eligible |
| knowledge-memory.sh | 70 | Per-worker + cross-task memory |
| knowledge-lessons.sh | 59 | Pattern/anti-pattern capture |
| knowledge-graph.sh | 63 | Node/edge graph operations |
| knowledge-cross-project.sh | 56 | Cross-project references |
| worker-memory.sh | 65 | Worker memory + knowledge integration |
| worker-validation.sh | 58 | Worker self-validation + knowledge-validate |

**Total: 673 lines**

## Storage

- `.aic/knowledge/registry.json` — artifact registry
- `.aic/knowledge/index.json` — search index
- `.aic/knowledge/graph.json` — knowledge graph
- `.aic/knowledge/cross-project.json` — cross-project refs
- `.aic/knowledge/memory/store.json` — semantic memory
- `.aic/knowledge/lessons/` — lesson files
- `.aic/workers/<name>/memory.json` — per-worker memory

## Milestone I shall build from this baseline.
