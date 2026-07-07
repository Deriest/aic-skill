# AIC Architecture Decisions

> Decisive picks for the 5 structural changes. Each picks the simplest working solution.

---

## 1. Status System Consolidation (P0 #3 + P1 #5)

### Problem
Three-hop data path: Python `update-status.py` → `status.json` → Node `server.js` → React poll.
- Python and Node share a file with no coordination → read-modify-write races
- Drain-on-read in Node loses logs if React misses a poll cycle (tab hidden, network blip)
- Two processes, two languages, one file — maximum surface area for bugs

### Decision: Node absorbs all status operations. Kill Python and Bash scripts.

**server.js becomes the single authority.** It already runs, already has HTTP, already serves GET.

Changes to `server.js`:

1. **Add action-specific POST endpoints** (replace Python script):
   ```
   POST /api/task-start     body: {title, type, id}
   POST /api/phase-start    body: {name, status}
   POST /api/phase-complete  (no body)
   POST /api/agent-status   body: {agent, status, engine?}
   POST /api/log             body: {message, type}
   POST /api/task-complete   (appends to history.json, then resets)
   POST /api/reset           (no body)
   ```
   Each endpoint mirrors the Python script's semantics exactly. Status is held in-memory, flushed to `status.json` after every mutation.

2. **Kill the drain-on-read pattern.** Replace with a **bounded ring buffer** (last 100 log entries) held in memory. GET `/api/status` returns all entries. The client tracks what it's seen by the entry's `id` (UUID assigned server-side). No more draining = no more lost logs.

3. **Persist status.json for restart resilience only.** On startup, Node loads from disk. After that, memory is canonical. This eliminates the file-contention race entirely — only one process reads/writes the file.

4. **Dispatcher calls curl instead of Python:**
   ```bash
   # Before (Python):
   python ~/.hermes/skills/workflows/aic/scripts/update-status.py agent-status '{"agent":"pm","status":"working","engine":"opencode"}'
   
   # After (curl):
   curl -s -X POST http://localhost:3000/api/agent-status -H 'Content-Type: application/json' -d '{"agent":"pm","status":"working","engine":"opencode"}'
   ```

5. **Delete:** `scripts/update-status.py`, `scripts/update-status.sh`

### Why not Python-serves-HTTP?
- `http.server` is single-threaded by default; adding threading is more code than expanding Node's existing server
- Node is already running for the dashboard — no new process
- Dispatcher already shells out to `terminal()` — `curl` is the same ergonomics as `python script.py`

### Log safety
The ring buffer means logs survive missed polls. Worst case: oldest entries rotate out after 100 entries. For a task with ~20 log entries, that's 5 tasks of headroom. Acceptable.

---

## 2. Config Unification (P0 #4 + P2 #15)

### Problem
`.env` and `opencode.jsonc` both store provider, API key, and model names. SKILL.md tells the Dispatcher to "read .env" but nothing actually does. `setup.sh` writes `opencode.jsonc` (which OpenCode reads) AND `.env` (which nothing reads). Users don't know which to edit.

### Decision: `opencode.jsonc` is the single source of truth. Delete `.env`.

**The Dispatcher (an LLM) reads `opencode.jsonc` directly.** No helper scripts. The LLM can parse JSONC natively — it's 20 lines of config.

Flow at spawn time:
```
1. Dispatcher reads ~/.config/opencode/opencode.jsonc
2. Extracts: provider ID (key name), model IDs (model keys under that provider)
3. Maps worker role → model key: PM/Architect → opus-key, Engineers/Governor → sonnet-key, QA → haiku-key
4. Constructs: opencode run --model {provider_id}/{model_key}
```

SKILL.md model mapping stays as-is (PM→opus, QA→haiku), but the placeholder format changes:
- Old: `{provider}/{opus}` — meaningless without .env parsing
- New: `{PROVIDER_ID}/{OPUS_MODEL_KEY}` — the Dispatcher reads these from opencode.jsonc

**Template change:** `templates/.env.example` → `templates/opencode.jsonc.example` (rename). It already exists as `templates/opencode-provider.json` — merge them.

**Delete:** `.env`, `templates/.env.example`

