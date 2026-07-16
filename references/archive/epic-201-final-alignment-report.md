# EPIC-201 — Final Architecture Alignment Report

**Date:** 2026-07-14  
**Authority:** Frozen `references/epic-201-wp201-intake-routing-architecture.md` + refinement docs  
**Scope:** Compare shipped intake implementation (WP-201/WP-202 + Phase 2) vs frozen architecture  
**Verdict:** **NOT fully aligned** — pre-freeze deterministic baseline; LLM-assisted Discovery layer is **architecture only**.

---

## 1. Architecture Alignment Matrix

| Component | Frozen architecture | Implementation status | Evidence |
|-----------|---------------------|----------------------|----------|
| **Four intake modes** (Conversation / Quick / Discovery / From PRD) | Required | **Fully Implemented** | `scripts/intake-evaluate.py` `evaluate()`; `verify-wp202-intake.sh` |
| **Deterministic completeness** (PASS/FAIL, no %) | Required | **Fully Implemented** | Checklist YAML + `field_present()` regex |
| **PRD Intent Resolution** (Review/Improve/Arch/Estimate/Build; one clarify) | Required | **Fully Implemented** | `detect_prd_intent()`, early returns §1.6 |
| **Approval before pipeline** | Required | **Partially Implemented** | `--state-approve`, `operator_approved` in JSON; Dispatcher SKILL text; **no hard gate in engine** (by design) |
| **Requirement Context Engine** (Chat + PRD + Repo) | Required | **Partially Implemented** | Concat PRD text + `extract_repo_context()` heuristics; **no unified ContextIngestor interface** |
| **Context priority** (User > PRD > Repo > Derived) | Required | **Partially Implemented** | Chat+PRD merged first; repo only for DERIVABLE fallback — **not explicit priority layer** |
| **Domain knowledge packs** (10 types) | Required | **Fully Implemented** | `templates/intake-checklists/*.yaml` (10 domains) |
| **Intake State Manager** (project-scoped) | Required | **Partially Implemented** | `.aic/intake/session.json`; init/increment/approve/show — **schema incomplete vs frozen** |
| **LLM-Assisted Intake** (extractor before validator) | Required (frozen) | **Missing** | No LLM call in `intake-evaluate.py`; regex-only validation |
| **LLM requirement extraction / normalization** | LLM MAY | **Missing** | Not implemented in scripts |
| **LLM clarification question generation** | LLM MAY | **Missing** | Dispatcher manual only; no generator module |
| **LLM PRD drafting** | LLM MAY | **Architecture Only** | Template `PRD_TEMPLATE.md`; no automated draft |
| **Discovery Orchestrator** (loop, state, stop) | Required (frozen) | **Missing** | No orchestrator script; single-shot `evaluate()` |
| **Structured Discovery State** (`known_fields`, `max_questions`, …) | Required (frozen) | **Partially Implemented** | State has `question_count`, `missing_fields`; **no `known_fields`, `max_questions`, `selected_intent`, `project_type` in state** |
| **Question quality rules** (combine fields, no generic Q) | Required (frozen) | **Architecture Only** | Documented in arch doc; **not enforced in code** |
| **Discovery stop conditions** (4 cases + cap summary) | Required (frozen) | **Partially Implemented** | `discovery_bounds.max: 10` in JSON output only; **no enforce increment cap, no Missing Info Summary generator** |
| **Discovery update cycle** (answer → extract → validate → next Q) | Required (frozen) | **Missing** | No iterative loop in codebase |
| **Future context providers** (GitHub/Jira/…) | Extensible, not now | **Architecture Only** | Mentioned in arch §2.2; no plugin interface |
| **Dispatcher routing / RH-002 / RH-004** | Required | **Fully Implemented** (procedure) | `dispatcher-discipline-aic/SKILL.md`, `intake-routing-epic201.md` |
| **Validator as source of truth** | Required | **Fully Implemented** (deterministic slice) | Checklist drives PASS/FAIL; **not fed by LLM object** |
| **Runtime boundary** (Engine/FSM/Barrier/WECP) | Must not change | **Fully Implemented** (preserved) | `verify-wp202-intake.sh` engine diff clean |

---

## 2. Responsibility Alignment

| Role | Frozen | Implemented? |
|------|--------|----------------|
| **LLM** — extraction, normalization, Q-gen, PRD draft | MUST NOT route/approve/spawn | **No automated LLM intake path** — gap |
| **Validator** — completeness, mandatory/missing, stop truth | Single source of truth | **Yes** (regex/heuristic validator) |
| **Dispatcher** — routing, approval, workers, pipeline | Owns decisions | **Yes** (skill procedures + CLI flags) |
| **Discovery Orchestrator** — state, loop, count, stop | Does not route/approve/spawn | **No code component** — gap |

---

## 3. Missing / Partial Implementation List

