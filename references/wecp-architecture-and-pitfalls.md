# Worker Execution Compliance Pipeline (WECP) — Architecture & Pitfalls

## Architecture

WECP replaces single-shot worker execution with a deterministic compliance pipeline for contract-covered roles:

```
Generate (opencode) → Extract (json-to-md) → Validate (structured JSON)
  → if PASS: write artifact, exit 0
  → if FAIL + retries left: build repair prompt → re-generate → re-validate
  → if FAIL + exhausted: exit 1
```

**Integration point:** `spawn-worker.sh` checks if the worker role has a contract via `phase-contract-loader.py`. If yes, delegates to `worker-execution-pipeline.py`. If no, uses legacy single-shot path. Runtime sees only exit 0/1 — no repair state leaks.

## Files

| File | Purpose |
|------|---------|
| `scripts/worker-execution-pipeline.py` | WECP module — generate/validate/repair loop |
| `scripts/validate-phase-artifact.py` | Validator with `--json` structured mode |
| `.aic/worker-compliance.json` | Configurable limits (repairs, timeouts, section min chars) |
| `scripts/spawn-worker.sh` | Launcher — delegates to WECP for contract roles |

## Validator JSON Schema

```
--json <skill_dir> <phase> <role> <path>
```

Returns:
```json
{
  "ok": false,
  "phase": "Investigate",
  "role": "pm",
  "artifact": "/path/to/pm-output.md",
  "errors": [
    {"code": "MISSING_SECTION", "section": "## Risks", "severity": "error",
     "repairHint": "Add ## Risks with substantive content"},
    {"code": "SECTION_TOO_SHORT", "section": "## Objective", "chars": 12, "minChars": 40,
     "severity": "error", "repairHint": "Expand ## Objective to at least 40 characters"}
  ],
  "repairHints": ["Add ## Risks...", "Expand ## Objective..."]
}
```

Error codes: `FILE_ERROR`, `ARTIFACT_TOO_SMALL`, `FORBIDDEN_PATTERN`, `MISSING_SECTION`, `EMPTY_SECTION`, `SECTION_TOO_SHORT`, `VALIDATOR_ERROR`.

## Config Schema (`.aic/worker-compliance.json`)

```json
{
  "defaults": {
    "maxRepairAttempts": 2,
    "repairTimeout": 120,
    "minSectionChars": 40
  },
  "phases": {
    "Investigate": {
      "roles": {
        "pm": { "maxRepairAttempts": 3 }
      }
    }
  }
}
```

Phase/role overrides cascade: defaults → phase defaults → role overrides.

## Pitfalls

### Phase Case Mismatch (CRITICAL)
The runtime engine sets `AIC_PIPELINE_PHASE=INVESTIGATE` (UPPERCASE), but contracts and config use title case (`Investigate`). WECP must normalize before config lookup:

```python
phase_raw = os.environ.get("AIC_PIPELINE_PHASE", "Implementation")
phase = phase_raw[0].upper() + phase_raw[1:].lower() if phase_raw else "Implementation"
```

`phase-contract-loader.py` normalizes internally (lowercase + strip non-alpha), so it handles uppercase. But `worker-compliance.json` config lookup is exact-match — without normalization, per-phase overrides silently fall back to defaults.

### Generate-Fail Bail-Out
If initial `opencode run` fails (process failure, timeout), there's nothing to repair. WECP must return `exit 1` immediately on `attempt == 0` generate/extraction failure — not `continue` into the repair loop where it crashes trying to read a nonexistent `md_file`.

### Path("") → "." (directory read crash)
The guard `Path(md_file or "")` resolves `Path("")` to `"."` (current directory). If `md_file` is `None` after a failed generate, `Path(".").read_text()` raises `IsADirectoryError`. Fix: bail out before reaching the repair path when generate produced nothing.

### Node Runner Script
The Node.js runner for `opencode run` must use the full version with named arguments (`const promptFile = process.argv[2]`, etc.) — not a minified one-liner. The minified version had syntax issues that caused silent opencode failures. Use the same script format as `spawn-worker.sh`.

