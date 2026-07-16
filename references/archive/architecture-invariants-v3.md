# Architecture Invariants (v3.3.0+)

## 1. Single Production Release Policy
Intermediate milestone commits, tags, and pushes are strictly forbidden. The workflow mandates a single consolidated production release commit at the end of the full milestone lifecycle (after system validation and documentation hygiene).

## 2. Architecture Freeze Gate
Once Architecture is frozen during the Master Planning phase, no new Work Packages, milestones, dependencies, or architectural changes are allowed.
- To change architecture after a freeze, the PM must explicitly unfreeze it.
- Requires Root Cause Analysis and Architecture Impact Assessment.

## 3. Deterministic Engineering Verdicts
The `UNKNOWN` and `MANUAL_APPROVAL_REQUIRED` states are permanently banned from the pipeline state machine and PM Review.
- **Recovery Engine Exhaustion:** If infrastructure recovery (retries, degraded modes) fails, the engine escalates to PM Review with a `BLOCKED` status and a machine-readable reason code (e.g., `InfrastructureFailure`, `PermissionFailure`).
- **PM Review Verdict:** The PM evaluates the available evidence and returns a deterministic `BLOCKED` verdict along with a declarative Engineering Decision Package (EDP).
- The framework must never pause infinitely for human approval without a deterministic state classification and resolution plan.

## 4. Evidence-Based Implementation
Do not assume root causes (e.g., "missing `--auto` flag") before examining the actual files or execution traces. Implementation must strictly follow documented evidence from logs, traces, and code state.
