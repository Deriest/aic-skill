# Epic 201 Consolidated

> **Consolidated from 9 files.** Originals archived in `references/archive/`.

**Original files merged:**
- `epic-201-architecture-refinement-discovery-state.md`
- `epic-201-architecture-refinement-llm-assisted.md`
- `epic-201-final-alignment-report.md`
- `epic-201-final-verification-gate.md`
- `epic-201-INDEX.md`
- `epic-201-option-c-closeout.md`
- `epic-201-option-c-intake.md`
- `epic-201-phase2-implementation-summary.md`
- `epic-201-wp201-intake-routing-architecture.md`

---

---

## Source: `epic-201-architecture-refinement-discovery-state.md`

# Final Architecture Refinement Summary (Discovery State & Quality)

## 1. Sections Updated
Modified `references/epic-201-wp201-intake-routing-architecture.md`:
- **§1.4 Discovery process rules:** Added strict rules for LLM Question Generation (no generic questions, combine fields, avoid repetition). Replaced simple question cap logic with explicit Stop Conditions and the mandate to emit a Missing Information Summary if capped at 10.
- **§2.2 Evaluator design:** Added the `Discovery Update Cycle` loop concept. Integrated the concept of providing a `Structured Discovery State` JSON to the LLM (preventing free-form generation) and explicitly listed future context providers (Linear, Notion, Jira, GitHub, Local KB) as compatible with the Context Collection phase.
- **§5 Routing Decision Tree:** Updated the fail path under the Discovery Orchestrator to reflect the full 7-step iterative loop (Provide State → Generate Q → Answer → Extract → Validate → Update State → Check Cap/Pass).

## 2. Refinement Summary
The Discovery process transitions from a passive "wait for user to hit limits" model to an actively orchestrated, LLM-assisted state machine.
- **Structured State:** The LLM is forced to rely on a strict JSON payload (`known_fields`, `missing_fields`, `question_count`) provided by the Deterministic Validator, preventing hallucinated requirements.
- **Iterative Loop:** The architecture now formally loops requirement extraction and validation against each user response, rather than regenerating questions from scratch.
- **Stop Conditions:** Clearly defined exit paths (All PASS, Validator override, Operator override, or Hard Cap 10).

## 3. Runtime Confirmation
- **Engine / FSM / Barrier / WECP / Worker Execution:** **100% Unchanged.**
- All modifications are strictly architectural concepts applied to the pre-pipeline Dispatcher Intake layer logic. No implementation code or runtime scripts were modified.

EPIC-201 Architecture is now FROZEN. Awaiting PM Review.
---

## Source: `epic-201-architecture-refinement-llm-assisted.md`

# Architecture Refinement Summary (LLM-Assisted Discovery)

## 1. Architecture Sections Updated
Modified `references/epic-201-wp201-intake-routing-architecture.md`:
- **§1.1 Position in the system:** Updated diagram to show Context Collection → LLM Extractor → Deterministic Validator.
- **§1.4 Discovery process rules:** Added rule that LLM generates questions based *only* on the validator's missing fields list.
- **§2.2 Evaluator design:** Formally split responsibilities. LLM owns language understanding (extraction, question gen, PRD drafting). Dispatcher/Validator owns routing, approval, execution, and gap calculation. Added `Discovery Orchestrator` to the FAIL routing path.
- **§5 Routing Decision Tree:** Updated flow chart to include LLM Extraction and the Discovery Orchestrator loop.

## 2. Components Affected
- **`RequirementCompletenessEvaluator` (Logical):** Will shift from applying regex directly to text to applying checks to an LLM-structured requirement object.
- **`Discovery Orchestrator` (New Logical Component):** A state-machine loop that manages the Q&A boundaries, invokes the LLM Question Generator, and aggregates user answers.
- **Dispatcher Intake Protocol (`SKILL.md`):** Will need to orchestrate the LLM calls before hitting the deterministic evaluator.

## 3. Implementation Impact (Future Work)
- `scripts/intake-evaluate.py` will require a structural shift. The current heuristic/regex `field_present()` logic will be replaced or augmented by an LLM extraction pass (e.g., prompting the active model to extract known facts into a JSON schema matching the YAML fields).
- A new Discovery loop mechanism will be needed. Currently, the evaluator just returns `intake_mode: discovery`. The new architecture requires the Dispatcher to actively loop: Call Validator → Get Missing Fields → Prompt LLM for 1 question → Await user → Update Context → Loop.

