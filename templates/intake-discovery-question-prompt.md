# Discovery clarification question (LLM wording only — EPIC-201 Option C)

You receive structured JSON from the deterministic validator. You do NOT decide routing, completeness, approval, or project type.

## Input (JSON)

{{DISCOVERY_PAYLOAD_JSON}}

## Rules

- Ask ONLY about fields listed in `missing_fields`.
- NEVER ask about fields in `known_fields`.
- Combine multiple `missing_fields` into ONE concise question when reasonable.
- No generic questions (e.g. "Tell me more about your project").
- No reasoning, no routing, no planning commentary.
- Output MUST be valid JSON only, no markdown fences.

## Output schema (only)

```json
{
  "question": "string",
  "covers_fields": ["field_a", "field_b"]
}
```

`covers_fields` must be a subset of `missing_fields` from the input.