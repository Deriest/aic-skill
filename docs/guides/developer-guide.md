# Developer Guide

## Prerequisites

- Node.js 18+
- opencode CLI
- API key (in .aic/auth.json)

## Repository Layout

```
scripts/
├── server.js              # API server + dispatcher
├── spawn-worker.sh        # Worker spawning (with retry)
├── spawn-sub.sh           # Sub-agent spawning
├── pipeline-orchestrator.sh  # Pipeline execution
├── phase-runner.sh        # Phase execution
├── deploy.sh              # Deployment management
├── queue.sh               # Task queue CLI
├── stress-test.sh         # Stress testing
├── knowledge-*.sh         # Knowledge platform
├── worker-*.sh            # Worker management
├── dispatcher-*.sh        # Dispatcher utilities
├── ops-endpoints.js       # Additional API endpoints
└── enterprise-endpoints.js # Enterprise API endpoints

.aic/
├── auth.json              # API keys
├── projects.json          # Project registry
├── permissions.json       # RBAC matrix
├── tasks/                 # Task state + reports
└── knowledge/             # Knowledge base

docs/                      # Product documentation
references/                # Reference documents
templates/                 # Document templates
archive/                   # Historical reports
```

## Coding Conventions

- Shell scripts: bash with `set -euo pipefail`
- JavaScript: Node.js CommonJS (require/module.exports)
- Error handling: try-catch in JS, trap in bash
- Logging: structured JSON to .aic/logs/
- Auth: X-API-Key header on all /api/* endpoints

## Testing

- Syntax: `bash -n script.sh` / `node --check script.js`
- Deploy: `bash scripts/deploy.sh validate`
- Stress: `bash scripts/stress-test.sh`
- API: curl with X-API-Key header

## Extension Points

- New worker roles: add to WORKER_MAP in spawn-worker.sh
- New API endpoints: add to server.js or ops-endpoints.js
- New pipeline phases: add to pipeline-orchestrator.sh
- New knowledge operations: add to knowledge-*.sh
