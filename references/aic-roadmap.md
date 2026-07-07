# AIC Improvement Roadmap

**Visi:** AI Engineering Company — user non-coder ngomong apa saja, AIC translate jadi software yang jalan.

**Misi:** Orchestration system yang handle SEMUA fase pengembangan software — dari ide sampai production — tanpa user perlu paham coding, tooling, atau workflow.

**Target User:** Non-coder. Mereka bilang "saya mau bikin toko online", AIC handle sisanya.

## Core Principle

User **TIDAK perlu:** tahu task type, workflow, teknologi, prompt engineering, Git, CI/CD
User **cukup:** ngomong apa yang dia mau, review hasilnya, approve kalau diminta

**PM Head** = translator utama (natural language → engineering specs). Menggantikan Task Templates.

---

## Phase 1: Core Engine (~1.5h)
1. **Task Queue** — in-memory priority queue, auto-dequeue
2. **Task Cancellation** — kill worker, cleanup, report
3. **File Snapshot & Rollback** — snapshot before edit, restore on failure
4. **Circuit Breaker** — 3x fail → auto-downgrade tier or skip

## Phase 2: Intelligence (~2h)
1. **PM Natural Language Parser** — strengthen PM to translate vague input → structured specs
2. **Parallel Phase Batching** — auto-detect independent phases, batch parallel
3. **Structured Artifact Passing** — JSON artifacts between phases
4. **Dynamic Tier Selection** — complexity-based tier per worker
5. **Task History Analytics** — analyze history.json for patterns
6. **ETA Estimation** — estimate remaining time from history

## Phase 3: Developer Experience (~1.5h)
1. **Git Integration** (optional) — if user has ghp_ token, auto branch/commit/PR
2. **DAG Task Dependencies** — A → [B, C] → D graphs
3. **Worker Config Per Project** — .aic/config.yaml overrides
4. **Context Warm-Up & Cache** — cache context-gather output

## Phase 4: Dashboard & Monitoring (~3.5h)
1. **Sub-Worker Tree** — expandable Head → sub-workers view
2. **Cost Tracking** — tokens per task, cost estimation
3. **WebSocket Live Updates** — replace polling with push
4. **Task Timeline** — Gantt-style phase visualization
5. **Worker Performance Stats** — success rate, avg time per worker

## Phase 5: Hardening (~1.5h)
1. **Notifications** — Slack/Discord/Telegram webhook
2. **Audit Trail** — every state change logged
3. **Auto Changelog** — auto-generate changelog entries
4. **Skill Self-Test** — /aic test dry-run
5. **Dashboard Auth** — optional API key
6. **Error Output Parser** — fallback parsing for garbage output

## Total: 25 tasks, ~10 hours

## Dependency Graph
```
Phase 1: Engine (harus duluan)
Phase 2: Intelligence (← Phase 1)
Phase 3: DX (← Phase 1)
Phase 4: Dashboard (← Phase 1)
Phase 5: Hardening (independent)
```

## Removed Items
- ~~Task Templates~~ → PM Natural Language Parser replaces
- ~~Multi-Repo~~ → deferred (belum butuh)
- ~~Worker Memory~~ → Context Warm-Up covers speed aspect
