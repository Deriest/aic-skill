# Artifact resolution investigation (IMP-005)

## Flows compared

**Current:** assistant `type:text` → `opencode-json-to-md.py` → validator → PM.

**Candidate:** parse NDJSON for `write`/`write_file` → resolve path per contract `.aic/tasks/<taskId>/reports/<artifact>` → same validator → PM.

## Evidence (TASK-020–029 era)

| Source | write_file in session? | Task reports |
|--------|----------------------|--------------|
| `wecp-out-1dhsajlq.txt` | **No** (read/glob/grep/bash only) | — |
| `wecp-out-_1phd3_i.txt` | **No** | — |
| 023–029 Investigate | No usable writes | `reports/` **empty** |
| `wecp-md-*.md` | N/A | **0 bytes** |
| 020/021 `pm-output.md` | From text extract / legacy, not session write | **Validator FAIL** (MISSING_SECTION) |

## Impact

- **0** failed OAT would flip to PASS from resolver alone on observed evidence.
- Recommendation **C**: resolver does not solve root tool-only / no-text failures; optional **B** when writes exist later.

## Resolver risks (if implemented)

- Stale path (`skill/reports/pm-output.md` read in session, not task dir)
- Last-write-wins, 0-byte files, wrong worker path

Contract path: `investigate.json` → `reports/pm-output.md`; `runtime-contracts.json` → `{taskDir}/reports/{worker}-output.md`.