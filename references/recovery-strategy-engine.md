# Recovery Strategy Engine

**Added:** 2026-07-17, commit `8a1199b`
**Component:** recovery-strategy.js + pm-review.js (rewritten pmRepairLoop)

## Architecture

Replaces fixed retry counter (`maxAttempts=3`) with evidence-driven adaptive recovery. Recovery decisions depend on measurable engineering progress, not attempt count.

## Strategy Ladder (Escalation Order)

| # | Strategy | Action | Env Vars |
|---|----------|--------|----------|
| 1 | `targeted_repair` | Spawn affected workers + PM feedback | `AIC_PM_REPAIR=1` |
| 2 | `collaborative_repair` | Same + sibling artifacts | `AIC_COLLABORATIVE_REPAIR=1` |
| 3 | `execution_plan_refinement` | PM rewrites plan, then downstream re-execute | `AIC_PLAN_REFINEMENT=1` |
| 4 | `pm_authoring` | PM directly writes the problematic artifact | `AIC_PM_AUTHORING=1`, `AIC_PM_AUTHOR_TARGETS` |
| 5 | `ship_with_caveats` | Deliver product, document gaps | N/A |

## Progress Evaluation

After every recovery cycle, evaluate progress between consecutive cycles:

| Signal | Has Progress? | Reason |
|--------|--------------|--------|
| Root cause changed | YES | Issue shifted |
| Fewer targeted workers | YES | Scope narrowed |
| Different targeted workers | YES | Focus shifted |
| Same root cause + same targets + same strategy | NO | Stalled identical cycle |
| Same root cause + same targets + different strategy (previously tried) | NO | Strategy repeat |
| Same root cause + same targets + different strategy (not previously tried) | YES | Strategy evolved |

## Strategy Selection Logic

```
attempt <= 1 → targeted_repair (always start here)
progress exists + current strategy valid → keep current strategy
progress stalled → escalate to next strategy in ladder
hard ceiling → strategies.length + 2 cycles (7 max) → ship_with_caveats
```

## Cycle Recording

`cp.reworkHistory` array in checkpoint, last 20 entries:
```json
{
  "attempt": 2,
  "strategy": "collaborative_repair",
  "targets": ["architect", "research"],
  "root_cause": "architect and research contradict on bug count",
  "verdict": "REWORK",
  "timestamp": 1721234567890
}
```

## Execution Plan Refinement Action

When `refine_plan` strategy selected:
1. Delete current `execution-plan.md`
2. Spawn PM only with `AIC_PLAN_REFINEMENT=1` to rewrite plan
3. Spawn downstream workers with `AIC_EXECUTION_PLAN=1`
4. Continue loop → next iteration reviews the new output

## PM Authoring Action

When `pm_author` strategy selected:
1. Spawn PM as sole worker with `AIC_PM_AUTHOR_TARGETS=<targets>`
2. PM directly writes the problematic artifact
3. Continue loop → next iteration reviews PM's direct output

## Key Code Locations

- `scripts/engine/recovery-strategy.js` — strategy ladder, progress evaluation, selection, recording
- `scripts/engine/pm-review.js` `pmRepairLoop()` — rewritten to use recovery strategy engine
- Hard ceiling: only 3 BLOCKED paths remain: exit code 2, infrastructure failure, EDP parse failure

## Integration with Postmortem

Recovery cycle data (`cp.reworkHistory`) feeds into postmortem.py analysis:
- Repair frequency tracking
- Strategy effectiveness measurement
- Historical pattern discovery

## User Principle

*"PM ga boleh menyerah harus bisa deliver product"* — PM never gives up. Ship with caveats rather than block indefinitely. Content quality disagreements → deliver with documented gaps. Only infrastructure failures → BLOCKED.
