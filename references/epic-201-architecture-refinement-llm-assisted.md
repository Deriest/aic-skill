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