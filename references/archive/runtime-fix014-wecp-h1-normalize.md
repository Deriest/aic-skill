# FIX-014 — WECP H1 preamble strip

**When:** Implementation PM REWORK for session lines before `# Backend Implementation` / `# Frontend Implementation` while WECP generate PASS (IMP-012, OAT 036).

**Fix:** `worker-execution-pipeline.py` — after `extract_md`, before `validate`: `normalize_artifact_to_contract_h1` using `requiredSections[0]` from phase contract. Preserves YAML frontmatter + blank lines before H1; no change below H1.

**Not:** PM argv, parser, `implementation.json`.

**Verify:** ad-hoc import + 036 artifact samples; OAT needs Implementation phase reached.