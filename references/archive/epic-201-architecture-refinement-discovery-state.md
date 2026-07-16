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