**setup.sh change:** Stop writing `.env`. Only write `opencode.jsonc`.

**First Run flow in SKILL.md:** Simplified. User picks provider → setup.sh writes opencode.jsonc → done. No .env step.

---

## 3. Task History (P1 #8)

### Problem
`task-complete` resets currentTask, phases, agents to empty. All context is gone. No record of what was built, when, by whom, or how long it took.

### Decision: `history.json` — append-only JSON array, managed by the Node server.

**Schema** (one entry per completed task):
```json
{
  "taskId": "TASK-20260707-001",
  "title": "Build REST API",
  "type": "feature",
  "startedAt": "2026-07-07T10:30:00.000Z",
  "completedAt": "2026-07-07T10:45:00.000Z",
  "durationSec": 900,
  "phases": ["PM + Architect", "Frontend + Backend", "QA", "Governor"],
  "agentCount": 6,
  "outcome": "success"
}
```

**Fields explained:**
- `taskId` / `title` / `type`: from the original task-start payload
- `startedAt`: ISO timestamp set when `task-start` is received
- `completedAt`: ISO timestamp set when `task-complete` is received
- `durationSec`: computed at completion time
- `phases`: array of phase names that were started (in order)
- `agentCount`: unique agents that touched the task
- `outcome`: `"success"` (default), `"rework"` (if Governor sent back), `"failed"` (if escalated)

**No race conditions:** Single Node process manages both live status and history append. On `task-complete`, Node snapshots the current task state, appends to history, THEN resets live status. One process, one event loop, no contention.

**Persistence:** Node loads `history.json` on startup (like status.json). After each append, flush to disk. Keep last 50 entries max (trim oldest on append).

**Dashboard integration:** Add `GET /api/history` endpoint. Dashboard shows last 5 entries in a collapsible "Recent Tasks" panel. No change to polling — separate endpoint, fetched on demand or once on mount.

---

## 4. Context Gathering (P1 #10)

### Problem
Rule #20 says "paste key documents into delegate_task context" but there's no tooling. The Dispatcher must manually read files and concatenate. For large codebases, this hits context limits.

### Decision: `scripts/context-gather.sh` — bounded file reader, stdout output.

**Interface:**
```bash
scripts/context-gather.sh [project_dir] [max_bytes]
# Defaults: project_dir=., max_bytes=8192
```

**What it reads (in priority order, stops at max_bytes):**
1. `tree -L 2 --dirsfirst -I 'node_modules|.git|dist|build|__pycache__|.next|.venv'` — project structure (~1-2KB)
2. Key config files (first 50 lines each):
   - `package.json` or `pyproject.toml` or `Cargo.toml` (whichever exists)
   - `tsconfig.json` or `tsconfig.base.json`
   - `README.md` (first 80 lines)
   - `ARCHITECTURE.md` or `docs/architecture.md` (first 80 lines)
   - `requirements.md` or `docs/requirements.md` (first 80 lines)
3. Source entry points (first 50 lines each):
   - `src/index.ts` or `src/main.ts` or `src/app.ts` or `src/App.tsx`
   - `src/api/` or `src/routes/` directory listing

**Bounding:** Each file is read with `head -n 50`. Total output is piped through a counter that stops at `max_bytes`. If truncated, prints `--- TRUNCATED at {max_bytes} bytes, {remaining} files skipped ---`.

**Implementation:** Pure bash. Dependencies: `tree` (common), `head`, `wc`. No Python, no Node.

**Usage in SKILL.md:**
```
Before spawning a worker, gather context:
  CONTEXT=$(scripts/context-gather.sh /path/to/project 8192)
Paste into delegate_task(context=$CONTEXT) or opencode run prompt.
```

**Why not a Python script?** Bash is simpler for "read some files, cap output". No parsing needed — it's a concatenation tool.

---

## 5. SKILL.md Restructuring (P1 #6)

### Problem
844 lines. Too long for reliable LLM consumption. Pitfalls section alone is ~200 lines of historical anecdotes.

### Decision: Split into ~400-line SKILL.md + 3 reference files.

**Target: 380-420 lines in SKILL.md.**

