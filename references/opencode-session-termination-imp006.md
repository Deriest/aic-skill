# OpenCode session termination (IMP-006)

Investigation only context; complements `worker-invocation-completion-contract-fix006.md`.

## Current AIC invocation

`opencode run <promptFile> -m aic/<Model> --auto --format json` — single shot, Node timeout, NDJSON → `opencode-json-to-md.py` (`type==text` only).

OpenCode **1.17.18** help: `--auto` auto-approves permissions; `--format json` = raw events; **no** flag to force final assistant text.

## Findings (evidence)

| Question | Answer |
|----------|--------|
| When final assistant message? | When model emits `type:text` NDJSON — **not** guaranteed at exit |
| tool_calls-only termination? | **Yes** — observed; all `step_finish` = `tool-calls` in `wecp-out-*.txt` |
| Expected? | **Yes** for tool-capable agent + `--auto` single run |
| Another interaction needed? | Often in interactive/continue modes; AIC does **not** send follow-up turn |
| Force final response? | **No** documented CLI option |
| `--auto` effect | Enables uninterrupted tool loops |
| `--format json` omits text? | **No** — text absent when model never emits `type:text` |

## Classification

**C** — OpenCode in this mode **cannot guarantee** final assistant output. AIC argv is syntactically correct; mismatch is **execution model** vs WECP deliverable assumption.

Secondary **B** — same CLI, different **mode** needed: no `--auto`, `--continue` second turn, or non-text artifact resolution.

## Recommendation (implementation later)

- Do not expect “fix argv only” to pass WECP OAT.
- Pilot: generate without `--auto`; or `opencode run --continue -s <id>` with “output report only”; pair with artifact resolver if writes appear.
- Document: headless `--auto` = best-effort text, not contract guarantee.

## Related CLI options not used by workers

`-i` / `--interactive`, `-c` / `--continue`, `-s` session, `--variant`, `--thinking`, `--agent`.