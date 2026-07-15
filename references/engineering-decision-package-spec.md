# Engineering Decision Package (EDP) Specification

**Version:** 1.0.0 (v3.3.0 Architecture Freeze)

## 1. Purpose
The Engineering Decision Package (EDP) is the single source of truth for engineering decisions within the AIC framework. It enforces a strict boundary between engineering evaluation (decision-making by the PM) and framework orchestration (execution by the Dispatcher). It replaces the previous imperative "Resolution Plan".

## 2. Design Principles
- **Declarative:** States the required end-state, never the steps to achieve it.
- **Deterministic:** Only three engineering verdicts allowed (PASS, REWORK, BLOCKED). No UNKNOWN or MANUAL_APPROVAL_REQUIRED.
- **Machine-readable:** Structured cleanly as YAML inside PM output.
- **No workflow leakage:** PM requests deliverables; Dispatcher orchestrates phases.

## 3. EDP Schema (YAML)
```yaml
verdict: PASS | REWORK | BLOCKED
reason: <string summarizing the decision>

# Required ONLY if verdict is REWORK or BLOCKED
decision_package:
  owner: <string (e.g., Frontend, Backend, Infrastructure)>
  root_cause: <Declarative statement of the technical gap. No actions.>
  engineering_objective: <Declarative statement of the required end-state>
  expected_deliverables: 
    - <string (e.g., frontend-output.md)>
  completion_criteria: 
    - <string (measurable condition to pass next review)>
```

## 4. Verdict Definitions
- **PASS:** Evidence complete, canonical spec met. Dispatcher advances pipeline.
- **REWORK:** Evidence present, but engineering quality insufficient. Dispatcher resolves `owner` to a worker, sets a phase barrier for `expected_deliverables`, and spawns the worker with the `engineering_objective`.
- **BLOCKED:** External dependency or infrastructure failure prevents progress (if recovery exhausted). Dispatcher resolves `owner`, sets barrier, and triggers resolution sequence.

## 5. Invariants
- **PM Exclusivity:** The PM is the ONLY producer of an EDP.
- **Immutability:** Once emitted, the EDP is immutable.
- **No Interpretation:** Dispatcher mechanically routes based on EDP fields; it never interprets engineering intent.
- **No Recovery in EDP:** The Recovery Engine handles infrastructure failures *before* the PM sees them. EDP handles *engineering* failures.