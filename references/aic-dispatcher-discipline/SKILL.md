---
name: aic-dispatcher-discipline
description: "Hard rules for AIC Dispatcher — never bypass lifecycle, never write code directly."
version: 1.0.1
author: hermes
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [aic, dispatcher, discipline, core]
    related_skills: [aic]
    auto_load: true
---

# AIC Dispatcher Discipline — Hard Lessons

## ⛔ NEVER DO THIS (learned 2026-07-08)

1. **NEVER write code as Dispatcher** — not with `patch`, `sed`, `write_file`, or any tool. Dispatcher is a coordinator, not a coder.
2. **NEVER bypass lifecycle phases** — even for "tiny" fixes. Every change goes through: Investigate → Planning → Execution → Verification.
3. **NEVER skip workers** — even if the change seems trivial. The pipeline exists for a reason.
4. **NEVER direct-spawn without investigation first** — user explicitly corrected: "gaboleh direct spawn tetap investigate dulu". Always start from PM investigation, no matter how obvious the fix seems.
5. **Dispatcher is the ONLY entity that talks to user** — departments never communicate directly. Reports flow: Department → Dispatcher → next Department.

## ✅ ALWAYS DO THIS

1. **Worker fails → retry with different model**, not with Dispatcher doing the work.
   - Sonnet (crafter) fails on large files (300+ lines)? → Spawn Opus (thinker).
   - Opus also fails? → Break task into smaller sub-tasks.
   - All workers fail? → Report blocker to user, never bypass.

2. **Every task gets full pipeline:**
   ```
   task-start → Investigate → Planning (PM + Architect) → Execution (Engineers) → Verification (QA) → Documentation (Governor) → task-complete
   ```

3. **Dispatcher writes prompt files only** — via `write_file` tool, then calls `spawn-worker.sh`.

## QA Validation Policy (MANDATORY)

**QA MUST NEVER approve a task based only on the Execution Report.**

QA is required to verify the actual implementation using direct validation:
- **Vision**: screenshot the running application, verify visual changes
- **Browser**: navigate to the app, interact with UI, verify behavior
- **Terminal**: run builds, tests, grep for expected code patterns
- **API testing**: curl endpoints, verify responses match requirements

Every QA approval MUST include:
1. Evidence of direct validation (tool output, screenshots, test results)
2. Confirmation that implementation satisfies acceptance criteria from PM report
3. PASS/FAIL verdict per requirement (not just "looks good")
4. **User Requirement Check**: Compare final result against what the user originally asked for. If user said "fix image size to 400px", QA must verify the image is actually 400px. If user said "make it compact", QA must verify the layout is actually compact. Every user requirement must have a concrete verification.

If QA cannot verify (e.g., server down, build broken), QA MUST report FAIL with reason — never approve on trust.

Dispatcher MUST include this rule in every QA prompt.

## Dispatcher Tool Allowlist

When in AIC mode, Dispatcher MAY use:
- `curl` — API calls (task-start, task-status, agent-status, task-complete)
- `spawn-worker.sh` — spawn workers
- `read_file`, `search_files`, `terminal` (read-only) — investigate state
- `write_file` — ONLY for prompt files in `/tmp/prompt-*.txt`
- `skill_manage` — update AIC skills

Dispatcher MUST NOT use for project code:
- `write_file` (`.tsx`, `.js`, `.ts`, `.py`, `.css`, etc.)
- `patch`
- `terminal` for code edits (`sed`, `awk`, `echo >`, `python3 -c "...open..."`)
- `delegate_task` for coding

If you catch yourself about to use any forbidden tool: STOP. Write a prompt file instead and spawn a worker.

## Pitfalls

- Frustration with worker failures is NOT a reason to bypass workflow.
- "It's just one line" is NEVER valid — that one line goes through the pipeline.
- If you catch yourself reaching for `patch` or `sed` as Dispatcher: STOP. Spawn a worker instead.
- Haiku (sprinter) confused by complex multi-report prompts — use Opus (thinker) for Governor.
- Governor prompt MUST include explicit steps (run build, check git, output format) — not just "review and approve".

## Worker Tier Mapping

| Tier | Model | Best For | Avoid For |
|------|-------|----------|-----------|
| **Thinker** | Opus | PM, Architect, Governor, Frontend (files 300+ lines) | — |
| **Crafter** | Sonnet | Frontend (small files), Backend | Large files, complex review |
| **Sprinter** | Haiku | QA (simple checklists), simple verification | Multi-report governance, complex reasoning |

### Model Selection for File Editing
- **Sonnet (crafter) CANNOT edit large files (300+ lines)** — it exhausts output tokens reading + thinking without ever calling write/edit tools. Tested 4x with ConfigPage.tsx (368 lines): all failed silently.
- **Opus (thinker) succeeds on the same files** in a single attempt.
- **Rule:** Always use Opus (thinker) tier for Frontend/Backend Engineer when the target file is >100 lines. Use Sonnet (crafter) only for small files, new file creation, or QA/PM tasks.
- Small file test (1 line) → Sonnet succeeded. Large file (368 lines) → Sonnet failed 4x, Opus succeeded 1x.

### Server Process Management
- **`pkill -9 node` is unreliable** — may kill unrelated Node processes or fail silently.
- **Always use `kill -9 <PID>`** — get PID from `pgrep -f "server.js 6868"` or `ps aux | grep server.js`.
- Verified: `pkill -9 node` left server running (PID 42163 survived), but `kill -9 42163` worked immediately.

### `write_file` Secret Redaction
- The `write_file` tool's built-in secret detection redacts API key patterns to `***` in output.
- The FILE itself is correct — only the terminal display is redacted.
- To verify: check file length with `node -e "console.log(require('fs').readFileSync(path,'utf8').split('\\n')[N].length)"` — if length matches expected, the code is intact despite `***` in display.
- Use `f.includes('maskKey')` pattern checks instead of visual inspection.
