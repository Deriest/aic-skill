# IMP-007 + IMP-024-B — Strategy B (WECP continue & Session Reliability)

## Behavior (Generate only, attempt == 0)

1. `opencode run <promptFile> -m <model> --auto --format json`
2. `extract_md` via `opencode-json-to-md.py`
3. If extract succeeds → validate (continue must NOT run)
4. If extract fails and NDJSON has session id → exactly one:
   - `opencode run "<continue message>" -m <model> --continue -s <session> --auto --format json`
5. Second extract → validate; if still no md → generate failure return 1

Repair (attempt > 0): single run_opencode — no continue on repair passes.

## Shared continue prompt

- `scripts/worker-continue-prompt.sh` (single source; WECP + legacy both use it)
- Output ONLY final assistant message, complete markdown report, no tool calls

## Session ID capture (hardened IMP-024-B 2026-07-14)

`extract_session_id()` in `worker-execution-pipeline.py` + `scripts/legacy-extract-sid.py`:

- Keys: sessionID / sessionId / session_id
- Locations: top-level + part.* + data.*
- Non-JSON prefix stripping: `opencode: log\n{"sessionID":...}` → slice at first `{`
- Deep fallback: any string value ses_ >8 chars anywhere in object graph → last-write-wins
- TimeoutExpired path: recovers sid from partial file instead of returning None,None
  - Logs `=== WECP: opencode timeout (X)s === (recovering session id from partial)`
- Fixtures verified (OK_IMP024B_HERMES_VERIFY):
  - 047 leak ses_0a30d69bfffevZjKS2jAc8CDIu → extracts
  - snake_case {"session_id":"ses_test1234567890"} → extracts
  - prefixed opencode: log line\n{"sessionID":"ses_prefixed999"} → extracts
  - nested {"part":{"foo":{"bar":"ses_fallbackXYZ123456"}}} → extracts via deep scan
  - legacy-extract-sid.py on TASK-20260713-047/reports/pm-output.md → ses_

## Stderr markers (forensics)

| Marker | Meaning |
|--------|---------|
| === WECP: generate continue (Strategy B) === | Continue pass started |
| === WECP: opencode continue exit=N === | Continue opencode failed |
| === WECP: generate extraction failed after continue === | Continue ran but no text |
| === LEGACY: extraction failed — attempting Strategy B continue sid=... === | Legacy parity path (IMP-024-B) |
| === LEGACY: Strategy B PASS === | Legacy continue recovered artifact |
| === WECP: opencode timeout (X)s === (recovering session id from partial) | Timeout with partial recovery |

## Completion payload quoting fix (IMP-024-B, CRITICAL)

Bug in spawn-worker.sh:185 pre-fix:

COMPLETE_PAYLOAD=$(python3 -c "import json; print(json.dumps({'exitCode': int('${EXIT_CODE}'), 'artifactPath': '''${ARTIFACT_PATH}'''}))")

Triple ''' inside double-quoted bash: bash -n passes but runtime produces broken JSON when ARTIFACT_PATH non-empty → lease completion POST fails silently. Engine falls back to reconciliation via [engine] barrier reconciled ... via lease.

Fix: env-var bridge:

FINAL_EXIT="$EXIT_CODE" FINAL_PATH="$ARTIFACT_PATH" COMPLETE_PAYLOAD=$(python3 -c 'import json,os; print(json.dumps({"exitCode": int(os.environ.get("FINAL_EXIT","0")), "artifactPath": os.environ.get("FINAL_PATH","")}))')

Rule: never embed ${VAR} inside single-quoted JSON via '''. Use env-var bridge.

## Legacy Strategy B parity (IMP-024-B)

spawn-worker.sh legacy path (non-contract roles) now has same one-shot recovery:

python3 legacy-extract-sid.py "$OUTPUT_FILE" → SID
if SID present:
  CONT_MSG=$(bash worker-continue-prompt.sh | head -c 800)
  node CONT_RUNNER "$CONT_MSG" "$MODEL" "$PROJECT_DIR" "$TIMEOUT" "$CONT_FILE" "$SID"
  if CONT_FILE && extraction passes: artifact PASS, EXIT_CODE=0, OUTPUT_FILE swapped for metrics
  else: fail clean, no artifact (preserves IMP-024-A no-raw invariant)
else:
  fail clean, no artifact

Helper scripts/legacy-extract-sid.py standalone — avoids heredoc nesting collision in spawn-worker.sh (previous inline << 'PY' inside function broke bash -n).

## Verification

- OK_IMP024B_HERMES_VERIFY — compile, bash -n, 047 sid extraction, snake_case, prefix stripping, ses_ fallback, legacy helper, payload fix, Strategy B markers, timeout recovery path
- Pattern: mktemp /tmp/hermes-verify-imp024b-XXXXXX.sh → py_compile all extractors, bash -n spawn-worker, fixture extraction via importlib.util.spec_from_file_location

## Not in scope

- Session reuse across repairs (excluded per ticket)
- Metrics on failure post (out of scope)
- Runtime FSM / PM / contracts / validators
- Strategy C (no --auto), D (agent/perms), E (hybrid resolver) — future only.
