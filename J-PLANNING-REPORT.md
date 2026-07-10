# Milestone J — Planning Report

**Status:** COMPLETE
**Date:** 2026-07-10

---

## Architecture Decisions

### AD-1: Project Registry Model
**Decision:** JSON file registry (`.aic/projects.json`) with project entries.
**Rationale:** Matches existing `active-project.json` pattern. No database dependency.
**Each entry:** `{ id, name, dir, branch, status, created_at, updated_at }`

### AD-2: Workspace Hierarchy
**Decision:** `Workspace → Projects → Tasks` with `.aic/workspaces/<id>/` per workspace.
**Rationale:** Filesystem isolation. Each workspace owns its `.aic/` subtree.
**Config:** `.aic/workspaces/<id>/config.json`

### AD-3: RBAC Model
**Decision:** 4-role model: `admin > lead > member > viewer`
**Rationale:** Simple, covers enterprise needs without complexity.
**Permission matrix:** defined per action category (project, workspace, worker, admin).

### AD-4: Audit Extension
**Decision:** Extend existing `audit-log` action with query/export capabilities.
**Rationale:** Audit.log already exists. Add structured fields (user, action, resource, result).

### AD-5: Resource Model
**Decision:** Token quotas per workspace, tracked via existing `metrics.sh`.
**Rationale:** Metrics already tracks per-worker tokens. Add workspace-level aggregation.

### AD-6: Multi-dispatcher Coordination
**Decision:** Shared state file (`.aic/dispatcher-registry.json`) with project ownership.
**Rationale:** Single-machine first. Each dispatcher owns N projects. No distributed consensus.

### AD-7: Distributed Worker Transport
**Decision:** Abstract transport interface with local executor (existing) and SSH executor stub.
**Rationale:** SSH transport is the minimal viable remote execution. No cloud dependency.

### AD-8: Enterprise Deployment (Native)
**Decision:** Native Linux deployment only. No containers.
**Rationale:** Simpler operational model. `setup.sh` pattern extended with install/upgrade/backup procedures.
**Scope:** Installation guide, startup/shutdown procedures, upgrade procedure, backup/restore, environment profiles, production configuration, deployment validation.
**Out of Scope:** Docker, Dockerfile, docker-compose, Kubernetes, Podman, OCI, Helm, container images.

---

## Work Package Execution Order

| Order | WP | Rationale |
|-------|-----|----------|
| 1 | J-1 Multi-project | Foundation — all other WPs depend on this |
| 2 | J-2 Workspace | Isolation layer for teams |
| 3 | J-4 Permissions | RBAC before collaboration |
| 4 | J-3 Collaboration | Requires project + workspace + permissions |
| 5 | J-5 Audit | Requires permissions for traceability |
| 6 | J-6 Resource Management | Requires project + permissions |
| 7 | J-7 Multi-dispatcher | Requires multi-project |
| 8 | J-8 Distributed Workers | Requires multi-dispatcher |
| 9 | J-9 Enterprise Deployment | Requires all above |

---

## Work Package Plans

### J-1 Multi-project Management

**Objective:** Support multiple concurrent projects with a registry and lifecycle.

**Repository Impact:**
- CREATE: `scripts/project-manager.sh` (~120 lines)
- MODIFY: `scripts/server.js` (+60 lines: /api/projects, /api/projects/:id, project middleware)
- CREATE: `.aic/projects.json` (runtime state)

**Dependencies:** None (foundation WP)

**Implementation Strategy:**
1. `project-manager.sh`: actions — `register`, `list`, `select`, `archive`, `delete`, `status`
2. Project registry stored in `.aic/projects.json`
3. `/api/projects` GET (list), POST (register)
4. `/api/projects/:id` GET (detail), PUT (update), DELETE (archive)
5. `/api/projects/select/:id` POST (set active project)
6. Extend `active-project.json` with `project_id` field

**Completion Criteria:**
- Register 2+ projects
- Switch between projects via CLI and API
- Each project has independent `.aic/` state
- Archive/delete lifecycle works

---

### J-2 Workspace Management

**Objective:** Isolated workspaces per team with own configuration.

**Repository Impact:**
- CREATE: `scripts/workspace.sh` (~100 lines)
- MODIFY: `scripts/server.js` (+40 lines: /api/workspaces)
- CREATE: `.aic/workspaces/<id>/config.json`

**Dependencies:** J-1

**Implementation Strategy:**
1. `workspace.sh`: actions — `create`, `list`, `config`, `delete`
2. Each workspace has `.aic/workspaces/<id>/config.json`
3. Projects belong to exactly one workspace
4. `/api/workspaces` GET (list), POST (create)
5. `/api/workspaces/:id/config` GET/PUT

**Completion Criteria:**
- Create 2+ workspaces
- Each workspace has isolated config
- Projects assigned to workspaces
- Workspace deletion archives projects

---

### J-4 Permission Model

**Objective:** RBAC with 4 roles: admin, lead, member, viewer.