## 4. Runtime Confirmation
- **Engine, FSM, Barrier, WECP, Worker execution, and Dashboard remain 100% unchanged.**
- The refinement strictly applies to the pre-pipeline Dispatcher Intake layer. No code was modified during this refinement pass.
---

## Source: `epic-201-final-alignment-report.md`

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
---

## Source: `epic-201-final-verification-gate.md`

# EPIC-201 — Final Verification Gate Report

**Date:** 2026-07-14  
**Phase:** Verification only (no code changes, no commit, no push)  
**Evidence:** Ad-hoc scripts `verify-wp202-intake.sh`, `verify-intake-phase2.sh`, `verify-option-c-intake.sh`, supplemental Python OAT

---

## 1. Verification Matrix

| Area | Check | Result | Evidence |
|------|-------|--------|----------|
| **A. Intake Routing** | Conversation | **PASS** | `--case conversation` → `pipeline_allowed: false` |
| | Quick | **PASS** | `--case quick` + micro-quick text → `quick`, `pipeline_allowed: true` |
| | Discovery | **PASS** | `--case discovery` + biochar text → `discovery`, `pipeline_allowed: false` |
| | From PRD (Review/Improve/Arch/Estimate/Build/upload) | **PASS** | 6 cases in `verify-wp202-intake.sh` |
| **B. Completeness** | PASS/FAIL deterministic | **PASS** | No confidence % in evaluator output |
| | PRESENT / MISSING / DERIVABLE | **PASS** | Phase2 PRD+repo test |
| | Mandatory vs optional in output | **PASS** | `mandatory` map includes optional fields |
| | LLM does not route | **PASS** | No LLM API in `intake-evaluate.py` (only field keywords + payload builder) |
| **C. Context Engine** | Chat + PRD + Repo | **PASS** | `full_context` + `extract_repo_context` |
| | Context priority explicit layer | **PARTIAL** | Implicit merge (chat+PRD first, repo for DERIVABLE); not a named priority engine |
| **D. Discovery** | min/max bounds in output | **PASS** | `discovery_bounds` min 3 max 10 |
| | Structured state | **PASS** | `known_fields`, `missing_fields`, `question_count`, `max_questions` in state |
| | Stop conditions (validator) | **PASS** | `discovery_stop` mandatory_complete / question_limit |
| | No repeated Q enforcement | **PARTIAL** | Policy in prompt + SKILL; **not** automated in code |
| | Never ask completed fields | **PARTIAL** | Prompt rules + `missing_fields` list; **not** runtime-enforced on LLM output |
| **E. Option C LLM** | Structured payload only | **PASS** | `--discovery-payload`, `llm_question_input` |
| | LLM wording only (code path) | **PASS** | Script emits payload; LLM invocation is Dispatcher-side |
| | Validator authoritative | **PASS** | `missing_for_planning` from regex/checklist only |
| **F. State Manager** | init / increment / approve / show | **PASS** | Phase2 + Option C scripts |
| | Timestamps | **PASS** | `created_at`, `updated_at` on write |
| | Session isolation | **PASS** | Ad-hoc: two temp dirs, independent `question_count` and `operator_approved` |
| **G. Domain Packs** | 10 YAML types load | **PASS** | website/generic + 8 new packs in verify scripts |
| **H. Runtime Regression** | engine/index.js | **PASS** | `git diff` 0 bytes; verify script guard |
| | server.js | **PASS** | `git diff` 0 bytes |
| | FSM / Barrier / WECP / workers / dashboard | **PASS** | No changes in committed intake scope to those surfaces |
| **I. Dispatcher Rules** | RH-001–004 documented | **PASS** | `dispatcher-discipline-aic/SKILL.md` (Hermes profile) |
| | RH-004 procedure live-tested | **PARTIAL** | Not re-run full Dispatcher session in this gate |

**Suite tokens:** `OK_WP202_INTAKE_VERIFY`, `OK_WP203_INTAKE_VERIFY`, `OK_EPIC201_OPTION_C_VERIFY`

---

## 2. Regression Report

| Surface | Regression observed |
|---------|---------------------|
| Engine / FSM / Barrier / WECP | **None** |
| Worker execution / spawn-worker | **None** |
| Pipeline lifecycle API | **None** |
| Dashboard | **None** |
| WP-202 routing cases (9) | **None** — all PASS post Phase 2 + Option C |

---

## 3. Real Task / OAT Evidence

