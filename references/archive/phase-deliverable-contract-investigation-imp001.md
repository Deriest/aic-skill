# Phase Deliverable Contract — architecture investigation (IMP-001)

Investigation only — no implementation in IMP-001 session.

## Current split authority

| Layer | What it enforces |
|-------|------------------|
| `.aic/runtime-contracts.json` | Path pattern, minBytes, worker→phases roster |
| `engine/validate-artifact.js` | File exists, size, content-line count |
| `phase-runner.sh` heredocs | Section headings (Investigate pm, Impl be/fe) — FIX-005/006 |
| `validate-implementation-artifact.py` | Impl sections + anti-NDJSON |
| `pm-review.sh` | Generic completeness/quality; **all** `reports/*.md` per gate |
| Task `description` | Shadow contract on OAT tasks |

## Problem

Three authorities → PM REWORK after Runtime accepted lease (e.g. OAT 021). Duplication ~4 layers; ~60% of rules not in JSON.

## Options compared

- **A Markdown files** per phase×worker — readable, weak machine validation.
- **B JSON/YAML schema** — single source; render prompts + one validator + PM rubric inject. **Recommended.**
- **C Engine-only schema** — tight runtime, poor git review, shell duplication.

## Recommended direction

Extend `.aic/` structured contract (B): `requiredHeadings`, `forbiddenPatterns`, `pmRubric`, optional generated MD view for humans.

**Affected (MVP ~3–5d):** phase-runner (remove heredocs), unified validator, pm-review rubric inject, engine optional filter artifacts by phase. **No FSM redesign first.**

## Risks

Migration REWORK on old report shapes; mechanical headings ≠ PM quality — keep PM gate.

## When to load

Planning consolidation after FIX-004/005/006; before adding more bash `IMPL_CONTRACT` blocks.