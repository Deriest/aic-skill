# Milestone H — Knowledge & Artifact Platform Plan

**Status:** APPROVED FOR IMPLEMENTATION
**Date:** 2026-07-10
**Baseline:** Milestone G (commit 1365423)
**Investigation:** H-INVESTIGATION.md

---

## Objective

Build a lightweight knowledge platform for artifact lifecycle management, keyword-based search, knowledge reuse, and cross-project references.

---

## Architecture Decisions

### ADR-H-001: Knowledge Storage

**Decision:** JSON-based artifact registry in `.aic/knowledge/registry.json`

**Rationale:**
- Existing artifacts are flat files in `.aic/artifacts/` (7 files)
- No vector DB required at current scale
- JSON registry enables fast grep-based queries
- Extends existing `.aic/` directory convention

**Format:**
```json
{
  "artifacts": {
    "artifact-id": {
      "id": "artifact-id",
      "type": "requirement|design|plan|review|test|investigation|changelog",
      "title": "Human-readable title",
      "path": ".aic/artifacts/requirements.json",
      "version": "v1",
      "hash": "sha256:abc123",
      "status": "draft|validated|approved|deprecated",
      "created_by": "backend",
      "created_at": "2026-07-10T00:00:00Z",
      "tags": ["auth", "security"],
      "metadata": {}
    }
  }
}
```

**Reused:** Extends existing `worker-memory.sh` pattern (JSON key-value store)

---

### ADR-H-002: Search Strategy

**Decision:** Keyword-based full-text search using `grep` over registry JSON + artifact content

**Rationale:**
- `grep -r` already used in 6+ scripts (decision-engine.sh, changelog.sh, etc.)
- No external dependency (ripgrep available as `rg`)
- Tag-based filtering in registry enables fast narrowing
- Semantic search deferred — not required at current scale

**Implementation:**
- `knowledge-search.sh` — search by keyword, tag, type, worker, date
- `grep -rl` for content search, `jq` for registry metadata queries
- Returns ranked results by tag match count

**Skipped:** Vector embeddings, external search engines. Add when artifact count > 500.

---

### ADR-H-003: Artifact Versioning

**Decision:** Hash-based versioning with `sha256` content hash

**Rationale:**
- Git already tracks file history — no need to duplicate
- Content hash detects actual changes (not timestamp-based)
- Simple `sha256sum` available on all systems
- Version = sequential integer per artifact, hash = content fingerprint

**Format:**
```
version: 3
hash: sha256:abc123def456
```

**Skipped:** Git-like branching, merge, diff. Git handles that.

---

### ADR-H-004: Knowledge Graph

**Decision:** JSON-based graph in `.aic/knowledge/graph.json`

**Rationale:**
- Lightweight — no external graph DB
- Extends registry with relationships
- Worker memory already uses JSON

**Data Model:**
```
Node types: artifact, worker, decision, task
Edge types: created_by, depends_on, related_to, reviewed_by, supersedes
```

**Format:**
```json
{
  "nodes": [
    {"id": "artifact-id", "type": "artifact", "label": "Requirements"}
  ],
  "edges": [
    {"from": "artifact-id", "to": "backend", "type": "created_by"}
  ]
}
```

---

### ADR-H-005: Knowledge Lifecycle

**Decision:** 4-state lifecycle: Draft → Validated → Approved → Deprecated

**Rationale:**
- Matches existing PM Review workflow (PASS/REWORK)
- Validation = worker-validation.sh confirms artifact quality
- Approval = PM Review verdict
- Deprecation = explicit status change when superseded

**Transitions:**
```
Draft → Validated  (worker-validation.sh passes)
Validated → Approved  (PM Review PASS)
Approved → Deprecated  (newer version exists)
Any → Deprecated  (explicit deprecation)
```

**Enforcement:** `knowledge-lifecycle.sh` rejects invalid transitions

---

### ADR-H-006: Knowledge Reuse Policy

**Decision:** Suggest-then-approve model

**Rules:**
1. Only `approved` artifacts are eligible for reuse
2. Reuse suggestions ranked by tag overlap + keyword match
3. Worker must acknowledge suggestion (not auto-apply)
4. PM Review validates reused artifacts in new context
5. Reused artifact gets `referenced_by` edge in graph

