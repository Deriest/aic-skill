# AIC Skill — Implementation Plan

**Source:** Researcher report (23 improvements), grouped by file to minimize touches.
**Rule:** Fewer file touches = fewer bugs. Each batch touches distinct files where possible.

---

## Execution Order & Parallelism

```
Batch 1 ──┐
Batch 2 ──┤── all 3 parallel (zero file conflicts)
Batch 4 ──┘
           ↓
Batch 3 ─── sequential (depends on B1 for archive/, B2 for status.py state)
           ↓
Batch 5 ─── parallel with Batch 6 (no file overlap)
Batch 6 ──┘
           ↓
Batch 7 ─── last (depends on B5 for dashboard final shape)
```

---

## Batch 1 — Delete Dead Code

**Improvements:** #1 (P0), #22 (P3), #23 (P3)
**Complexity:** simple
**Files:**

| Action | File | Improvement |
|--------|------|-------------|
| DELETE | `scripts/update-status.sh` | #1 — dead code, drifts from Python version, writes wrong format |
| DELETE | `ARCHITECTURE.md` | #22 — artifact from TASK-20260707-002, not referenced anywhere |
| DELETE | `requirements.md` | #22 — same artifact |
| DELETE | `references/openclaw-to-hermes-mapping.md` | #23 — legacy migration doc, unreferenced |
| EDIT | `SKILL.md` line ~841-844 | Remove references to `react-dashboard-rebuild.md` and `vite-react-dashboard-scaffold.md` if those files don't exist (verify first) |

**Acceptance criteria:**
- [ ] `scripts/update-status.sh` no longer exists
- [ ] `ARCHITECTURE.md` and `requirements.md` no longer in skill root
- [ ] `references/openclaw-to-hermes-mapping.md` no longer exists
- [ ] `SKILL.md` has no dangling references to deleted files
- [ ] `git status` (if applicable) shows only deletions, no unintended changes

---

## Batch 2 — Status System Hardening (update-status.py + server.js)

**Improvements:** #3 (P0 — race condition), #5 (P1 — 3-hop architecture), #8 (P1 — task history)
**Complexity:** complex
**Files:**

| Action | File | Improvement |
|--------|------|-------------|
| EDIT | `scripts/update-status.py` | #3 — add `fcntl.flock` locking around read-modify-write |
| EDIT | `scripts/update-status.py` | #5 — make Python the single writer AND HTTP server (add `http.server` on port 3000) |
| EDIT | `scripts/update-status.py` | #8 — on `task-complete`, append to `history.json` before resetting |
| EDIT | `scripts/server.js` | #5 — DELETE this file entirely (functionality absorbed into update-status.py) |
| CREATE | `history.json` | #8 — auto-created by update-status.py on first task-complete |

### Details for #3 (race condition):
```python
import fcntl

def load_status():
    with open(STATUS_FILE, 'r') as f:
        fcntl.flock(f, fcntl.LOCK_SH)
        data = json.loads(f.read())
        fcntl.flock(f, fcntl.LOCK_UN)
    return data

def save_status(status):
    with open(STATUS_FILE, 'w') as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        f.write(json.dumps(status, indent=2))
        fcntl.flock(f, fcntl.LOCK_UN)
```

### Details for #5 (consolidate to single process):
- Merge `server.js` HTTP serving into `update-status.py` using `http.server` stdlib
- `GET /api/status` — return current status.json contents (NO drain-on-read; logs persist until next write clears them)
- `POST /api/status` — write full status (for dashboard compatibility)
- `GET /health` — health check
- Run on port 3000 (configurable via `--port` arg)
- The dashboard React app polls `GET /api/status` — no change needed client-side

### Details for #8 (task history):
On `task-complete` action, BEFORE resetting:
```python
history_file = STATUS_FILE.parent / "history.json"
history = json.loads(history_file.read_text()) if history_file.exists() else []
history.append({
    "taskId": status["currentTask"].get("id"),
    "title": status["currentTask"].get("title"),
    "type": status["currentTask"].get("type"),
    "phases": len(status["phases"]),
    "completedAt": datetime.now().isoformat(),
    "agents": list(status["agents"].keys()),
})
# Keep last 50
history_file.write_text(json.dumps(history[-50:], indent=2))
```