### capture_output=True Breaks Node Subprocess (CRITICAL)
When calling the Node.js runner from Python's `subprocess.run()`, **NEVER** use `capture_output=True`. This redirects Node's stdout/stderr to Python pipes, which breaks `execFileSync` + `fs.writeFileSync` patterns where the Node script writes output to a file via stdout piping. The Node process exits with code 1 silently — no stderr, no output file.

**Symptom:** `node exit=1 stderr=(none)` in server log. Output file missing or empty.

**Fix:** Use the same pattern as the working legacy `spawn-worker.sh` — no capture:
```python
subprocess.run(
    ["node", node_script, str(prompt_file), model, str(cwd), str(timeout_sec), out],
    check=True, timeout=timeout_sec + 60,
)
```

**Root cause:** `capture_output=True` is equivalent to `stdout=subprocess.PIPE, stderr=subprocess.PIPE`. When Node's `execFileSync` inherits these pipes, the child `opencode` process inherits them too, and `fs.writeFileSync` to a file still works but the parent Node process may exit 1 due to pipe buffering or SIGPIPE.

Discovered during IMP-003 Runtime OAT — OAT tasks 023-025 all failed with silent opencode failures until `capture_output` was removed.

### OAT Endpoint Pattern
When creating Runtime OAT scripts, use `/api/runtime/intent` with `{"intent":"task.create"}` and `{"intent":"task.start"}`, NOT `/api/task.create` or `/api/task-start`. The intent-based API is the canonical interface. Health check is at `/health` (no auth), NOT `/api/health` (requires auth).

### Timeout Mismatch: repairTimeout vs tier TIMEOUT (CRITICAL)
The `repairTimeout` in `worker-compliance.json` (default 120s) is for targeted repair passes. The **initial generation** must use the same timeout as the legacy `spawn-worker.sh` path — the tier `TIMEOUT` from `.env` (1800s). Using 120s for initial generation kills the model mid-tool-calls: `step_finish reason=tool-calls tokens={output: 54}` — model started exploring but was killed before producing text.

**Symptom:** `opencode exit=1`, extraction fails with "no assistant text in session". Server log shows WECP generate fails immediately with no useful output.

**Fix:** Read `TIMEOUT` from environment for initial generation, `repairTimeout` for repairs only:
```python
gen_timeout = int(os.environ.get("TIMEOUT", "1800"))
repair_timeout = limits.get("repairTimeout", 120)
# In loop:
timeout = gen_timeout if attempt == 0 else repair_timeout
```

**Diagnosis path:** OAT 023-025 failed with silent opencode failures. Adding stderr capture revealed `node exit=1 stderr=(none)`. Checking `opencode run` standalone worked fine. Checking output files showed `step_finish reason=tool-calls` with minimal output tokens — model was exploring but got killed at 120s.

### Temp File Cleanup in Retry Loop (CRITICAL)
When the generate → validate → repair loop needs the validated artifact as input to build the repair prompt, cleaning up `md_file` between iterations crashes the repair step with `FileNotFoundError`.

**Symptom:** First iteration validates and finds missing sections → `safe_unlink(md_file)` → repair loop tries `Path(md_file).read_text()` → crash.

**Fix:** Only clean up `json_file` (consumed once for extraction) between attempts. Keep `md_file` alive for repair prompt generation. Clean up `md_file` only on final success (after copy to artifact) or final failure:
```python
# Between attempts:
safe_unlink(json_file)  # keep md_file for repair prompt

# On PASS:
shutil.copy2(md_file, artifact_path)
safe_unlink(md_file)

# On final failure (after all retries):
safe_unlink(md_file)
```

### Sequential Bug Cascade Pattern
When integrating a new compliance wrapper (WECP) around a working tool (opencode via spawn-worker), expect a "fix one, find next" cascade across multiple OAT runs. Each run exercises a different failure path:
- OAT 023: phase case mismatch → `INVESTIGATE` vs `Investigate` in config
- OAT 025: `capture_output=True` → silent Node exit 1
- OAT 027: `repairTimeout=120` too short for initial generation → model killed
- OAT 028: `safe_unlink(md_file)` → FileNotFoundError on repair