| ID | Gap | Status | Affected files | Effort | Risk |
|----|-----|--------|----------------|--------|------|
| G1 | LLM Requirement Extractor → structured object before checklist | **Missing** | `intake-evaluate.py` or new `intake-extract.py`; Dispatcher prompts in `.aic/prompts/` | **M** (3–5d) | Medium — schema drift vs YAML fields |
| G2 | Discovery Orchestrator loop (state → Q → answer → re-validate) | **Missing** | New `discovery-orchestrator.py` or Dispatcher-only loop in SKILL; state file | **M–L** (5–8d) | Medium — session desync across turns |
| G3 | Structured Discovery State schema alignment | **Partial** | `read_state()` default dict; `write_state` on evaluate | **S** (1d) | Low |
| G4 | LLM question generator fed only `missing_fields` + state | **Missing** | Prompt template + Dispatcher invoke | **S–M** (2–3d) | Low–Med — quality depends on prompts |
| G5 | Enforce stop @10 + Missing Information Summary template | **Partial** | Orchestrator + SKILL reporting | **S** (1–2d) | Low |
| G6 | Context priority layer (explicit merge order) | **Partial** | Refactor evaluate context merge | **S** (1d) | Low |
| G7 | PRD drafting automation post-Discovery | **Missing** | LLM + template merge | **S** (1–2d) | Low |
| G8 | Docs: phase2 summary still says "Zero LLM" | **Drift** | `epic-201-phase2-implementation-summary.md`, `intake-routing-epic201.md` | **S** (doc only) | Low |

**Effort key:** S = small (≤2d), M = medium (3–5d), L = large (1+ week with real-task hardening).

---

## 4. Files Requiring Changes (if aligning to frozen arch)

| File | Change type |
|------|-------------|
| `scripts/intake-evaluate.py` | Extend or split: LLM extraction hook, state schema, cap enforcement |
| `scripts/discovery-orchestrator.py` (new) | Orchestrator loop + stop conditions |
| `references/intake-routing-epic201.md` | Align SOP with LLM-assisted flow |
| `~/.hermes/skills/aic/dispatcher-discipline-aic/SKILL.md` | Discovery loop procedure, structured state payload for LLM |
| `scripts/verify-intake-phase2.sh` / new verify | Tests for state schema, cap, orchestrator |
| `references/epic-201-phase2-implementation-summary.md` | Mark superseded sections (doc hygiene) |

**No changes required:** `scripts/engine/`, `server.js`, `spawn-worker.sh`, WECP, dashboard.

---

## 5. Estimated Total Effort (alignment to frozen arch)

| Workstream | Estimate |
|------------|----------|
| G1 + G6 (context + LLM extract) | 4–6 days |
| G2 + G3 + G5 (orchestrator + state + stops) | 5–7 days |
| G4 + G7 (Q-gen + PRD draft) | 3–4 days |
| Verification + real-task intake | 2–3 days |
| **Total** | **~14–20 engineering days** (Dispatcher/skill layer only) |

---

## 6. Runtime Boundary Confirmation

| Surface | Crossed into runtime? |
|---------|----------------------|
| Engine / FSM / Barrier | **No** |
| WECP / worker execution | **No** |
| `task.start` lifecycle | **No** (procedural gate only) |
| Dashboard | **No** |

---

## 7. Recommendation

**EPIC-201 implementation is NOT fully aligned with the frozen architecture.**

What **is** aligned with the **pre-LLM** EPIC-201 baseline (WP-201/WP-202):

- Four modes, deterministic PASS/FAIL, PRD intent table, domain packs, project-scoped intake JSON, context heuristics (chat/PRD/repo), runtime preserved.

What **is not** aligned with the **final frozen** architecture (LLM-assisted Discovery):

- LLM extraction step, Discovery Orchestrator, structured `known_fields` state, automated Q-generation, iterative update cycle, enforced stop summaries.

**Recommended path (PM choice):**

1. **Option A — New epic / WP-208+:** Implement G1–G7 as "Intake Phase 3 (LLM-Assisted Discovery)" without reopening WP-201 doc freeze.
2. **Option B — Amend freeze:** Re-declare production target as "deterministic intake v1" and defer LLM-assisted Discovery to a later epic (document explicit baseline).
3. **Option C — Minimal bridge:** Extend state schema + Dispatcher SKILL loop only (G3, G5 partial) while keeping regex validator; LLM only for question wording in chat (no new scripts).

**Do NOT claim:** "EPIC-201 implementation is fully aligned with the frozen architecture."

**If PM accepts Option B or completes Option A**, then sequence:

```
Verification (extended) → Real Task (Discovery loop) → Closeout → Commit
```

**Await PM approval** on which option before any implementation.

---

## 8. Explicit statement (required)

> **EPIC-201 implementation is fully aligned with the frozen architecture.**

**FALSE** — withheld per evidence above.