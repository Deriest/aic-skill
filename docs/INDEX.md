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

- [references/](../references/) — Active reference docs (23 files)
- [references/archive/](../references/archive/) — Archived originals (135 files)
- [templates/](../templates/) — Worker artifact templates + phase-contracts seed

## EIP Reports

- [EIP Master Program](../reports/eip-master-program.md) — Charter, scope, governance
- [EIP Master Investigation](../reports/eip-master-investigation.md) — 62 findings baseline
- [EIP Master Planning](../reports/eip-master-planning.md) — 49 work items, 4 phases
- [EIP-1 Reliability](../reports/eip-1-reliability.md) — 20/20 items complete
- [EIP-2 Architecture](../reports/eip-2-architecture.md) — 11/12 items complete
- [EIP-3 Performance](../reports/eip-3-performance.md) — 7/8 items complete
- [EIP-4 Excellence](../reports/eip-4-excellence.md) — Implementation report

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
