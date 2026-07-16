# FIX-011 — PM Review invocation isolation

## Problem (033)

`pm-review.sh` invoked `opencode run ... --auto`. PM model implemented engineering work (e.g. CORS patches) instead of returning `VERDICT:`. Parser correctly → UNKNOWN exit 3 → BLOCKED. Not a parser bug (FIX-004).

## Shipped fix

- Prompt: review only; no implement / edit / tools.
- First non-empty line must be exactly `VERDICT: PASS|REWORK|BLOCKED`.
- PM invocation: **omit `--auto`** (workers still use `--auto` via `spawn-worker.sh`).

## Verification

Ad-hoc: `grep review only pm-review.sh`; `! grep --auto pm-review.sh`; `bash -n pm-review.sh`.

## OAT

No engine restart required for shell-only change. Expect parseable verdict on Investigate PM gate.

## Follow-on (034)

Removing `--auto` alone did not deliver prompt content: positional path still triggered `read(promptFile)` with no text output. **FIX-012** attaches prompt via `opencode run -f` — see `references/runtime-fix012-pm-prompt-transport.md`.