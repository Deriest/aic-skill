# Engineering Decision Package (EDP) Specification

## Purpose
The EDP enforces a strict boundary between engineering evaluation (decision-making) and framework orchestration (execution). It replaces imperative Resolution Plans which leaked pipeline state into PM prompts. The EDP is strictly **declarative**.

## Verdicts
PM Review verdicts MUST be deterministic. Only the following are allowed:
- `PASS`: Evidence complete, engineering quality acceptable.
- `REWORK`: Evidence present, quality insufficient (requires repair).
- `BLOCKED`: Evidence unavailable, or infrastructure/external failure prevents progress.

**PROHIBITED:** `UNKNOWN`, `MANUAL_APPROVAL_REQUIRED`.

## EDP YAML Schema
The PM output must conform exactly to this structure (extracted by the dispatcher):

```yaml
verdict: PASS | REWORK | BLOCKED
reason: <string summarizing the decision>

# Required ONLY if verdict is REWORK or BLOCKED
decision_package:
  owner: <string (Domain responsible, e.g., Frontend, Infrastructure)>
  root_cause: <Declarative statement of technical gap>
  engineering_objective: <Declarative statement of required end-state>
  expected_deliverables:
    - <artifact_name.md>
  completion_criteria:
    - <Measurable condition to pass next review>
```

## Strict Component Responsibilities
- **PM**: Evaluates evidence, assigns domain `owner`, defines `objective` and `deliverables`. NEVER executes recovery, retries tools, or alters pipeline states.
- **Dispatcher**: Mechanical routing. Maps `owner` to worker instance, sets phase barriers for `deliverables`, and resumes pipeline. Never interprets engineering intent.
- **Recovery Engine**: Pre-PM infrastructure resilience (retries, degraded mode, artifact fallbacks). Shields PM from noise. Never performs engineering review. Exhaustion yields a `BLOCKED` reason to the PM.
- **Workers**: Implementation details. Consumes `objective` and `root_cause`. Produces `deliverables`. Decides the "how" autonomously.
