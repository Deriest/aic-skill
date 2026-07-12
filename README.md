# AI Engineering Company (AIC)

> A multi-agent AI software engineering workforce, orchestrated from your terminal.

AIC transforms [Hermes Agent](https://hermes-agent.nousresearch.com) into a full engineering company — a Dispatcher, Product Manager, Architect, Engineers, QA, and Governor — all working through a structured 5-phase pipeline. Describe what you want in natural language; AIC builds it.

---

## Key Features

- **AI Engineering Organization** — 15 specialized roles across Leadership, Product, Engineering, and Platform tiers
- **Dispatcher Intelligence** — Natural language task routing with automatic classification and worker delegation
- **Multi-Agent Workforce** — Parallel and sequential execution with role-specific model tiers (Thinker, Crafter, Sprinter)
- **5-Phase Pipeline** — Investigate → Planning → Implementation → Verification → Closeout
- **Knowledge Platform** — Persistent knowledge base with search, statistics, and task-triggered ingestion
- **Multi-Project Management** — Switch target projects without restarting; per-project task tracking
- **Runtime Monitoring** — Live worker status, pipeline progress, and runtime gate tracking
- **Performance Metrics** — Memory, CPU, request throughput, and token usage
- **Cost Tracking** — Per-worker input/output/cache token breakdown with time-filtered charts
- **Task History** — Paginated task records with expandable context, work package trees, and resume support
- **Configuration Management** — Runtime config viewer with environment, project, and model tier settings
- **Pixel Office Dashboard** — Retro-themed real-time control panel at `localhost:6868`

---

## Dashboard

Live at `http://localhost:6868` after starting AIC.

![Dashboard Overview](./dashboard-overview-v2.png)

| Page | Description |
|------|-------------|
| **Overview** | Virtual office floor, live pipeline status, performance metrics, and worker statistics |
| **History** | Paginated task list with status badges, expandable details, and resume support |
| **Costs** | Per-worker token breakdown (input/output/cache), time-filtered charts, and cache hit rates |
| **Configuration** | Environment settings, model tier assignments, and project configuration |

---

## Architecture

```
User (natural language)
    ↓
Dispatcher (Hermes) — task classification, routing, orchestration
    ↓
Pipeline (5 phases) — lifecycle enforcement, phase barriers
    ↓
Workers (15 roles) — Thinker / Crafter / Sprinter model tiers
    ↓
Knowledge Base — persistent context, search, ingestion
    ↓
Dashboard — real-time monitoring, metrics, configuration
```

Detailed architecture: [Architecture Overview](./docs/architecture/architecture-overview.md)

---

## Quick Start

### Prerequisites

| Dependency | Required | Check |
|------------|----------|-------|
| Hermes Agent | Yes | `hermes --version` |
| Node.js + npm | Yes | `node --version` |
| OpenCode CLI | Yes | `opencode --version` |
| jq | Yes | `jq --version` |

### Install

```bash
# 1. Clone
git clone --depth 1 https://github.com/Deriest/aic-skill.git ~/.hermes/skills/workflows/aic

# 2. Setup (interactive — configures provider, models, environment)
bash ~/.hermes/skills/workflows/aic/scripts/setup.sh

# 3. Build dashboard
cd ~/.hermes/skills/workflows/aic/dashboard && npm install && npm run build
```

### Start

```
You:  /aic

Hermes: [Preflight Check — server started]
        Set your target project: /aic project <path>

You:  /aic project ~/my-app

Hermes: Project set. What task can I help with?
```

### Commands

| Command | Description |
|---------|-------------|
| `/aic` | Activate Dispatcher, run preflight, start server |
| `/aic project <path>` | Set or switch target project |
| `/aic status` | Show current pipeline status |
| `/aic status task <TASK-ID>` | Show task details |
| `/aic continue` | Resume last interrupted task |
| `/aic stop` | Deactivate Dispatcher |

---

## Repository Structure

```
├── dashboard/          # Pixel Dashboard (React + Vite + Tailwind)
├── docs/               # Documentation (API, architecture, guides, operations)
├── knowledge/          # Knowledge base scripts
├── references/         # Reference documents
├── scripts/            # Runtime scripts (server, pipeline, workers, setup)
├── templates/          # Document templates
├── aic                 # CLI entry point
├── SKILL.md            # Hermes skill definition
└── README.md
```

---

## Documentation

Entry point: [docs/INDEX.md](./docs/INDEX.md)

| Guide | Description |
|-------|-------------|
| [API Reference](./docs/api/api-reference.md) | All 21 endpoints, authentication, response formats |
| [Architecture Overview](./docs/architecture/architecture-overview.md) | System design, components, data flow |
| [Developer Guide](./docs/guides/developer-guide.md) | Setup, repository layout, coding conventions |
| [Operations Guide](./docs/operations/operations-guide.md) | Deployment, monitoring, recovery |
| [Operator Guide](./docs/guides/operator-guide.md) | Task management, dashboard usage |
| [Operations Runbook](./references/operations-runbook.md) | Troubleshooting, escalation procedures |

---

## Roadmap

- Live Dashboard Events
- WebSocket Real-Time Updates
- Enhanced Observability
- Dashboard UX Improvements
- Plugin Ecosystem

---

## License

MIT — See [LICENSE](./LICENSE)

---

<p align="center">
  <i>Built with <a href="https://hermes-agent.nousresearch.com">Hermes Agent</a> by Nous Research</i><br/>
  <i>AIC originally ported from OpenClaw plugin by TVD</i>
</p>
