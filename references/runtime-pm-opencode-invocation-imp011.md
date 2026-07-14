# PM Review — OpenCode invocation (IMP-010 / IMP-011)

## Failure modes (OAT chain)

| OAT | Symptom | Cause |
|-----|---------|--------|
| 033 | PM narrative, no VERDICT | `--auto` → model implemented instead of review |
| 034 | `read(promptFile)` permission denied | Positional path as message; no `--auto` |
| 035 | **Empty raw verdict** | `-f` OK but **message after `-f` parsed as file path** |

## CLI contract (`opencode run --help`)

- Positionals: `message` (array) — **not** “load this path as prompt body”.
- `-f` / `--file`: attach file to the user message.
- **Must** provide at least one message (not `-f` alone).

## Wrong argv (FIX-012 initial — breaks 035)

```javascript
['run', '-m', model, '--format', 'json', '-f', promptFile, reviewMsg]
```

OpenCode error: `File not found: <reviewMsg first line>` — treats trailing positional as **filesystem path**.

## Correct argv pattern

Put the **short review instruction immediately after `run`**, then flags, then `-f`:

```javascript
['run', reviewMsg, '-m', model, '--format', 'json', '-f', promptFile]
```

- `reviewMsg`: review-only + first line `VERDICT: PASS|REWORK|BLOCKED` (FIX-011).
- `promptFile`: full generated prompt (artifacts embedded) — **attach**, do not pass as sole positional.

## Worker vs PM (do not copy worker transport to PM)

| | Worker (WECP) | PM (`pm-review.sh`) |
|---|----------------|---------------------|
| Pattern | `run <promptPath> … --auto` | `run <shortMsg> … -f <prompt>` **no `--auto`** |
| Why | Needs tools to read path + execute | Reviewer only; path-as-message causes `read()` |

## Production blind spots (`pm-review.sh`)

- `node "$NODE_RUNNER" … 2>/dev/null || true` — **hides OpenCode stderr** (e.g. File not found).
- Empty stdout → `opencode-json-to-md.py` exits 1 → parser sees empty → UNKNOWN exit 3.

**Forensic recipe (no OAT):** run `opencode` with same argv, capture stdout/stderr, count NDJSON `type:text`, do not suppress stderr.

## Shipped (FIX-013)

`pm-review.sh` uses correct argv + `PM opencode diagnostics` / `PM extract failed` on empty output (replaces blind `2>/dev/null || true`).

**OAT 036:** Investigate + Planning PM **PASS** with `VERDICT:` — validates FIX-011/012/013. Implementation PM **REWORK** → IMP-012 (preamble), not transport.

## Related fixes

- FIX-011: review-only prompt, no `--auto` on PM.
- FIX-012: `-f` attach (argv order per this doc).
- FIX-013: message after `run`, then `-f`; diagnostics.
- Parser: unchanged (FIX-004); needs assistant text with `VERDICT:`.