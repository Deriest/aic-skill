# Pipeline Orchestrator Contract Drift (IMP-025)

## Status
**FIXED** (v3.1.6 patch, 2026-07-15)

## Symptom
`pipeline-orchestrator.sh` exits with:
```
PIPELINE FAILED: task-start: HTTP 400: {"ok":false,"error":"description_required","message":"Task description must be at least 40 characters with clear deliverables for PM Review."}
```

## Root Cause
Contract drift between `pipeline-orchestrator.sh` and `engine/index.js`.

**Pipeline sends:**
```python
d = {"title": ..., "type": "feature", "projectDir": ...}
```

**Engine requires (`engine/index.js` → `task.create` → `validateTaskDescription`):**
```javascript
if (!body.description || body.description.length < 40) {
  return { ok: false, error: 'description_required', message: '...' };
}
```

**`server.js` `/api/task-start` forwards:**
```javascript
const descCheck = validateTaskDescription(body.description);
// body.description = '' → FAIL
```

## Canonical API Contract: POST /api/task-start

| Field | Required | Default | Notes |
|---|---|---|---|
| `title` | Required (or `id`) | `'Untitled Task'` | Used for display |
| `description` | **Required ≥ 40 chars** | `''` (rejected) | Validated by engine |
| `type` | Optional | `undefined` | `'feature'`, `'promo'`, etc. |
| `projectDir` / `project_dir` | Optional | `getActiveProject().workspace` | Project path |
| `id` | Optional | auto `TASK-YYYYMMDD-NNN` | Custom task ID |

## Classification
**Contract drift** — pipeline and engine developed independently without shared schema validation.

## Fix Applied
Added `description` field to TASK_JSON in `pipeline-orchestrator.sh`. Auto-generates from task title + workspace + UTC timestamp:

```python
d = {
    "title": desc,
    "description": f"Pipeline task: {desc} | Workspace: {proj} | Invoked via pipeline-orchestrator.sh at {datetime.datetime.now(datetime.UTC).isoformat()}Z",
    "type": "feature",
    "projectDir": proj
}
```

Also replaced fragile `python3 -c` inline with heredoc (`PYEOF`), fixing both contract drift and Python quoting fragility in one change.

**Documentation updated:** `SKILL.md`, `references/promo-landing-site-pattern.md` — schema now includes `description`.

## Verification
TASK-20260715-003 created successfully:
```
$ bash pipeline-orchestrator.sh "Build a frontend-only marketing showcase..." "/home/tvd/AIC-WEB"
[19:15:04] Engine started task: TASK-20260715-003
exit code: 0
```

## Related Files
- `scripts/pipeline-orchestrator.sh` (TASK_JSON generation — fixed)
- `scripts/engine/index.js` (task.create handler + validateTaskDescription — unchanged, source of truth)
- `scripts/server.js` (POST /api/task-start → forwards to engine)
