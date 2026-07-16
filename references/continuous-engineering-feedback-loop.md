# Continuous Engineering Feedback Loop

**Added:** 2026-07-17, commit `7948945`
**Component:** postmortem.py + pipeline.js + metrics-routes.js

## Architecture

After every COMPLETE task, postmortem.py runs automatically (non-blocking):

```
completeTask() → triggerPostmortemAsync(taskId) → python3 postmortem.py <skill_dir> <task_id>
  ↓
1. Evidence Collection → all task artifacts, checkpoint, context, PM reviews
2. Analysis → worker agreement, repairs, artifact quality, execution plan quality
3. Metrics Update → engineering-metrics.json (cumulative, last 100 tasks)
4. Pattern Discovery → recurring problems across tasks
5. Recommendation Generator → evidence-based improvements
6. Report → postmortem-report.md in task reports dir
```

## Postmortem Analysis Covers

- Worker agreement rate (via consistency checker results)
- Repair iteration count and targeted workers
- Artifact quality per worker (word count, H1, minimum size)
- Execution plan quality (section completeness: 8 required sections)
- Consistency conflicts detected
- Pipeline efficiency (phases completed, caveats)
- Ship-with-caveats flag

## Engineering Metrics (engineering-metrics.json)

```json
{
  "pipeline": { "total_tasks", "successful_tasks", "tasks_with_repairs", "total_repair_iterations", "caveat_shipments" },
  "worker": { "agreement_samples": [1.0, 0.0, ...] },
  "consistency": { "total_reports", "reports_with_conflicts" },
  "execution_plan": { "total_plans", "quality_samples": [87, 100, ...], "missing_section_count" },
  "artifacts": { "total", "with_issues", "quality_samples": [100, 80, ...] },
  "history": [{ "task_id", "timestamp", "repair_attempts", "worker_agreement", "consistency_conflicts", "execution_plan_quality", "caveats" }]
}
```

History capped at 100 entries (rolling window).

## Pattern Discovery (engineering-patterns.json)

Automatic detection of recurring patterns:

| Pattern | Threshold | Severity |
|---------|-----------|----------|
| Frequent repairs | >50% of tasks need repairs | HIGH |
| Recurring conflicts | >30% of tasks have consistency conflicts | MEDIUM |
| Poor execution plans | Average quality <70% | HIGH |
| Frequent caveats | >30% tasks ship with caveats | MEDIUM |

Each pattern includes: type, severity, evidence, recommendation.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/engineering-metrics` | GET | Cumulative engineering metrics |
| `/api/engineering-patterns` | GET | Discovered patterns (last 50 pattern reports) |
| `/api/postmortem/:taskId` | GET | Postmortem report for specific task |

## Key Files

- `scripts/postmortem.py` — main postmortem script (617 lines)
- `scripts/engine/pipeline.js` — `triggerPostmortemAsync()` in `completeTask()`
- `scripts/routes/metrics-routes.js` — 3 new API endpoints
- `.aic/engineering-metrics.json` — cumulative metrics
- `.aic/engineering-patterns.json` — pattern history
- `.aic/tasks/<id>/reports/postmortem-report.md` — per-task report

## Bus Events

- `postmortem.started` — emitted when postmortem begins
- `postmortem.completed` — emitted with output or error

## Design Decisions

1. **Non-blocking** — postmortem spawns as async child process, never blocks pipeline
2. **Never modifies task** — postmortem only reads completed task artifacts
3. **Recommendations are evidence-based** — every recommendation includes evidence, impact, affected components, expected benefit
4. **No automatic modifications** — postmortem generates recommendations only; never auto-changes prompts, contracts, or pipeline
5. **Keyword-based pattern detection** — ponytail: upgrade to LLM-based comparison for precision
