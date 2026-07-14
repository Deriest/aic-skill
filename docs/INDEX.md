# Documentation Index

## Product Documentation

- [API Reference](api/api-reference.md) — All 21 endpoints
- [Architecture Overview](architecture/architecture-overview.md) — System design, current
- [Developer Guide](guides/developer-guide.md) — Setup & conventions
- [Operations Guide](operations/operations-guide.md) — Deployment, monitoring, recovery
- [Operator Guide](guides/operator-guide.md) — Task management, dashboard usage
- [Operations Runbook](operations/operations-runbook.md) — Troubleshooting, escalation
- [.env.example](../.env.example) — Production configuration template
- [Assets](assets/) — Dashboard screenshots

## Reference Documents

- [references/](../references/) — Active reference docs (FIX/IMP lineage, pitfalls, patterns) — 105 files
- [templates/](../templates/) — Worker artifact templates + phase-contracts seed
- [archive/](../archive/) — Historical (milestones, runtime-stabilization, platform-experiments, defects, release-readiness, ops)

## Governance

- [Production Readiness Cleanup WP-101](../references/production-readiness-cleanup-wp101.md) — Hygiene & archive pattern
- [Phase Contracts](../templates/phase-contracts/) — Canonical JSON (investigate.json, implementation.json) → runtime `.aic/phase-contracts/`
- Knowledge ledger `knowledge/task-entries.json` — generated, ignored (see .gitignore)

## Quick Start

```bash
cp .env.example .env
# Edit .env: PROVIDER=aic, API_KEY, MODEL_THINKER/CRAFTER/SPRINTER
bash scripts/setup.sh
bash scripts/deploy.sh start
curl http://localhost:6868/health
```
