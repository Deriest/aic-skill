# IMP-024-C — Trivial Task & Implementation Reliability

**Status:** Investigation complete (post IMP-024-A/B). **Not Runtime** — worker prompts, contracts, templates only.

## Symptom

On **Smoke-*** / **verify-only** tasks (`001`, `003`):

- Planning PM **PASS** with **noop** artifacts ("already exists, no changes")
- **Implementation** barrier: one of **backend** or **frontend** missing report or WECP `FAILED_AFTER_REPAIR` (MISSING_SECTION, SECTION_TOO_SHORT)
- Nondeterministic which impl worker fails across reruns (001 backend ok / frontend missing; 003 opposite)

## Contrast (success)

- **002** minimal sentence task → COMPLETE, both impl reports present
- **045** full Runtime OAT → rich artifacts, Closeout PASS

## Root cause (primary)

| Category | Issue |
|----------|--------|
| **Prompt Compliance** | Verify-only description → model skips tools, writes noop prose |
| **Worker Template** | Full Implementation contract on doc-only smoke → thin content fails validator |
| **OpenCode Behaviour** | Crafter variance; asymmetric backend vs frontend |

**Not** extraction/session (024-A/B), **not** FSM/barrier/PM engine.

## Shipped (IMP-024-C worker layer)

| Script | Role |
|--------|------|
| `trivial-task-classifier.py` | `{"trivial": true}` from context title+description |
| `trivial-task-prompt.py` | guidance + impl template + `noop-regen` header |
| `worker-noop-detector.py` | Unsupported noop if phrase + **len ≥ 80** + no path evidence |
| `phase-runner.sh` | `TRIVIAL_TASK_BLOCK`, `IMPLEMENTATION_TRIVIAL_BLOCK` |
| `worker-execution-pipeline.py` | `noop_regen_once()` once before validate |

Verify: `bash scripts/hermes-verify-imp024c.sh` → `OK_IMP024C_HERMES_VERIFY`

**Focused smoke:** after boundary PASS, `POST /api/runtime/intent` `task.cancel` — not `/api/task-cancel`.

## Structural (future)

- `phase-contract-loader` profile for `Smoke-*` / `OAT *` titles
- Paired impl regen hint in WECP config

## Historical

- **047** pm NDJSON = pre-024-A legacy `cp` fallback (fixed)
- **046** user cancel, not worker failure

## Commits reference

`7c36a44` IMP-024-B, `0916f9f` IMP-024-A, `3e98b02` FIX-023, `45b04e8` Runtime bundle