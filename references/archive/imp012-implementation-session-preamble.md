# IMP-012 — Implementation artifact session preamble (OAT 036)

## When to load

Runtime OAT reached **Implementation PM REWORK** after **FIX-013 PM PASS** on Investigate/Planning. PM cites **session-style lines before required H1**, not NDJSON dumps (distinct from FIX-005 / OAT 020).

## Symptom (036)

| File | Lines before `# … Implementation` |
|------|--------------------------------------|
| `backend-output.md` | `Exploring the codebase…`, meta implementation lines |
| `frontend-output.md` | `Reading phase plan…`, blank lines |

PM: drop preamble so file **starts at** `# Backend Implementation` / `# Frontend Implementation`. Optional: clean messy `## Result` (stray fences).

## Contract (`.aic/phase-contracts/implementation.json`)

- `forbidSessionDump: true`, `promptRules` forbid session transcripts
- `requiredSections` — all present **after** preamble

## Gap: WECP vs PM

| Gate | Preamble "Exploring/Reading…" |
|------|------------------------------|
| WECP `generate PASS` | Often **still PASS** |
| `validate-phase-artifact.py` `is_session_dump` | Focuses NDJSON/tool markers in head — **may not flag** narrative preamble |
| **PM Review** | **REWORK** — legitimate |

Planning workers (`pm-output.md` "Gathering evidence…") can have same leakage; Planning PM may still PASS if content substantive — Implementation PM was stricter on 036.

## Would preamble-only removal yield PASS?

**Yes** per PM text on 036: after preamble + Result cleanup, "required sections, scope, and verification look acceptable."

## Minimal corrective action (do not implement in investigation)

1. **Post-extract normalize:** strip everything before first line matching `requiredSections[0]` for Implementation roles.
2. **WECP repair prompt:** "Artifact must begin with `# Backend Implementation` — no exploration lines."
3. **Validator:** extend `is_session_dump` or add `mustStartWithH1` from contract.

**Classification:** primary **WECP extraction** (final markdown not normalized); secondary worker prompt / validator–PM alignment.

**Runtime:** no change — REWORK → BLOCKED is correct.