**Acceptance criteria:**
- [ ] `scripts/server.js` deleted
- [ ] `python update-status.py --serve 3000` starts HTTP server on port 3000
- [ ] `GET /api/status` returns valid JSON
- [ ] `POST /api/status` writes status.json
- [ ] Concurrent writes (two `python update-status.py agent-status ...` in parallel) don't lose data — verify by running 10 parallel agent-status calls and checking all 10 agents appear in status.json
- [ ] `task-complete` creates/appends to `history.json` with task metadata
- [ ] Dashboard still works: start with `python update-status.py --serve 3000`, open http://localhost:6969, verify polling works

---

## Batch 3 — SKILL.md Overhaul

**Improvements:** #2 (P0), #6 (P1), #7 (P1), #9 (P1), #11 (P2), #12 (P2), #16 (P2), #17 (P3)
**Complexity:** complex
**Files:**

| Action | File | Improvement |
|--------|------|-------------|
| EDIT | `SKILL.md` | All items below |
| CREATE | `references/pitfalls-history.md` | #6 — moved anecdotes |

### #6 — Trim SKILL.md (~844 → ~450 lines):
Move these sections entirely to `references/pitfalls-history.md`:
- "❌ Do NOT over-extend when user asks for analysis/recommendations" (lines 671-676)
- "❌ NEVER violate Rule #1" (lines 678-689)
- "❌ NEVER bypass the pipeline when handed a pre-formatted TASK HANDOFF" (lines 691-698)
- "❌ `/aic dashboard` ≠ 'improve the dashboard'" (lines 700-701)
- "❌ Never skip the retry loop on worker failure" (lines 703-706)
- "❌ Do NOT show internal details in reports" (lines 708-709)
- "❌ First-run config should detect existing OpenCode setup" (lines 711-718)
- "❌ CSS overflow-hidden must go on the RIGHT container" (lines 720-742)
- "❌ When syncing from upstream repo, verify cross-platform paths immediately" (lines 744-763)
- "❌ Dashboard Vite fails after fresh clone" (lines 765-772)

Keep in SKILL.md Pitfalls section: only the 3 actionable rules (condensed):
1. Analysis requests → single worker, no pipeline
2. Dispatcher never writes code — Rule #1
3. Pre-flight check before every /aic task

### #2 — Add per-worker timeouts:
Replace the single `timeout=300` spawn template with a table:
```
| Worker | Timeout |
|--------|---------|
| PM, Architect | 180s |
| Frontend, Backend, Infra | 600s |
| QA | 300s |
| Researcher, Designer | 300s |
| Governor | 300s |
```
Update all spawn templates to use the correct timeout.

### #7 — Classification disambiguation:
After the keyword table, add a disambiguation note:
```
When multiple keyword sets match, use context to disambiguate:
- "deploy" + frontend/UI words → feature (not infrastructure)
- "test" + bug/error words → bug (not testing)
- "build" + infrastructure/CI/CD words → infrastructure (not feature)
If still uncertain → ask Operator.
```

### #9 — Designer in feature pipeline:
Update the Feature workflow:
```
1. PM → requirements + acceptance criteria
2. Architect → system design + API contracts
3. [Optional] Designer → UI specs (if task involves UI/frontend)
4. Engineers → implementation
5. QA → testing
6. Governor → review
```

### #11 — Graceful degradation:
Add to Prerequisites section:
```
If OpenCode is NOT installed:
- PM, Architect, Researcher, Designer, Governor → spawn via delegate_task (thinking-only)
- Engineers, QA → require OpenCode; report to Operator if missing
```

### #12 — Governor skip classification:
Add to classification table:
```
| color, style, layout, CSS, spacing, visual | feature-visual | Designer → Frontend (skip Governor) |
| typo, spacing fix, one-liner | bugfix-trivial | Engineer (skip Governor) |
| README, comments, docstrings | documentation | Engineer (skip Governor) |
```

