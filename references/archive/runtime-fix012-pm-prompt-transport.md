# FIX-012 — PM prompt transport via OpenCode `-f` (IMP-010)

## Problem (034, post–FIX-011)

`pm-review.sh` invoked:

```text
opencode run "$PROMPT_FILE" -m … --format json
```

OpenCode CLI treats the **positional** as `message` (literal text), **not** “load this file as prompt.” The model sees a path string and calls `read(promptFile)`. Without `--auto`, read is rejected → NDJSON has **no `type:text`** → `opencode-json-to-md.py` empty → parser UNKNOWN exit 3.

Artifacts and verdict instructions were **already inside** the generated prompt file; the model never received them as user content.

## Shipped fix (FIX-012)

Only `scripts/pm-review.sh` Node runner — **argv order (IMP-011 / 035):**

```javascript
// CORRECT: short message first positional after run
opencode run <reviewMsg> -m <model> --format json -f <promptFile>

// WRONG: message after -f → OpenCode treats it as file path → empty stdout
opencode run -m <model> --format json -f <promptFile> <reviewMsg>
```

- **`-f`**: CLI-supported file attachment (full generated PM prompt).
- **First positional after `run`**: short review-only reminder (first line `VERDICT: …`; no implementation).
- FIX-011 review-only body in prompt file **unchanged**; parser / `opencode-json-to-md.py` **unchanged**.

## Worker vs PM (do not conflate)

| Path | Pattern | Why it “works” for workers |
|------|---------|----------------------------|
| WECP / `spawn-worker.sh` | `run <path> … --auto` | `--auto` approves `read(path)` so prompt file content is loaded via tools |
| PM (FIX-011+) | `run <msg> -m … --format json -f <file>` without `--auto` | Content attached; message after `-f` is parsed as path (035) |

## Verification (ad-hoc)

```bash
P=scripts/pm-review.sh
bash -n "$P"
grep -q "'-f', promptFile" "$P"
grep -q 'Review the attached prompt' "$P"
! grep -q "run', promptFile, '-m'" "$P"
```

## OAT expectation

Investigate PM: log shows `Invoking PM via opencode`; raw verdict should include assistant **text** with `VERDICT:` line — not tool-only NDJSON. Then Planning can exercise FIX-010 `barrier reconciled`.

## Related

- IMP-009: model implemented instead of verdict (033, with `--auto`).
- IMP-010: positional path transport (034).
- IMP-011: argv order + empty raw + stderr suppression — `references/runtime-pm-opencode-invocation-imp011.md`.
- FIX-011: review-only prompt + no `--auto` on PM (still required with FIX-012).