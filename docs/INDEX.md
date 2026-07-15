# Documentation Index

## Product Documentation

- [API Reference](api/api-reference.md) — All 27 endpoints (21 core + 6 observability)
- [Architecture Overview](architecture/architecture-overview.md) — System design, current
- [Developer Guide](guides/developer-guide.md) — Setup & conventions
- [Operations Guide](operations/operations-guide.md) — Deployment, monitoring, recovery
- [Operator Guide](guides/operator-guide.md) — Task management, dashboard usage
- [Version policy](guides/version-policy.md) — Product vs runtime vs skill semver
- [Operations Runbook](operations/operations-runbook.md) — Troubleshooting, escalation
- [.env.example](../.env.example) — Production configuration template
- [Assets](assets/) — Dashboard screenshots

## Reference Documents

- [references/](../references/) — Active reference docs (FIX/IMP lineage, pitfalls, patterns) — 105 files
- [templates/](../templates/) — Worker artifact templates + phase-contracts seed
- [archive/](../archive/) — Historical (milestones, runtime-stabilization, platform-experiments, defects, release-readiness, ops)

## Runtime Observability (WP-80)

- [Architecture Plan](wp-80-architecture-plan.md) — Runtime Observability Platform blueprint
- [Runtime Observability Reference](../references/runtime-observability-wp80.md) — When to load, key findings, architecture summary

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