| # | Scenario | Result | Notes |
|---|----------|--------|-------|
| 1 | Conversation | **PASS** | `jelaskan barrier` → no pipeline |
| 2 | Quick | **PASS** | typo+README+AC → quick, pipeline allowed |
| 3 | Discovery | **PASS** (simulated) | Validator FAIL → payload; pipeline blocked pre-approval; **PRD file generation not automated in scripts** (Dispatcher manual) |
| 4 | From PRD intents | **PASS** | Scripted cases; only Build allows pipeline when gap PASS |
| 5 | Option C loop | **PASS** (simulated) | Turn1 missing 5 → Turn2 answer → missing 3; contract JSON for LLM output |

**Not executed in this gate:** Live Hermes chat with real LLM question generation (production path is Dispatcher + template).

---

## 4. Known Issues (non-blocking for Option C closeout)

| ID | Issue | Severity |
|----|-------|----------|
| K1 | Full frozen architecture (LLM extraction + in-repo orchestrator loop) **not** implemented — **by PM Option C** | Documented |
| K2 | `evaluate()` sets `operator_approved: true` when `pipeline_allowed` on auto state sync — may skip explicit `--state-approve` on Quick PASS | Low |
| K3 | `discovery_stop` has no `operator_stop` code flag — operator stop is procedural | Low |
| K4 | Dispatcher SKILL changes live under `~/.hermes/skills/aic/` — may diverge from git repo | Low |
| K5 | Context priority not a separate module — behavior correct for tests, not spec-formalized | Low |

---

## 5. Recommended Fixes (optional, post-closeout)

1. **K2:** Only set `operator_approved` via `--state-approve`, never from `pipeline_allowed` auto-sync.  
2. **K4:** Copy RH-004 Option C block into repo-tracked skill or document sync step in closeout checklist.  
3. **OAT:** One live Discovery session with LLM + operator answers recorded as artifact.

**No fixes required for verification gate PASS** under approved scope (WP-201/202 + Phase 2 + Option C).

---

## 6. PM Readiness

### **READY FOR CLOSEOUT**

**Rationale:** All automated verification for delivered scope passes; runtime regression zero; Option C contract and validator authority verified. Residual items are documented limitations vs **full** frozen architecture (see `epic-201-final-alignment-report.md`), already accepted via **Option C**.

**Not chosen:** REQUIRES REWORK (no verified defect blocking closeout).

---

## Rules compliance

- Verification only: **yes** (no code edits this gate)  
- No commit / push / release: **yes**  
- Stop after report: **yes**
---

## Source: `epic-201-INDEX.md`

# EPIC-201 documentation index

| Document | Role |
|----------|------|
| `epic-201-wp201-intake-routing-architecture.md` | **Frozen** architecture authority |
| `intake-routing-epic201.md` | Dispatcher operator SOP (WP-202) |
| `wp202-intake-implementation-summary.md` | WP-202 closeout |
| `epic-201-phase2-implementation-summary.md` | Phase 2 (context, state, packs) |
| `epic-201-architecture-refinement-llm-assisted.md` | Refinement record (LLM-assisted) |
| `epic-201-architecture-refinement-discovery-state.md` | Refinement record (Discovery state) |
| `epic-201-final-alignment-report.md` | Implementation vs frozen arch |
| `epic-201-option-c-closeout.md` | Option C closeout |
| `epic-201-final-verification-gate.md` | Verification gate report |
| `epic-201-option-c-intake.md` | Router pointer (repo skill) |

**Scripts:** `scripts/intake-evaluate.py`, `verify-wp202-intake.sh`, `verify-intake-phase2.sh`, `verify-option-c-intake.sh`

**Templates:** `templates/intake-checklists/*.yaml`, `templates/intake-discovery-question-prompt.md`, `templates/PRD_TEMPLATE.md`

**Superseded for routing:** `dispatcher-discovery.md` confidence % — intake uses checklists only.
---

## Source: `epic-201-option-c-closeout.md`

# EPIC-201 Option C — Implementation Closeout

## Scope delivered
- **LLM-Assisted Question Generation** only: structured payload + prompt template + Dispatcher procedure.
- Validator, routing, approval, and pipeline rules unchanged (deterministic).

## Files modified
| File | Change |
|------|--------|
| `scripts/intake-evaluate.py` | `build_discovery_llm_payload`, `discovery_stop_reason`, extended state schema, `llm_question_input` / `discovery_stop` on discovery, `--discovery-payload` |
| `references/intake-routing-epic201.md` | Discovery LLM wording note |
| `~/.hermes/skills/aic/dispatcher-discipline-aic/SKILL.md` | RH-004 Discovery loop (Option C) |

## Files added
| File | Change |
|------|--------|
| `templates/intake-discovery-question-prompt.md` | LLM input/output contract |
| `scripts/verify-option-c-intake.sh` | Ad-hoc verification |
| `references/epic-201-option-c-closeout.md` | This summary |