**Conflict handling:** If two artifacts conflict, prefer newer version (higher version number)

---

### ADR-H-007: Cross-project References

**Decision:** Reference links between artifacts in different `.aic/` project directories

**Format:**
```json
{
  "project": "other-project-path",
  "artifact_id": "artifact-id",
  "relationship": "inspired_by|derived_from|references"
}
```

**Scope:** Knowledge sharing only, NOT multi-project runtime (that's Milestone J)

---

### ADR-H-008: Runtime Integration

**Decision:** Extend existing scripts, not replace

| Component | Integration |
|-----------|-------------|
| Dispatcher | `decision-engine.sh` queries knowledge for task routing |
| Worker Memory | `worker-memory.sh` stores knowledge references |
| Context Sharing | `context-sharing.sh` shares knowledge artifacts |
| Worker Registry | `worker-registry.sh` tracks knowledge capabilities |
| Runtime Auth | `api-auth.sh` protects knowledge API endpoints |
| PM Review | `pm-review.sh` validates knowledge lifecycle transitions |
| Dashboard | No redesign — add `/api/knowledge` endpoint only |

---

## Work Package Strategy

### H-1: Artifact Lifecycle

**Objective:** Versioned artifact storage with lifecycle states

**Files to create:**
- `scripts/knowledge-lifecycle.sh` — lifecycle state machine (Draft→Validated→Approved→Deprecated)
- `scripts/artifact-registry.sh` — register, version, query artifacts

**Files to modify:**
- `scripts/worker-validation.sh` — add `knowledge-validate` action
- `scripts/server.js` — add `/api/artifacts` endpoints (GET, POST, PUT)

**Dependencies:** Milestone F+G (COMPLETE)

**Completion criteria:**
- Artifacts registered with version + hash
- Lifecycle transitions enforced
- Invalid transitions rejected
- Registry queryable

---

### H-2: Knowledge Indexing

**Objective:** Index all artifacts by content and metadata

**Files to create:**
- `scripts/knowledge-index.sh` — build and update index from registry

**Files to modify:**
- `scripts/artifact-registry.sh` — auto-index on registration

**Dependencies:** H-1

**Completion criteria:**
- All artifacts indexed by type, tags, worker, date
- Index updates automatically on artifact change
- Index queryable via CLI

---

### H-3: Search

**Objective:** Keyword-based search over knowledge base

**Files to create:**
- `scripts/knowledge-search.sh` — search by keyword, tag, type, worker

**Dependencies:** H-2

**Completion criteria:**
- Keyword search returns ranked results
- Tag filtering works
- Type filtering works
- Content search via grep

---

### H-4: Reuse Engine

**Objective:** Suggest existing artifacts for new tasks

**Files to create:**
- `scripts/knowledge-reuse.sh` — find and suggest reusable artifacts

**Dependencies:** H-2 + H-3

**Completion criteria:**
- Suggestions based on tag overlap + keyword match
- Only `approved` artifacts suggested
- Suggestions ranked by relevance

---

### H-5: Semantic Memory

**Objective:** Persistent knowledge store with structured metadata

**Files to create:**
- `scripts/knowledge-memory.sh` — store/retrieve knowledge with metadata

**Files to modify:**
- `scripts/worker-memory.sh` — add `knowledge-store` and `knowledge-retrieve` actions

**Dependencies:** H-2

**Completion criteria:**
- Knowledge stored with structured metadata
- Retrieval by metadata query
- Integration with worker memory

---

### H-6: Lessons Learned

**Objective:** Auto-capture patterns and anti-patterns

**Files to create:**
- `scripts/knowledge-lessons.sh` — capture, query, and manage lessons

**Dependencies:** H-1 + H-5

**Completion criteria:**
- Lessons captured from PM Review verdicts
- Anti-patterns flagged during task routing
- Lessons queryable by topic

---

### H-7: Knowledge Graph

**Objective:** Graph of artifacts, workers, and decisions

**Files to create:**
- `scripts/knowledge-graph.sh` — build, query, update graph

**Dependencies:** H-1 + H-2

**Completion criteria:**
- Graph contains all artifacts + workers + decisions
- Edges represent real relationships
- Query returns related nodes

---

### H-8: Cross-project References

**Objective:** Link artifacts across projects

**Files to create:**
- `scripts/knowledge-cross-project.sh` — manage cross-project links

**Files to modify:**
- `scripts/artifact-registry.sh` — add cross-project reference support

**Dependencies:** H-7

**Completion criteria:**
- Cross-project links stored in registry
- References queryable
- Knowledge sharing between projects works

---

## Repository Impact Summary

### Files to Create (8)

| File | WP | Purpose |
|------|-----|---------|
| `scripts/artifact-registry.sh` | H-1 | Artifact registration + versioning |
| `scripts/knowledge-lifecycle.sh` | H-1 | Lifecycle state machine |
| `scripts/knowledge-index.sh` | H-2 | Build/update knowledge index |
| `scripts/knowledge-search.sh` | H-3 | Keyword search |
| `scripts/knowledge-reuse.sh` | H-4 | Suggest reusable artifacts |
| `scripts/knowledge-memory.sh` | H-5 | Persistent knowledge store |
| `scripts/knowledge-lessons.sh` | H-6 | Lessons learned capture |
| `scripts/knowledge-graph.sh` | H-7 | Knowledge graph |
| `scripts/knowledge-cross-project.sh` | H-8 | Cross-project references |

### Files to Modify (4)

| File | WP | Change |
|------|-----|--------|
| `scripts/worker-validation.sh` | H-1 | Add knowledge-validate action |
| `scripts/server.js` | H-1 | Add /api/artifacts + /api/knowledge endpoints |
| `scripts/worker-memory.sh` | H-5 | Add knowledge-store/retrieve actions |
| `scripts/artifact-registry.sh` | H-8 | Add cross-project ref support |

### Files Unchanged (20+)

All other scripts remain unchanged. Dashboard unchanged.

---

## Verification Strategy

**Method:** Ad-hoc verification script after all implementation

**Checks:**
1. All new scripts pass `bash -n` syntax check
2. All modified scripts pass `bash -n` syntax check
3. Artifact registration + versioning works
4. Lifecycle transitions enforced
5. Search returns results
6. Reuse suggestions accurate
7. Knowledge graph buildable and queryable
8. Cross-project references work
9. No regression in existing scripts
10. Dashboard still loads

---

## Runtime OAT Strategy

**Task:** "Analyze the AIC codebase and produce a knowledge-enhanced design document"

**Flow:**
1. Worker creates artifact → registered in knowledge system
2. Another worker searches knowledge → finds related artifact
3. Worker reuses knowledge → artifact referenced
4. PM Review validates → lifecycle transitions
5. Lessons captured from review
6. Graph updated with relationships
7. Cross-project reference created

**Evidence:** Real opencode execution, real artifacts, real knowledge operations

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| JSON registry performance | LOW | Current scale small; optimize if > 500 artifacts |
| Lifecycle state conflicts | LOW | Single-process server, no concurrent state issues |
| Search accuracy | MEDIUM | Tag-based filtering + keyword search; add vectors later |
| Regression from H changes | LOW | Minimal file modifications; existing scripts unchanged |
| Complexity creep | MEDIUM | Each WP is independent; can ship incrementally |

---

## Cross Validation

| Check | Result |
|-------|--------|
| H Investigation → H Plan | ✅ All gaps addressed |
| H Plan → Master Roadmap | ✅ 8 WPs match roadmap |
| H Plan → Master Planning | ✅ No scope creep |
| H vs Milestone I | ✅ No overlap (I = Monitoring) |
| H vs Milestone J | ✅ No overlap (J = Enterprise) |

---

## Exit Criteria

- [ ] All 8 WPs implemented
- [ ] All new scripts syntax-checked
- [ ] Artifact lifecycle working
- [ ] Knowledge search working
- [ ] Knowledge reuse working
- [ ] Knowledge graph working
- [ ] Cross-project references working
- [ ] Runtime OAT PASS
- [ ] No regression

---

## Final Decision

**Milestone H Planning = COMPLETE**

**Ready for Implementation**
