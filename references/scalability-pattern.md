# Scalability Pattern — AIC

## Current Architecture
Single-process Node.js server (server.js) on port 6868.

## Scaling Strategy

### Phase 1: Async I/O (Milestone I)
- Convert synchronous file reads to fs.promises
- In-memory cache for hot paths
- Pre-aggregate metrics on write

### Phase 2: Cluster Mode (Milestone I, optional)
- Node.js cluster module behind --cluster flag
- Shared file-based state
- Instance ID in health endpoint

### Phase 3: Multi-Instance (Milestone J)
- External load balancer
- Shared state store
- Distributed workers

## Constraints
- Milestone I: single-process only
- Milestone J: distributed execution allowed

## File-Based State
All state is file-based (.aic/*.json), enabling:
- Crash recovery (files survive process restart)
- Backup/restore (copy directory)
- Future migration to external store