## Real task (simulated Discovery)
See verification script section `== Real Discovery simulation ==` output in ad-hoc run.
---

## Source: `epic-201-option-c-intake.md`

# EPIC-201 Option C — intake closeout (repo skill)

Same content as `dispatcher-discipline-aic` → `references/epic-201-option-c-intake.md`.

**Router:** IF EPIC-201 Option C / `--discovery-payload` / `llm_question_input` / Discovery LLM wording → load `dispatcher-discipline-aic` (RH-004) + this ref + repo `references/epic-201-wp201-intake-routing-architecture.md`.

**Verify:** `scripts/verify-option-c-intake.sh` in workflows/aic repo.
---

## Source: `epic-201-phase2-implementation-summary.md`

# EPIC-201 — Intake Implementation Summary (Milestones A, B, C)

## Files Modified
| File | Changes |
|------|---------|
| `scripts/intake-evaluate.py` | Added PRD/Repo context extraction; implemented `--state-*` CLI args and `.aic/intake/<project>.json` session handling. Evaluator modified *once*. |
| `dispatcher-discipline-aic/SKILL.md` | Updated Dispatcher routing rules to require `--state-approve` before `task.start`. |

## Files Added
| File | Role |
|------|------|
| `templates/intake-checklists/*.yaml` | 8 new domain packs (mobile_app, api, ai_agent, desktop_app, library, cli, devops, documentation). |
| `scripts/verify-intake-phase2.sh` | Automated verification for Context Engine and State Manager. |

## Implementation Summary
- **Milestone A (Context Engine):** `intake-evaluate.py` now parses chat, PRD files (via `--prd`), and targeted repository files (via `--dir`). Repo scanning is limited to `package.json`, `README.md`, `go.mod`, etc., satisfying `DERIVABLE` states efficiently without LLM parsing.
- **Milestone B (State Manager):** Intake sessions are project-scoped in `.aic/intake/<project>.json` to track `question_count`, `missing_fields`, and `operator_approved`. Dispatcher manages state via `--state-init`, `--state-increment`, and `--state-approve`.
- **Milestone C (Domain Packs):** Completed 100% of WP-201 specified project domains using the exact YAML schema from WP-202.

## Verification Evidence
Execution of `scripts/verify-intake-phase2.sh` confirms:
1. PRD keywords return `PRESENT`.
2. Repo hints (`package.json`) return `DERIVABLE`.
3. State mutations persist correctly (incrementing counters).
4. All 8 new domain packs load successfully.

## Real Task Validation
*Dispatcher routing rules in SKILL.md updated. Ready for live testing of bounded Discovery loops and PRD intent resolution.*

## Regression Report
- Runtime (Engine, FSM, Barrier, WECP) remains 100% untouched.
- Dashboard remains untouched.
- `intake-evaluate.py` remains a synchronous, deterministic CLI tool.

## Remaining Work
None. EPIC-201 implementation scope is complete. Awaiting PM review for final Real Task Validation and closeout.
---

## Source: `epic-201-wp201-intake-routing-architecture.md`

# EPIC-201 — WP-201 Intake Routing Architecture

**Status:** Planning only (architecture freeze candidate)  
**Authority:** PM-approved decisions in EPIC-201 brief  
**Out of scope:** Runtime, workers, FSM, implementation

---

## 1. Intake Routing Architecture

### 1.1 Position in the system

Intake sits **before** the engineering pipeline (Investigate → Planning → …). It is **Dispatcher-owned classification**, not a Runtime phase.

```
User message
    ↓
Context Collection (Chat + PRD + Repository)
    ↓
LLM Requirement Extractor (Normalize to Object)
    ↓
Deterministic Validator (Completeness Checklist)
    ↓
Missing Fields
    ↓
Dispatcher Decision (Intent + Intake Mode)
    ↓
[Conversation] → respond only (RH-002)
[Quick]        → Requirement Completeness PASS → Approval (if needed) → task.create/start
[Discovery]    → Q&A (LLM Generated) → PRD_<Project>.md → Operator Approval → Architecture → Planning → …
[From PRD]     → PRD Review → Gap Analysis → Operator Approval → Planning → …
```

**Invariant:** Pipeline (`task.start` / full Investigate-as-engine-phase) **MUST NOT** start until operator approves PRD (Discovery or From PRD path) or Quick path proves completeness per checklist (see §2).

### 1.2 Four intake modes (frozen)