**Mitigation:** After the first fix, always verify the fix exposes the next failure by checking the server log (not just the OAT poller status). The poller shows `failed` but the server log shows the exact crash location.

## Strategy B — continue on empty extract (IMP-007, shipped)

After first `run_opencode`, if `extract_md` fails but `sessionID` exists in NDJSON:

- One `run_opencode_continue` with message from `worker-continue-prompt.sh`
- If first extract succeeds, continue **never** runs
- Repair loop unchanged (no continue on `repair#N`)

See `references/imp007-strategy-b-wecp-continue.md`.

## Raw NDJSON leak guard (IMP-024-A, 2026-07-14, CRITICAL)

**Symptom:** `TASK-20260713-047` `pm-output.md` = 24KB raw NDJSON (`{"type":"step_start"...}`), not markdown. Root cause: legacy `spawn-worker.sh` had `|| cp "$OUTPUT_FILE" "$ARTIFACT_PATH"` — on extraction failure, raw opencode JSON was dumped directly to `reports/`.

**Fix (shipped):**
- `opencode-json-to-md.py` hardened: fallback `part.content`/`delta`, sanity rejects output starting with `{"type":` or containing `step_start`/`tool_use` in first 500 chars, rejects <20 chars.
- `spawn-worker.sh` legacy path: `if ! opencode-json-to-md ... > artifact; then rm -f artifact; ARTIFACT_PATH=""; EXIT_CODE=1; fi` — fail worker explicitly, never raw fallback.
- Regen (FIX-019) same guard.

**Rule:** Never persist raw NDJSON to `reports/`. If extraction fails, worker must fail with no artifact so Runtime marks it failed and barrier logic can retry or surface deterministically.

**Verification:** `hermes-verify-imp024a` — valid NDJSON passes, raw `step_start` dump rejected, `bash -n spawn-worker.sh`, no `|| cp "$OUTPUT_FILE"` present.

## IMP-024-B Session Extraction Hardening (2026-07-14)

- `extract_session_id()` hardened: keys `sessionID`/`sessionId`/`session_id`, locations top-level + `part.*` + `data.*`, non-JSON prefix stripping (find first `{`), deep fallback scan any string `ses_` >8 chars.
- `run_opencode` TimeoutExpired: recovers sid from partial file instead of `return None,None` — logs `recovering session id from partial`.
- `scripts/legacy-extract-sid.py` standalone helper — avoids heredoc nesting collision (previous inline `<< 'PY'` inside spawn-worker function broke `bash -n`).
- Fixtures verified: 047 leak `ses_0a30d69b...` extracts, snake_case `session_id`, prefixed `opencode: log\n{...}`, nested `ses_` fallback.
- `hermes-verify-imp024b` includes payload fix check, Strategy B markers, session extraction fixtures.

## IMP-024-B Completion Payload Fix (CRITICAL)

`spawn-worker.sh:185` pre-fix used `'''${ARTIFACT_PATH}'''` inside double quotes:

```bash
COMPLETE_PAYLOAD=$(python3 -c "import json; print(json.dumps({'exitCode': int('${EXIT_CODE}'), 'artifactPath': '''${ARTIFACT_PATH}'''}))")
```

`bash -n` passes but runtime produces broken JSON when path non-empty → lease POST fails silently, masked by `[engine] barrier reconciled ... via lease`.

Fix: env-var bridge `FINAL_EXIT`/`FINAL_PATH` with single-quoted Python: `import json,os; print(json.dumps({"exitCode": int(os.environ.get("FINAL_EXIT","0")), "artifactPath": os.environ.get("FINAL_PATH","")}))`.

Rule: never embed bash vars via triple single-quote in Python JSON. Always env-var bridge.

## Relationship to PM Review

```
WECP (structural compliance) → artifact submitted → Barrier → PM Review (substantive quality)
```

WECP ensures structural contract compliance. PM Review judges substantive quality. Both must pass.

## Relationship to PM Review

```
WECP (structural compliance) -> artifact submitted -> Barrier -> PM Review (substantive quality)
```