**Repository Impact:**
- CREATE: `scripts/permissions.sh` (~100 lines)
- MODIFY: `scripts/server.js` (+80 lines: RBAC middleware)
- MODIFY: `scripts/auth.js` (+30 lines: role field in API keys)
- CREATE: `.aic/permissions.json` (role assignments)

**Dependencies:** J-2

**Implementation Strategy:**
1. `permissions.sh`: actions — `assign`, `revoke`, `check`, `list-roles`, `list-perms`
2. Role → permission matrix:
   - admin: all actions
   - lead: project CRUD, worker management, audit
   - member: task execution, artifact creation, knowledge
   - viewer: read-only API access
3. RBAC middleware in server.js checks role before handler
4. API keys extended with `role` field
5. `/api/permissions` GET (matrix), POST (assign)

**Completion Criteria:**
- 4 roles defined with permission matrix
- API key includes role
- Unauthorized requests return 403
- Role assignment via CLI and API

---

### J-3 Collaboration

**Objective:** Multi-user coordination on shared projects.

**Repository Impact:**
- CREATE: `scripts/collaboration.sh` (~80 lines)
- MODIFY: `scripts/server.js` (+30 lines: /api/collaboration)

**Dependencies:** J-1, J-2, J-4

**Implementation Strategy:**
1. `collaboration.sh`: actions — `share`, `lock`, `unlock`, `status`
2. Shared artifacts: project artifacts visible to all workspace members
3. Lock mechanism: prevent concurrent writes to same artifact
4. Knowledge sharing: reuse `knowledge-cross-project.sh`
5. `/api/collaboration/lock` POST (acquire), DELETE (release)

**Completion Criteria:**
- Two users can see shared project artifacts
- Lock prevents concurrent writes
- Knowledge shared across workspace members

---

### J-5 Audit Platform

**Objective:** Enterprise audit with queries, history, and traceability.

**Repository Impact:**
- CREATE: `scripts/audit-platform.sh` (~80 lines)
- MODIFY: `scripts/server.js` (+30 lines: /api/audit)
- MODIFY: `scripts/security-governance.sh` (+20 lines: structured fields)

**Dependencies:** J-4

**Implementation Strategy:**
1. Extend audit-log entries: `{ timestamp, user, role, action, resource, result, project_id }`
2. `audit-platform.sh`: actions — `query`, `export`, `history`, `stats`
3. Query by: user, action, resource, time range, project
4. Export: JSON and CSV formats
5. `/api/audit` GET (query with filters)
6. `/api/audit/export` GET (download)

**Completion Criteria:**
- Audit entries include user, role, project_id
- Query by user/action/time returns results
- Export works in JSON and CSV
- No audit gaps during multi-project execution

---

### J-6 Resource Management

**Objective:** Per-workspace resource quotas and allocation.

**Repository Impact:**
- CREATE: `scripts/resource-manager.sh` (~100 lines)
- MODIFY: `scripts/server.js` (+40 lines: /api/resources)

**Dependencies:** J-1, J-4

**Implementation Strategy:**
1. `resource-manager.sh`: actions — `set-quota`, `get-usage`, `check-limit`, `list`
2. Quota model: `{ workspace_id, max_tokens_per_day, max_workers, max_projects }`
3. Track usage via existing `metrics.sh` aggregation
4. Check limits before worker spawn
5. `/api/resources/usage` GET (current usage)
6. `/api/resources/quota` GET/PUT (workspace quotas)

**Completion Criteria:**
- Workspace quota set and enforced
- Usage tracked per workspace
- Limit exceeded returns error before execution
- Quota visible via CLI and API

---

### J-7 Multi-dispatcher

**Objective:** Multiple dispatcher instances for project isolation.

**Repository Impact:**
- CREATE: `scripts/dispatcher-orchestrator.sh` (~100 lines)
- MODIFY: `scripts/server.js` (+50 lines: dispatcher registry)
- CREATE: `.aic/dispatcher-registry.json`

**Dependencies:** J-1

**Implementation Strategy:**
1. `dispatcher-orchestrator.sh`: actions — `register`, `list`, `assign`, `status`, `health`
2. Each dispatcher registered with `{ id, port, projects[], status }`
3. Dispatcher owns specific projects
4. Coordination via shared `.aic/dispatcher-registry.json`
5. `/api/dispatchers` GET (list), POST (register)
6. `/api/dispatchers/:id/projects` GET (assigned projects)

**Completion Criteria:**
- Register 2+ dispatcher entries
- Each dispatcher owns specific projects
- Dispatcher status tracked
- Project-to-dispatcher assignment works

**Limitation:** Single-process server. Multiple dispatchers are logical, not separate processes. Distributed dispatchers belong to future milestone.

---

### J-8 Distributed Workers

**Objective:** Abstract worker transport with local + SSH executors.

**Repository Impact:**
- CREATE: `scripts/worker-distributor.sh` (~120 lines)
- MODIFY: `scripts/spawn-worker.sh` (+30 lines: transport abstraction)
- CREATE: `references/distributed-worker-architecture.md`