| Mode | Trigger | Pipeline |
|------|---------|----------|
| **Conversation** | No engineering task requested | **Never** enter pipeline |
| **Quick** | Engineering task + completeness **PASS** | Skip Discovery; may still use Investigate phase for repo evidence, but **not** Discovery Q&A |
| **Discovery** | Engineering task + completeness **FAIL** | Discovery process only until PRD + approval |
| **From PRD** | User supplies formal requirements artifact | Skip Discovery; PRD Review + Gap Analysis |

No fifth mode (e.g. “Auto-Discovery”, “Lite-PRD”, “Confidence path”) without a new epic.

### 1.3 Relationship to RH-002 (Intent Boundary)

| User says | Max intake | Max pipeline without approval |
|-----------|------------|-------------------------------|
| “explain …” | Conversation | — |
| “check GitHub” | Quick or Conversation | Investigate-only if classified as investigation, **not** Planning |
| “build X” incomplete | Discovery | **Stop** at PRD + approval |
| “here is the PRD” | From PRD | Gap Analysis → approval → Planning |

Dispatcher **never** auto-escalates Conversation → Discovery → Planning (RH-002).

### 1.4 Discovery process rules (frozen)

- **Not mandatory** — only when completeness FAIL.
- **LLM Question Generation:** The LLM generates clarification questions based *only* on the **Structured Discovery State** (missing fields, count) + existing conversation.
  - Ask only about missing fields; never ask about completed fields.
  - Combine multiple missing fields into one question whenever reasonable.
  - Avoid repeating previous questions and generic/open-ended questions (e.g., "Tell me more").
  - Prefer specific, answerable questions.
  - Minimize the total number of questions.
- **Stop Conditions:** Discovery ends immediately when ANY of the following is true:
  1. All mandatory fields are complete.
  2. The validator confirms Planning can safely begin.
  3. The operator explicitly stops Discovery.
  4. The maximum question limit (10) is reached.
- **Limit Reached (10 Qs):** If capped, Dispatcher MUST produce: **Missing Information Summary**, **Current Requirement Status**, and **Recommended Next Action**. Do **not** continue asking questions indefinitely.
- **Artifact:** `PRD_<ProjectName>.md` (e.g. `PRD_AIC_Website.md`). **No** `DISCOVERY.md` as official output.
- **Approval gate:** Discovery → PRD → **Operator Approval** → Architecture (spec) → Planning → Implementation.

### 1.5 From PRD path (frozen)

User supplies any of: PRD, BRD, SRS, Requirements doc, GitHub Issue, Jira Ticket (structured requirement source).

Flow:

```
From PRD
  → PRD Review (read + normalize)
  → Gap Analysis (checklist vs domain)
  → Operator Approval
  → Planning (engine pipeline)
```

**Skip Discovery** entirely.

### 1.6 PRD Intent Resolution

Purpose: Determine what the operator wants to do with the supplied PRD before entering any engineering pipeline.

A PRD does NOT automatically imply Build. The **Approval Gate applies ONLY when the selected intent is Build.** Review, Improve, Architecture, and Estimate must NOT enter Planning or spawn workers.

| User Request | Dispatcher Action |
|--------------|-------------------|
| Upload PRD only (no intent) | Ask ONE clarification question: "What would you like me to do? 1. Review 2. Improve 3. Generate Architecture 4. Estimate 5. Build" |
| Review PRD | Execute intent immediately (no pipeline/planning) |
| Improve PRD | Execute intent immediately (no pipeline/planning) |
| Generate Architecture | Execute intent immediately (no pipeline/planning) |
| Estimate | Execute intent immediately (no pipeline/planning) |
| Build from PRD | Gap Analysis → Operator Approval Gate → Planning (engine pipeline) |

---

## 2. Requirement Completeness Architecture

### 2.1 Single question

> **Do we have enough information to begin Planning safely?**

Answer: **`PASS`** | **`FAIL`** | **`NOT_APPLICABLE`** (Conversation only).

**No** probabilities. **No** confidence percentages. **No** PM 0–100 score (supersedes legacy `dispatcher-discovery.md` confidence model for intake routing).

### 2.2 Evaluator design

**Architecture:** LLM-Assisted, Deterministic-Controlled Intake.

**Responsibilities:**
- **LLM:** Requirement extraction, normalization, classification, question generation, and PRD drafting. MUST NOT decide routing, approval, execution, or completeness.
- **Dispatcher / Deterministic Logic:** Completeness validation, gap calculation, routing, approval gating, question limit enforcement, and pipeline execution.

**Component:** `RequirementCompletenessEvaluator` (logical module; implementation in WP-202+).

