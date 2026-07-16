# Opencode Consolidated

> **Consolidated from 2 files.** Originals archived in `references/archive/`.

**Original files merged:**
- `opencode-context-policy.md`
- `opencode-json-artifact-and-metrics.md`

---

---

## Source: `opencode-context-policy.md`

# OpenCode Context and Output Policy

## Context Limit Policy (v3.1.5+)
- **No Role-Based Reduction**: All workers (Thinker, Crafter, Sprinter) receive 100% of the provider's default context window. Previous heuristic reductions (80%/60%/40%) were removed as they artificially constrained the workers.
- **Context Detection**: `detect-context.sh` attempts to detect the native model context. If undetectable, it falls back to a safe default (e.g., 256000).

## Output Token Policy (v3.1.5+)
- **Fixed Constant (32000)**: The `limit.output` value in `opencode.jsonc` is hardcoded to `32000` (OpenCode's internal default). 
- **No Percentage Calculation**: Output is no longer calculated as 8% of the context window, and the legacy 16384 cap was removed.
- **Resiliency**: Modern API gateways (9Router, Anthropic, Gemini) accept large `max_tokens` (like 32000) without throwing `400 Bad Request` and will silently truncate on their backend.

## OpenCode Config Pitfalls (`limit` object)
- **Mutually Required Tuple**: If the `limit` object is declared in `opencode.jsonc`, BOTH `context` and `output` MUST be defined. If one is missing, OpenCode crashes on startup (exit code 1) and fails to send the request.
- **Max Tokens Passthrough**: The value defined in `limit.output` is passed verbatim as `max_tokens` in the HTTP payload to the provider.
---

## Source: `opencode-json-artifact-and-metrics.md`

# OpenCode JSON output — artifacts vs metrics (FEAT-001 / Runtime OAT) — IMP-024-A + IMP-024-B

## Problem

`spawn-worker.sh` runs:

```bash
opencode run ... --format json
```

Stdout is **NDJSON** (step_start, tool_use, text, step_finish), not markdown.

If you `cp` raw stdout to `reports/<worker>-output.md`:

- PM Review embeds JSON in prompts → huge artifacts, broken quotes
- `pm-review.sh` cannot find `VERDICT: PASS` in clean text
- Pipeline goes **BLOCKED** after workers "complete" via lease

**Metrics/cost are separate:** token fields live in `step_finish` lines on the **raw** file. Do not remove metrics parsing — only change what gets copied to `reports/*.md`.

## Fix (repo) — FIX-005 + IMP-024-A + IMP-024-B (2026-07-14)

`scripts/opencode-json-to-md.py` — hardened robust extractor:

- `type=="text"` → `part.text` plus fallback `part.content` / `part.delta`; best-effort `part.text` irrespective of outer type (variant schemas).
- Join `\n\n`, then sanity: reject if starts with `{"type":` / `{"id":` / contains `step_start` / `tool_use` in first 500 chars (NDJSON leak — 047 24KB dump), reject <20 chars.
- On fail: stderr + exit 1. Never writes raw NDJSON.

`spawn-worker.sh` / **WECP** (`worker-execution-pipeline.py`):

1. `scripts/opencode-token-extract.py` on raw NDJSON (input, output, reasoning, cacheRead, cacheWrite, total)
2. **One** `POST /api/metrics` per successful worker execution when `input != 0`
3. WECP: collect JSON paths across generate/repair attempts; POST on validator PASS only
4. Write artifact via `opencode-json-to-md.py` — exits 1 if no assistant text or sanity fail. **Forbidden:** `|| cp "$OUTPUT_FILE" "$ARTIFACT_PATH"` — root cause 047. Use:
   ```
   if ! python3 ...opencode-json-to-md.py "$OUTPUT_FILE" > "$ARTIFACT_PATH"; then
     rm -f "$ARTIFACT_PATH"; ARTIFACT_PATH=""; EXIT_CODE=1
   fi
   ```
   Regen (FIX-019) same guard.
5. backend/frontend: `validate-implementation-artifact.py` — `references/implementation-artifact-contract-fix005.md`

IMP-024-B additions:

- `scripts/legacy-extract-sid.py` — standalone session id extractor (sessionID/sessionId/session_id + prefix stripping + ses_ fallback deep scan)
- Legacy runner: on extraction fail, attempts one Strategy B continue via `opencode run ... --continue -s <sid> --auto --format json` (parity with WECP)
- Payload fix: `COMPLETE_PAYLOAD` now via env-var bridge `FINAL_EXIT/FINAL_PATH` — no triple `'''` quoting bug

`pm-review.sh`:

1. After opencode, run same extractor on `$VERDICT_FILE`
2. Parse verdict with `grep` + `sed` + `awk` — **never `xargs`** on verdict text (quote errors)

## Pitfall: `set -u` + unbound `INPUT_TOKENS`

Wrong:

```bash
if [[ -n "$INPUT_TOKENS" ]] || [[ -f "$OUTPUT_FILE" ]]; then
  INPUT_TOKENS=$(grep ...)
```

`INPUT_TOKENS` referenced before assignment → worker exits before metrics **and** lease complete.

Right: `if [[ -f "$OUTPUT_FILE" ]]; then` then assign tokens.

## Pitfall: heredoc nesting collision in spawn-worker.sh (IMP-024-B)

Inline `python3 - "$1" << 'PY' ... PY` inside a bash function that already contains `<< 'NODESCRIPT'` / `<< 'CONTJS'` breaks `bash -n` — unclosed heredoc.

Fix: extract helper to standalone script `scripts/legacy-extract-sid.py`, call via `python3 "$SCRIPT_DIR/legacy-extract-sid.py" "$OUTPUT_FILE"`.

## Pitfall: COMPLETE_PAYLOAD triple single-quote bug (IMP-024-B, CRITICAL)

```bash
COMPLETE_PAYLOAD=$(python3 -c "import json; print(json.dumps({'exitCode': int('${EXIT_CODE}'), 'artifactPath': '''${ARTIFACT_PATH}'''}))")
```

`bash -n` passes but runtime expands `'''` incorrectly → broken JSON → lease POST fails silently. Masked by barrier reconciliation fallback `barrier reconciled ... via lease`.

Fix: `FINAL_EXIT="$EXIT_CODE" FINAL_PATH="$ARTIFACT_PATH" COMPLETE_PAYLOAD=$(python3 -c 'import json,os; print(json.dumps({"exitCode": int(os.environ.get("FINAL_EXIT","0")), "artifactPath": os.environ.get("FINAL_PATH","")}))')`

## Verification (ad-hoc)

- `/tmp/hermes-verify-opencode-artifact.sh` pattern
- `OK_IMP024A_HERMES_VERIFY`: valid NDJSON passes, raw step_start dump rejected, bash -n spawn-worker, no `|| cp`
- `OK_IMP024B_HERMES_VERIFY`: payload fix, Strategy B markers, session extraction fixtures (047 real sid `ses_0a30d69bfffevZjKS2jAc8CDIu`, snake_case `session_id`, prefixed `opencode: log\n{...}`, nested ses_ fallback), legacy helper on 047 file, timeout recovery marker

## Runtime OAT (engine path)

- Intents: `POST /api/runtime/intent` — `task.create`, `task.start`, `task.pause`, `task.resume`, `task.retry`, `task.cancel`
- Workers: `POST /api/runtime/lease/{id}/complete` only (no `/api/task-status` in spawn-worker)
- Legacy routes → **403** with `X-API-Key` (401 without key — not a regression)
- Long OAT: poll `/api/status`; INVESTIGATE + real Opus can take 10–40+ minutes per phase
- `task.retry` after BLOCKED resets checkpoint phase to INVESTIGATE when `pipelineState==BLOCKED`

## Canonical verification hygiene

- Remove unreachable `if (false)` legacy handlers in `server.js` (Category J)
- Self-check scripts != official Verification / Runtime OAT (user: execution evidence required)
- Stale verification banner: after `engine/index.js` edit, re-run focused `mktemp /tmp/hermes-verify-...` script, summarize as ad-hoc not suite green