#### What STAYS in SKILL.md (core operational instructions):

| Section | Lines (est.) | Notes |
|---------|-------------|-------|
| Header + How This Works | 20 | Trim to essentials |
| First Run Config | 30 | Simplified — just opencode.jsonc flow, no .env |
| Worker Engine table | 15 | Keep as-is |
| The 10 Workers | 40 | Role + model tier only. No SOUL quotes. No detailed descriptions. |
| Classification Rules | 20 | Keep table |
| Multi-Phase Workflows | 25 | Condensed flow descriptions |
| Task Handoff Format | 15 | Keep template |
| Task Lifecycle | 20 | State machine + table, trim explanations |
| Spawn section | 40 | One example template + "see references/spawn-templates.md" |
| Result Format | 15 | Keep |
| Blocking/Escalation | 15 | Trim |
| Reporting | 15 | Keep format examples |
| Dashboard | 25 | Minimal — ports, /aic dashboard command, "see references/" |
| Pitfalls (actionable only) | 60 | 1-2 line rules only. No anecdotes. |
| Important Rules | 50 | Condensed — rule number + one-liner |
| **Total** | **~405** | |

#### What MOVES to references/:

**`references/pitfalls-history.md`** (new):
- All "User correction (2026-07-06)" anecdotes with full context
- The CSS overflow-hidden diagnostic story
- The cross-platform path verification workflow
- The Vite ERR_MODULE_NOT_FOUND recovery
- Referenced from SKILL.md pitfalls section: "See references/pitfalls-history.md for the incidents behind these rules."

**`references/spawn-templates.md`** (new):
- Full OpenCode spawn templates for each worker (Backend, Frontend, Infra, QA, etc.)
- Model assignment table with reasoning
- Worker result parsing instructions
- Referenced from SKILL.md spawn section

**`references/dashboard-setup.md`** (new):
- Full /aic dashboard startup sequence (port kill, server start, Vite start, browser open)
- Dashboard features list
- Windows path pitfalls
- Referenced from SKILL.md Dashboard section

**Already in references/ (keep):**
- `references/opencode-custom-provider.md` — already referenced by Rule #12
- `references/dashboard-bug-patterns.md` — already referenced
- `references/react-dashboard-rebuild.md` — already referenced

**Delete:**
- `references/openclaw-to-hermes-mapping.md` — legacy migration artifact, unreferenced
- `ARCHITECTURE.md` (root) — task artifact from TASK-20260707-002, not a living doc
- `requirements.md` (root) — same task artifact
- `templates/.env.example` — replaced by opencode.jsonc.example
- `qa-test.py` — tests marketing site HTML, not related to skill functionality

---

## Implementation Order

| # | Change | Depends On | Effort |
|---|--------|-----------|--------|
| 1 | Status consolidation (expand server.js, delete Python/Bash) | — | 2-3 hrs |
| 2 | Config unification (delete .env, update setup.sh) | — | 30 min |
| 3 | SKILL.md restructuring | #1, #2 (to avoid writing stale instructions) | 1 hr |
| 4 | Task history (add to server.js) | #1 (server.js changes) | 1 hr |
| 5 | Context gathering script | — | 30 min |

Do #1 first — it's the foundation. #3 after #1 and #2 so the new SKILL.md describes the final architecture. #4 piggybacks on #1's server.js changes. #5 is independent.

---

## Files Modified/Created/Deleted

### Modified:
- `scripts/server.js` — expanded with action endpoints, in-memory state, ring buffer, history
- `scripts/setup.sh` — remove .env writing, remove Node auto-install, add Node version check
- `SKILL.md` — trimmed to ~400 lines
- `templates/opencode-provider.json` — becomes the sole config template

### Created:
- `scripts/context-gather.sh`
- `references/pitfalls-history.md`
- `references/spawn-templates.md`
- `references/dashboard-setup.md`

### Deleted:
- `scripts/update-status.py`
- `scripts/update-status.sh`
- `templates/.env.example`
- `references/openclaw-to-hermes-mapping.md`
- `ARCHITECTURE.md` (root — task artifact)
- `requirements.md` (root — task artifact)
- `qa-test.py` (unrelated test script)