**Inputs:**

1. `project_type` (domain enum, §3)
2. `user_text` + optional attachments (PRD path)
3. `project_path` signals (repo layout, read-only)
4. Explicit operator overrides (`project_type=website` if user states)

**Process:**

1. Context Collection: Gather chat, PRD, and repo heuristics. (Extensible design allows future context providers: GitHub Issues, Jira, Linear, Notion, Local KB).
2. LLM Extraction: Extract and normalize requirement facts into an object.
3. Select **checklist** for `project_type` (§4).
4. For each **mandatory** field (Deterministic Validation): `PRESENT` | `MISSING` | `DERIVABLE` (from repo/docs only).
5. **PASS** iff all mandatory fields are `PRESENT` or `DERIVABLE`.
6. **FAIL** → route **Discovery Orchestrator** (or **From PRD** + Gap Analysis if artifact exists but incomplete).
7. **Discovery Update Cycle:** Iterative loop where the LLM receives the latest **Structured Discovery State** (`project_type`, `known_fields`, `missing_fields`, `question_count`, `max_questions`, `selected_intent`, `operator_approved`) + conversation to generate the next question. The LLM never regenerates from scratch; the Validator remains the source of truth.

**Output (structured, deterministic):**

```yaml
completeness: PASS | FAIL
project_type: website
mandatory:
  business_goal: PRESENT
  target_user: MISSING
  ...
missing_for_planning: [target_user, deployment_target]
recommended_intake: quick | discovery | from_prd
```

### 2.3 DERIVABLE vs Discovery questions

| Source | Intake may mark DERIVABLE | Discovery may ask |
|--------|---------------------------|-------------------|
| README, package.json, existing routes | Tech hints, deploy target | — |
| User-only preferences | — | Business goal, brand, scope |
| Issue/ticket body | Scope if explicit | Ambiguous acceptance criteria |

Rule: Discovery questions only for fields that are **MISSING** and **not DERIVABLE** (aligns with existing discovery discipline).

---

## 3. Project Type Detection Strategy

### 3.1 Supported domains (v1)

| `project_type` | Detection signals (deterministic, ordered) |
|----------------|--------------------------------------------|
| `website` | User says “landing”, “website”, “marketing site”; or `index.html` / Next marketing app without API-only |
| `mobile_app` | “iOS/Android/React Native/Flutter”; `android/`, `ios/` |
| `api` | “REST/GraphQL API”; OpenAPI; `routes/`, no UI |
| `ai_agent` | “agent”, “bot”, “orchestration”; links to Hermes/AIC/opencode |
| `desktop_app` | Electron, Tauri, “desktop” |
| `library` | “npm package”, “library”, publishable pkg without app entry |
| `cli` | “CLI”, `bin/`, commander/yargs |
| `devops` | “pipeline”, “k8s”, “terraform”, `.github/workflows` focus |
| `documentation` | “docs only”, “guide”, no code change |
| `unknown` | No match → use **generic** checklist (stricter: more mandatory fields) |

### 3.2 Detection algorithm (deterministic)

```
1. If user declares type explicitly → use it (wins).
2. Else if attachment is Issue/Ticket → infer from labels/title keywords (api, ui, docs).
3. Else if project_path readable → score keyword hits per type; highest wins if margin ≥ 2 hits; else unknown.
4. If unknown → generic checklist; Discovery likely.
```

**No ML.** Tie-break: ask **one** forced-choice question (“Which type: website / API / …?”) — counts toward Discovery question budget.

---

## 4. Checklist Specification

### 4.1 Field states

- **Mandatory (M):** required for Planning PASS.
- **Optional (O):** improves plan quality; does not block Quick.
- **Minimum bar:** all **M** satisfied.

### 4.2 Website

| Field | M/O | Example |
|-------|-----|---------|
| Business goal | M | “Convert leads for biochar product” |
| Target user | M | “Plantation managers in SEA” |
| Pages / IA | M | Home, Product, Contact |
| Core features | M | Form, pricing table, i18n ID/EN |
| Tech stack | O | React + Vite (or DERIVABLE from repo) |
| Deployment | M | Cloudflare Pages / VPS |
| Brand / design constraints | O | “Match AIC-WEB style” |
| Acceptance criteria | M | “Lighthouse > 90”, “mobile 375px” |
| Out of scope | O | “No checkout” |

### 4.3 Mobile App

