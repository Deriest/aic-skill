# Provider compatibility with WECP (IMP-004)

## Config

- Provider `aic` via `@ai-sdk/openai-compatible` in `~/.config/opencode/opencode.jsonc`
- Models: Opus (thinker), Sonnet (crafter), Haiku (sprinter)
- Same argv on legacy and WECP paths

## Answers (evidence-backed)

1. **Completion Contract compliant?** No under `--auto` — sessions end on tool-calls without full markdown text.
2. **Terminate after tool calls only?** Yes — valid API / OpenCode behavior.
3. **Guarantee final text turn?** No.
4. **WECP reliable on this provider?** Not with current invocation.
5. **Production suitable?** No until invocation or artifact strategy changes.

## Classification

**AIC integration defect** — `--auto` + single-shot + text-only extraction assumption.

## Minimal corrective directions (not implemented in investigation)

1. Stronger generate prompt / WECP retry on empty text
2. Fallback `opencode run` **without** `--auto`
3. Artifact from `write_file` when present (see `artifact-resolution-imp005.md` — **0** writes in failed OAT JSON)

Provider itself is not broken; session behavior is.