### #16 — /aic status implementation:
Add to Special Commands section:
```
/aic status → Read status.json, format as Live Progress Report template, display in chat.
If no active task, show "No active task. Last completed: [from history.json]".
```

### #17 — QA model upgrade:
Change QA Engineer model from `{provider}/{haiku}` to `{provider}/{sonnet}` in the Worker table (line 112) and spawn template (line 447).

**Acceptance criteria:**
- [ ] SKILL.md is ≤ 500 lines
- [ ] `references/pitfalls-history.md` contains the moved anecdotes with original dates
- [ ] All timeout values in spawn templates match the per-worker table
- [ ] Classification table includes disambiguation rules
- [ ] Feature pipeline includes optional Designer phase
- [ ] Governor skip types are in the classification table
- [ ] /aic status has implementation guidance
- [ ] QA uses sonnet model everywhere (table + template)
- [ ] No broken internal references

---

## Batch 4 — Config Consolidation + setup.sh Fix

**Improvements:** #4 (P0), #14 (P2), #15 (P2), #21 (P3)
**Complexity:** medium
**Files:**

| Action | File | Improvement |
|--------|------|-------------|
| EDIT | `templates/.env.example` | #21 — update model names to Claude 4 / Sonnet 4 / Haiku 3.5 |
| EDIT | `templates/opencode-provider.json` | #15 — add comment explaining this is the canonical config |
| EDIT | `scripts/setup.sh` | #14 — replace Node auto-install with version check + link |
| EDIT | `scripts/setup.sh` | #21 — update model IDs in all provider presets |
| EDIT | `SKILL.md` | #4 — clarify that opencode.jsonc is canonical; .env is Dispatcher convenience only |

### #4 — Config source of truth:
In SKILL.md First Run Configuration section, add:
```
**Config hierarchy:** OpenCode reads `opencode.jsonc` (canonical). The `.env` file is
read ONLY by the Dispatcher to interpolate model names into spawn commands.
Always edit `opencode.jsonc` first; `.env` mirrors it for Dispatcher use.
```

### #14 — setup.sh Node check:
Replace lines 35-49 (auto-install block) with:
```bash
NODE_VERSION=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Node.js ≥ 18 required. Found: ${NODE_VERSION:-not installed}${NC}"
    echo -e "${CYAN}Install from: https://nodejs.org/${NC}"
    exit 1
fi
```

### #21 — Model name updates:
In setup.sh, update all provider presets:
```
# OpenRouter: anthropic/claude-opus-4, anthropic/claude-sonnet-4, anthropic/claude-haiku-3.5
# Anthropic: claude-opus-4-20250514, claude-sonnet-4-20250514, claude-haiku-3.5-20250514
# (verify current IDs against docs.anthropic.com before finalizing)
```

In `.env.example`, update all commented presets to match.

**Acceptance criteria:**
- [ ] `.env.example` shows current model IDs
- [ ] `opencode-provider.json` has clarifying comment
- [ ] `setup.sh` checks Node ≥ 18 without auto-installing
- [ ] `setup.sh` provider presets use current model IDs
- [ ] SKILL.md explains config hierarchy (opencode.jsonc canonical, .env is Dispatcher helper)

---

## Batch 5 — Dashboard Production Build + Port Safety

**Improvements:** #13 (P2), #19 (P3)
**Complexity:** medium
**Files:**

| Action | File | Improvement |
|--------|------|-------------|
| EDIT | `dashboard/package.json` | #13 — add `"build": "vite build"` and `"preview": "vite preview"` scripts |
| EDIT | `SKILL.md` | #13 — update /aic dashboard to build then serve dist/ |
| EDIT | `SKILL.md` | #19 — add port conflict detection before starting servers |

### #13 — Production dashboard:
Update /aic dashboard startup in SKILL.md:
```python
# Build dashboard if dist/ missing or stale
terminal(command='cd ~/.hermes/skills/workflows/aic/dashboard && npm run build')
# Serve with vite preview (or a simple static server on 6969)
terminal(command='cd ~/.hermes/skills/workflows/aic/dashboard && npx vite preview --port 6969', background=True)
```

