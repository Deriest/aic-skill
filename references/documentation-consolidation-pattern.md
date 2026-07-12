# Documentation Consolidation Pattern (Milestone L)

## Purpose
Reorganize repository documentation after milestone completion. Separate product docs from engineering history.

## Trigger
When milestone reports, investigation docs, and verification reports clutter the repository root.

## Classification Matrix

Every document gets exactly one category:

| Category | Location | Purpose |
|----------|----------|---------|
| PRODUCT | `docs/` | Daily-use docs (API, architecture, guides) |
| REFERENCE | `references/` | ADRs, runbooks, architecture references |
| ACTIVE PROJECT | root (limited) | SKILL.md, AGENTS.md, README, CHANGELOG, BASELINE, MASTER-PLANNING |
| ENGINEERING HISTORY | `archive/milestones/<L>/` | Investigation, planning, verification, closeout, OAT reports |
| ARCHIVE | `archive/` | Superseded reports, consolidated defects |

## Target Root Directory

Root should contain ONLY:
- SKILL.md, AGENTS.md (workspace rules)
- README.md, CHANGELOG.md (entry points)
- MASTER-PLANNING.md, MASTER-PLANNING-KM-REVIEW.md (active plan)
- BASELINE-K.md (current baseline)

**Target: ≤7 files in root.** Everything else moves.

## Documentation Hierarchy (Final)

```
docs/
├── api/api-reference.md          # All endpoints, auth, response formats
├── architecture/architecture-overview.md  # System design, components, data flow
├── guides/developer-guide.md     # Setup, repo layout, coding conventions
├── guides/operator-guide.md      # Task management, dashboard usage
├── operations/operations-guide.md # Deploy, monitoring, recovery
└── INDEX.md                      # Documentation entry point
```

## Archive Organization

```
archive/
├── milestones/
│   ├── H/          # Per-milestone reports
│   ├── I/
│   ├── J/
│   ├── K/
│   └── L/          # Include rework reports
└── defects/        # Consolidated DF + audit reports
```

## Pitfalls

### 1. L-1 only archives superseded reports, not ALL history
The first archive pass typically catches superseded OAT reports and baselines. A follow-up audit catches the remaining engineering history in root. Plan for a rework cycle.

### 2. Engineering history ≠ system docs
User correction: "itu di luar soul md untuk worker kan?" — Milestone reports, investigation docs, DF reports are development artifacts, not part of the AIC runtime. They belong in archive, not in the active codebase.

### 3. Documentation Inventory Audit before closeout
Run a documentation inventory audit BEFORE verification. Classify every .md file. This catches files that L-1 missed. Without this audit, verification passes but root is still bloated.

### 4. No content rewriting during consolidation
Move files only. Do NOT rewrite engineering history. Do NOT change document contents. Merge only duplicated information (e.g., 3 pitfall variants → 1 consolidated doc).

## Verification

After consolidation, verify:
- Root .md count ≤ 7
- All 10 coverage areas documented (Runtime, Dispatcher, Workers, Knowledge, Enterprise, API, Operations, Development, Deployment, Operator)
- No broken references (relative paths updated after moves)
- Archive organized by milestone

## Merge Strategy

Only merge truly duplicated content:
- Multiple OAT reports per milestone → keep final, archive rest
- Multiple defect reports → consolidate into DF-001-FINAL.md
- Multiple pitfall variants → merge into single server-modification-pitfalls.md
- Multiple audit reports → consolidate into AUDIT-FINAL.md

Source documents always referenced in the consolidated doc header.
