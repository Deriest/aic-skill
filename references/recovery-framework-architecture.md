# Recovery Framework Architecture (v3.3.0)

## Principle

PM Review is NOT a retry mechanism. Recovery is a framework. PM Review is a deterministic engineering gate.

## Pipeline Model

```
Worker → Failure Detection → Failure Classification → Recovery Engine → Evidence → PM Review → Verdict + Resolution Plan → Dispatcher executes plan
```

## Recovery Framework

### Failure Classifier
Classifies failures into known classes. Inputs: exit code, stderr, artifact state, timeout flag. Outputs: failure class, severity, recoverable flag.

### Recovery Matrix (extensible)

| Failure Class | Strategy 1 | Strategy 2 | Strategy 3 | If Exhausted |
|--------------|------------|------------|------------|-------------|
| `PermissionDenied` | ArtifactProvider | Retry+`--auto` | Degraded | BLOCKED `PermissionFailure` |
| `Timeout` | Retry | AlternateProvider | — | BLOCKED `InfrastructureFailure` |
| `MissingArtifact` | Wait | ArtifactProvider | Regenerate | BLOCKED `ArtifactMissing` |
| `InvalidArtifact` | Repair | Regenerate | — | BLOCKED `ArtifactMissing` |
| `WorkerCrash` | Respawn | Resume | — | BLOCKED `InfrastructureFailure` |
| `ContextOverflow` | Summarize | Retry | — | BLOCKED `InfrastructureFailure` |
| `Unknown` | Retry | — | — | BLOCKED `InfrastructureFailure` |

### Recovery Strategies (pluggable)
- retry, degraded, alternate-provider, alternate-runtime, alternate-tool, wait, summarize, respawn, resume

Adding a new strategy requires no architecture change. Adding a new failure class = add a matrix row.

## PM Review: Deterministic Verdicts Only

**ALLOWED verdicts:** PASS, REWORK, BLOCKED
**REMOVED:** UNKNOWN, MANUAL_APPROVAL_REQUIRED

BLOCKED is a valid engineering verdict — means evidence/infrastructure unavailable. Includes machine-readable reason.

## PM Review: Verdict + Resolution Plan (Mandatory)

Every PM Review returns TWO outputs: verdict AND resolution plan.

### PASS Resolution
```yaml
verdict: PASS
resolution:
  action: proceed
  next_phase: <next pipeline phase>
```

### REWORK Resolution
```yaml
verdict: REWORK
reason: <engineering reason>
resolution:
  action: repair
  owner: <worker_id>
  scope: <what needs fixing>
  expected_artifacts: [<list>]
  resume_phase: <phase to re-enter>
  completion_criteria: <what "done" looks like>
```

### BLOCKED Resolution
```yaml
verdict: BLOCKED
reason: <failure_class>
resolution:
  action: resolve
  owner: <responsible_party>
  root_cause: <why blocked>
  actions:
    - <step 1>
    - <step 2>
  resume_phase: <phase to re-enter>
  expected_deliverables: [<what must exist>]
  completion_criteria: <what "done" looks like>
```

## Responsibility Split

| Component | Responsibility |
|-----------|---------------|
| **Recovery Engine** | Pre-PM: classify failures, execute recovery strategies, prepare evidence |
| **PM Review** | Evaluate evidence, return verdict + resolution plan |
| **Dispatcher** | Execute resolution plan: spawn workers, schedule retries, resume pipeline |

PM SHALL NEVER: retry, switch providers, repair artifacts, recover sessions.
Dispatcher SHALL NEVER: interpret engineering, invent recovery strategies.

## BLOCKED Reason Codes

| Code | Meaning |
|------|---------|
| `InfrastructureFailure` | Server/process/tooling unavailable after recovery |
| `ArtifactMissing` | Required artifact not generated after recovery |
| `DependencyUnavailable` | External service/model unreachable |
| `PermissionFailure` | Smart Approval blocks after recovery attempts |
| `EnvironmentCorrupted` | Task state inconsistent |
| `WorkerCrash` | Worker died and respawn failed |

## Pitfalls

**Pitfall: Using UNKNOWN or MANUAL_APPROVAL as PM verdicts.** User correction: "AI Company must always produce deterministic engineering verdict." BLOCKED is the verdict when recovery fails — never ambiguous "needs human" state.

**Pitfall: PM returns verdict without resolution plan.** User correction: "A PM must not simply report a problem. A PM must define how the problem is resolved." Output without resolution = incomplete review.

**Pitfall: Recovery in PM Review.** PM evaluates evidence. Recovery Engine prepares evidence. Separate components. PM must never retry tools or switch providers.