**Dependencies:** J-7

**Implementation Strategy:**
1. Transport interface: `execute(worker, tier, prompt, target)` → `local | ssh`
2. Local executor: existing `spawn-worker.sh` behavior (no change)
3. SSH executor: `ssh <target> "cd <dir> && opencode < prompt"` pattern
4. `worker-distributor.sh`: actions — `register-target`, `list-targets`, `spawn-remote`, `health`
5. Target registry: `.aic/worker-targets.json` with `{ id, host, user, key_path, status }`
6. Health check: SSH connectivity test

**Completion Criteria:**
- Transport abstraction defined
- Local execution unchanged (regression-free)
- SSH executor stub functional for localhost
- Target registry works
- Health check reports target status

**Limitation:** Production SSH transport requires key management. This WP establishes the abstraction; production hardening is deferred.

---

### J-9 Enterprise Deployment (Native)

**Objective:** Native Linux deployment with complete operational procedures.

**Repository Impact:**
- CREATE: `scripts/deploy.sh` (~100 lines)
- CREATE: `references/deployment-guide.md`

**Dependencies:** J-7, J-8

**Implementation Strategy:**
1. `deploy.sh`: actions — `install`, `start`, `stop`, `upgrade`, `backup`, `restore`, `validate`, `status`
2. Installation: copy scripts, configure environment, create .aic/ structure
3. Startup: node server.js with production config, health check validation
4. Shutdown: graceful shutdown with state persistence
5. Upgrade: backup → stop → update → migrate → start → validate
6. Backup/Restore: tarball .aic/ state with timestamp
7. Environment profiles: `dev`, `staging`, `prod` via AIC_ENV variable
8. Production configuration: optimized config.sh defaults
9. Deployment validation: health check + auth + queue + metrics
10. Deployment guide: complete native setup documentation

**Completion Criteria:**
- `deploy.sh install` sets up clean environment
- `deploy.sh start/stop` lifecycle works
- `deploy.sh upgrade` preserves state
- `deploy.sh backup/restore` roundtrips
- Environment profiles affect configuration
- Deployment validation passes all checks
- Deployment guide complete (no container references)

---

## Repository Impact Summary

| Action | Files | Est. Lines |
|--------|-------|-----------|
| CREATE | project-manager.sh | 120 |
| CREATE | workspace.sh | 100 |
| CREATE | permissions.sh | 100 |
| CREATE | collaboration.sh | 80 |
| CREATE | audit-platform.sh | 80 |
| CREATE | resource-manager.sh | 100 |
| CREATE | dispatcher-orchestrator.sh | 100 |
| CREATE | worker-distributor.sh | 120 |
| CREATE | scripts/deploy.sh | 100 |
| CREATE | references/deployment-guide.md | 50 |
| CREATE | references/distributed-worker-architecture.md | 40 |
| MODIFY | server.js | +330 |
| MODIFY | auth.js | +30 |
| MODIFY | security-governance.sh | +20 |
| MODIFY | spawn-worker.sh | +30 |

**Total: +12 new files, +4 modified files, ~1,270 new lines**

---

## Verification Strategy

One milestone-level verification after all 9 WPs:
1. Register/select/switch multiple projects
2. Create/switch workspaces with isolation
3. RBAC enforcement (admin vs viewer)
4. Audit trail for all operations
5. Resource quota enforcement
6. Dispatcher registration and assignment
7. Local + SSH worker execution
8. deploy.sh install/start/stop/upgrade cycle
9. Regression: all E/F/G/H/I capabilities preserved

---

## Runtime OAT Strategy

One real Runtime OAT:
1. Register 2 projects in different workspaces
2. Assign admin + member roles
3. Execute task in project A with member role
4. Verify viewer role cannot execute
5. Verify audit trail captures all actions
6. Verify resource usage tracked
7. Verify project switching works mid-session
8. Verify dashboard reflects multi-project state
9. deploy.sh upgrade → verify state preserved

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| server.js complexity growth | High | Keep middleware pattern, max 100 lines per new section |
| RBAC bypass | High | Middleware-first, fail-closed default |
| Multi-project state corruption | Medium | File locks on registry writes |
| SSH transport security | Medium | Abstraction only, no hardcoded keys |
| Regression in E/F/G/H/I | Medium | Extension-only, no rewrites |
| deploy.sh complexity | Low | Simple bash, reuse setup.sh pattern |

---

## Success Criteria

- 9 Work Packages implemented
- Multiple concurrent projects functional
- Workspace isolation verified
- RBAC enforced (403 for unauthorized)
- Audit trail complete with queries
- Resource quotas enforced
- Multi-dispatcher registration works
- SSH transport abstraction functional
- Docker build + deploy works
- Zero regression in E/F/G/H/I

---

## Exit Criteria

- Implementation COMPLETE
- Verification PASS
- Runtime OAT PASS
- PM Final Review PASS
- Documentation Synced
- Committed and pushed

---

## Final Decision

**Milestone J Planning = COMPLETE**

Ready for Implementation.