| Field | M/O | Example |
|-------|-----|---------|
| Business goal | M | |
| Target user | M | |
| Platforms | M | iOS + Android |
| Core user flows | M | Onboarding, login, dashboard |
| Backend dependency | M | Existing API URL or greenfield |
| Offline / push | O | |
| Acceptance criteria | M | |
| App store constraints | O | |

### 4.4 API

| Field | M/O | Example |
|-------|-----|---------|
| Business goal | M | |
| Consumers | M | Mobile app, partners |
| Resources / endpoints | M | CRUD users, orders |
| Auth model | M | JWT, API key |
| SLA / rate limits | O | |
| Data model | M | Entities + relationships |
| Deployment | M | |
| Acceptance criteria | M | Contract tests, OpenAPI |

### 4.5 AI Agent

| Field | M/O | Example |
|-------|-----|---------|
| Business goal | M | |
| Operator persona | M | |
| Tools / integrations | M | Terminal, browser, CRM |
| Safety boundaries | M | No prod writes without approval |
| Model / provider | O | DERIVABLE from .env |
| Acceptance criteria | M | Scenarios + eval set |

### 4.6 Desktop App

| Field | M/O | Example |
|-------|-----|---------|
| Business goal | M | |
| Target OS | M | Win + macOS |
| Core features | M | |
| Update strategy | O | |
| Acceptance criteria | M | |

### 4.7 Library

| Field | M/O | Example |
|-------|-----|---------|
| Problem statement | M | |
| Public API surface | M | Exported functions/classes |
| Target runtime | M | Node 20+, browser |
| Compatibility / semver | M | |
| Acceptance criteria | M | Tests, docs |

### 4.8 CLI

| Field | M/O | Example |
|-------|-----|---------|
| Problem statement | M | |
| Commands / flags | M | |
| Input / output formats | M | stdin JSON, stdout table |
| Exit codes | O | |
| Acceptance criteria | M | |

### 4.9 DevOps

| Field | M/O | Example |
|-------|-----|---------|
| Goal | M | CI for monorepo |
| Target environment | M | prod/staging |
| Current pain | M | Slow deploy, no cache |
| Constraints | M | GitHub Actions only |
| Acceptance criteria | M | Green pipeline < 10m |

### 4.10 Documentation

| Field | M/O | Example |
|-------|-----|---------|
| Audience | M | Operators |
| Scope | M | Runtime OAT guide |
| Source of truth | M | Which repo paths |
| Format | M | Markdown in docs/ |
| Acceptance criteria | M | Reviewed by PM |

### 4.11 Generic (unknown type)

| Field | M/O |
|-------|-----|
| Business goal | M |
| Target user / consumer | M |
| Scope (in / out) | M |
| Constraints | M |
| Acceptance criteria | M |
| Deployment / delivery | M |

---

## 5. Routing Decision Tree

```
START: Parse user message
│
├─ Engineering task requested? ──NO──► Conversation (STOP)
│
YES
│
├─ Context Collection (Chat + PRD + Repo)
├─ LLM Requirement Extraction
│
├─ Formal requirement artifact attached? ──YES──► From PRD
│       │
│       ├─ Gap Analysis PASS ──► Await Operator Approval ──► Planning+
│       └─ Gap FAIL ──► Discovery Orchestrator (bounded Q) OR Missing Info List (if cap reached)
│
NO
│
├─ Detect project_type
├─ Deterministic Requirement Completeness Evaluator
│
├─ PASS ──► Quick
│       └─► Operator confirms scope
│       └─► task.create / pipeline per policy
│
└─ FAIL ──► Discovery Orchestrator
        ├─► Provide Structured Discovery State to LLM
        ├─► LLM Question Generator (Strict Quality Rules)
        ├─► User Response
        ├─► LLM Requirement Extraction
        ├─► Deterministic Validator Update
        ├─► Discovery State Update
        ├─► Check Stop Conditions (PASS, Operator Stop, or Cap 10)
        │      └─► If Cap 10: Emit Missing Info Summary & Recommended Action
        └─► Generate PRD_<Project>.md
        └─► Operator Approval
        └─► Architecture → Planning → …
```

**Hard stops:**

- Conversation → never `task.start` for implementation.
- Discovery without approved PRD → never Planning.
- From PRD with critical gaps → never Planning until Gap Analysis PASS or approved exceptions documented in PRD amendment.

---

## 6. Routing Examples (24)

