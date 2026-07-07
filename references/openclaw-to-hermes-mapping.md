# OpenClaw → Hermes Migration Map

## Concept Mapping

| OpenClaw Concept | Hermes Equivalent | Notes |
|---|---|---|
| `openclaw.json` agents list | 10 Hermes profiles or delegate_task | Profiles for isolation, delegate_task for on-demand |
| Per-agent SOUL.md | `SOUL.md` in profile home | Auto-loaded by Hermes |
| Per-agent AGENTS.md | `AGENTS.md` in workdir | Auto-injected as project context |
| Per-agent IDENTITY.md | Merge into SOUL.md | Hermes SOUL.md covers identity |
| Per-agent USER.md | Not needed | Hermes handles operator context |
| Per-agent TOOLS.md | Hermes toolsets | `hermes tools enable/disable` |
| Per-agent config.json | Profile `config.yaml` | `model.default`, toolsets, etc. |
| `sessions_spawn` | `delegate_task` or `opencode run` | delegate_task for thinking, opencode for coding |
| Workboard plugin | Hermes Kanban | `hermes kanban` built-in |
| 9Router provider | Custom provider in config.yaml | `model.base_url` + `model.api_key` |
| Model routing (Opus/Sonnet/Haiku) | Per-worker model override | In delegate_task context or opencode --model |

## Key Architectural Difference

**OpenClaw:** Workers are always-running agents with persistent sessions. They collaborate directly with each other. Dispatcher routes messages between workers.

**Hermes:** Workers are spawned on-demand (zero idle cost). They are isolated — they report back to the Dispatcher only. Dispatcher relays information between workers. This is simpler and cheaper but means the Dispatcher must carry all cross-worker context.

## File Location Differences

| OpenClaw | Hermes |
|---|---|
| `~/.openclaw/plugins/<name>/` | `~/.hermes/skills/workflows/<name>/` |
| `openclaw.json` agents config | `SOUL.md` per profile + skill definitions |
| Per-agent workspace dirs | `workdir` parameter on delegate_task/opencode |
| `sessions_spawn` config in JSON | delegate_task call parameters |