### #19 — Port conflict detection:
Add before server start in SKILL.md:
```python
# Check port availability
terminal(command='fuser 3000/tcp 2>/dev/null && echo "PORT_3000_BUSY" || echo "PORT_3000_FREE"')
# If busy, report to Operator instead of force-killing
```

**#20 (SSE) is deliberately skipped** — polling works, SSE adds complexity for minimal gain in a localhost-only dashboard. Revisit if dashboard is ever exposed externally.

**Acceptance criteria:**
- [ ] `npm run build` in dashboard/ produces dist/ with zero errors
- [ ] `/aic dashboard` instructions use production build
- [ ] Port conflict detection warns instead of force-killing

---

## Batch 6 — Context Gathering Script

**Improvements:** #10 (P1)
**Complexity:** medium
**Files:**

| Action | File | Improvement |
|--------|------|-------------|
| CREATE | `scripts/context-gather.sh` | #10 — reads key project files, outputs bounded context summary |
| EDIT | `SKILL.md` | #10 — reference context-gather.sh in Rule #20 |

### Script spec:
```bash
#!/bin/bash
# Usage: bash context-gather.sh [project_dir] [max_kb=8]
# Outputs: tree structure + key file excerpts, capped at max_kb
# Reads: package.json, README.md, ARCHITECTURE.md, requirements.md, src/**/*.ts (first 200 lines each)
```
- `tree -L 2 --dirsfirst` for structure
- Read package.json, any *.md in root, first 200 lines of src/ files
- Truncate output to `max_kb` kilobytes
- Print to stdout for piping into `delegate_task(context=...)`

**Acceptance criteria:**
- [ ] `bash scripts/context-gather.sh /path/to/project 8` outputs ≤ 8KB of context
- [ ] Output includes project tree + key file contents
- [ ] SKILL.md Rule #20 references the script

---

## Batch 7 — Tests

**Improvements:** #18 (P3)
**Complexity:** simple
**Files:**

| Action | File | Improvement |
|--------|------|-------------|
| CREATE | `scripts/test-status.sh` | #18 — bash integration tests for update-status.py |
| CREATE | `scripts/test-api.sh` | #18 — curl-based API tests for the HTTP server |

### test-status.sh:
```bash
#!/bin/bash
# Test update-status.py actions
python update-status.py reset
python update-status.py task-start '{"title":"Test","type":"feature","id":"T-001"}'
# Verify status.json has currentTask
python update-status.py agent-status '{"agent":"pm","status":"working"}'
# Verify agents.pm exists
python update-status.py task-complete
# Verify history.json was created
```

### test-api.sh:
```bash
#!/bin/bash
# Test HTTP API (assumes server running on port 3000)
curl -s http://localhost:3000/health | jq .ok  # expect true
curl -s http://localhost:3000/api/status | jq .connected  # expect true
```

**Acceptance criteria:**
- [ ] `bash scripts/test-status.sh` passes all checks
- [ ] `bash scripts/test-api.sh` passes when server is running
- [ ] Tests clean up after themselves (reset status at end)

---

## Summary

| Batch | Improvements | Priority | Complexity | Parallel Group |
|-------|-------------|----------|------------|----------------|
| 1 | #1, #22, #23 | P0+P3 | simple | A (parallel) |
| 2 | #3, #5, #8 | P0+P1 | complex | A (parallel) |
| 4 | #4, #14, #15, #21 | P0+P2+P3 | medium | A (parallel) |
| 3 | #2, #6, #7, #9, #11, #12, #16, #17 | P0+P1+P2+P3 | complex | B (sequential, after A) |
| 5 | #13, #19 | P2+P3 | medium | C (parallel) |
| 6 | #10 | P1 | medium | C (parallel) |
| 7 | #18 | P3 | simple | D (last) |

**Total: 7 batches, 23 improvements.**
**Deliberately skipped:** #20 (SSE/WebSocket) — polling is fine for localhost dashboard. Add when dashboard goes remote.