| # | User input (summary) | Mode | Reason |
|---|----------------------|------|--------|
| 1 | “hai, aic jalan?” | Conversation | No engineering task |
| 2 | “jelaskan barrier di runtime” | Conversation | Explain only (RH-002) |
| 3 | “fix typo di README line 5” | Quick | Scope + file + change clear |
| 4 | “add healthcheck to deploy.sh” | Quick | Single artifact, criteria clear |
| 5 | “buat landing page” | Discovery | Missing pages, goal, deploy |
| 6 | “buat website biochar” | Discovery | Missing IA, features, AC |
| 7 | PRD_Biochar.md attached | From PRD | Formal artifact |
| 8 | GitHub issue #42 with AC | From PRD | Ticket = requirements |
| 9 | “refactor auth module” no AC | Discovery | Scope/constraints missing |
| 10 | “build REST API for orders” + entities listed | Quick | API checklist M satisfied |
| 11 | “build REST API” only | Discovery | No resources/auth/deploy |
| 12 | “React Native app for field workers” + flows | Quick | Mobile M satisfied |
| 13 | “mobile app” only | Discovery | Platforms/flows missing |
| 14 | “CLI to migrate tickets” + commands | Quick | CLI M satisfied |
| 15 | “Hermes skill for X” + tools/AC | Quick | AI agent M satisfied |
| 16 | “perlu agent” tanpa batas | Discovery | Safety/tools missing |
| 17 | “terraform untuk staging” + constraints | Quick | DevOps M satisfied |
| 18 | “update operator guide” + sections | Quick | Documentation M satisfied |
| 19 | “cek github kenapa build fail” | Conversation / Investigate-only | Investigation not build (RH-002) |
| 20 | “investigate PM timeout” | Investigate-only | No planning without ask |
| 21 | Jira SRS paste incomplete deploy | From PRD → Gap FAIL → Discovery | Gap fills deploy |
| 22 | “same as last task” no pointer | Discovery | Missing reference PRD/task id |
| 23 | “implement EPIC-201” + linked PRD | From PRD | Structured epic + doc |
| 24 | After 10 Discovery Q still no deploy | Discovery STOP | Missing Information List |

---

## 7. Risk Analysis

| Risk | Impact | Mitigation |
|------|--------|------------|
| Quick path ships with hidden ambiguity | Rework loops in PM | Mandatory AC field; Quick only when all M PRESENT/DERIVABLE |
| Over-trigger Discovery | Operator fatigue | 5–7 target; repo-derivable fields excluded |
| Under-trigger Discovery | Bad plans | Generic checklist for unknown type |
| Legacy confidence scoring conflicts | Wrong route | Deprecate % in intake; keep for PM artifact optional metadata only |
| From PRD false PASS | Gap Analysis skipped | Checklist applied to normalized PRD sections |
| Dispatcher starts pipeline pre-approval | Trust break | Gate: no `task.start` until approval flag in session/task metadata |
| project_type mis-detect | Wrong checklist | One forced-choice question within 10-Q cap |
| RH-002 violation | Auto-planning | Intent tree overrides Quick |

---

## 8. Recommended Implementation Plan (WP-202+)

**Phase A — Specification (no runtime)**

1. Add `references/intake-routing-rules.md` (normative) + `templates/PRD_TEMPLATE.md` → `PRD_<Project>.md`.
2. Add machine-readable `templates/intake-checklists/*.yaml` per domain.
3. Update `SKILL.md` router: IF intake / PRD / discovery → load intake refs.
4. Patch `dispatcher-discipline-aic`: RH-004 Intake Modes + approval gate language.
5. Mark `dispatcher-discovery.md` confidence section **deprecated for routing** (retain Investigate-phase narrative).

**Phase B — Dispatcher logic (Hermes skill only)**

6. Implement `RequirementCompletenessEvaluator` as deterministic skill procedure (table + yaml), not LLM score.
7. Session state: `intake_mode`, `discovery_question_count`, `prd_path`, `operator_approved_prd: bool`.
8. Wire approval: Dispatcher explicit “Approve PRD?” before `task.create` for net-new scope.

**Phase C — Optional tooling**

9. CLI `aic intake evaluate --type website --text "..."` for operator debugging (no engine change).
10. Dashboard display: intake mode + missing fields (read-only).

**Explicit non-goals for WP-202:** Engine FSM changes, new workers, auto-PM Discovery in runtime.

**Verification:** Table-driven tests: 24 examples → expected mode; 0% confidence in routing output.

---

## Architecture freeze checklist (for PM)

- [x] Four modes only  
- [x] Discovery optional, 3–10 Q, PRD output  
- [x] Approval before pipeline  
- [x] From PRD skips Discovery  
- [x] Deterministic completeness, no %  
- [x] Domain checklists  
- [x] 20+ examples  

**Await PM approval before WP-202 implementation.**