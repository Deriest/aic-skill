# Orchestration Scripts Pitfalls

## 1. `pipeline-orchestrator.sh` collision with `/api/task-start`
**Symptom:** Running `pipeline-orchestrator.sh` fails immediately with `PIPELINE FAILED: task-start`.
**Root Cause:** The orchestrator script internally calls `/api/task-start` to initialize the task. If you manually created a task via curl first, the engine is already locked (pipeline busy) and will reject the orchestrator's attempt to start a new task.
**Fix:** Cancel the active task first:
`curl -X POST -H "X-API-Key: $KEY" -d '{"intent":"task.cancel", "taskId":"<ID>"}' http://localhost:6868/api/runtime/intent`
Then, run the orchestrator with a plain text description (NOT JSON):
`bash pipeline-orchestrator.sh "Build a frontend-only showcase website for AIC" "/home/tvd/AIC-WEB"`

## 2. `phase-runner.sh` argument format
**Symptom:** `ERROR: No workers specified` or `ERROR: Invalid worker format 'pm'`.
**Root Cause:** The script expects workers in the exact format `<worker_name>,<tier>`. Passing just the worker name fails the internal parser.
**Fix:** Always provide the tier alongside the worker name.
**Correct Example:** `bash phase-runner.sh "investigate" "/home/tvd/AIC-WEB" "pm,thinker"`

## 3. `spawn-worker.sh` requires runtime lease
**Symptom:** `ERROR: No runtime lease. Engine must issue lease before spawn.`
**Root Cause:** AIC 3.1.6 introduced Runtime Lease Control. `spawn-worker.sh` cannot be called directly without the engine first issuing a lease. Only `phase-runner.sh` (which talks to the engine API) can legitimately spawn workers.
**Fix:** Use `phase-runner.sh` instead of `spawn-worker.sh` directly. If the pipeline orchestrator is broken, fix the orchestrator — do NOT bypass by calling `spawn-worker.sh` manually.
**User correction:** *"harusnya dispatcher ga boleh ngide kan sudah di setup sebelumnya, ga boleh langsung bypass"*

## 4. `pipeline-orchestrator.sh` takes plain text, NOT JSON
**Symptom:** Running `pipeline-orchestrator.sh '{"task": "...", "project_dir": "..."}' "/path"` produces a nested JSON object where `title` is the entire JSON string.
**Root Cause:** Arg 1 is treated as a plain text task description. The script internally builds proper JSON via Python heredoc. Passing pre-formatted JSON as arg 1 results in double-wrapping.
**Correct:** `bash pipeline-orchestrator.sh "Build a frontend-only showcase website for AIC" "/home/tvd/AIC-WEB"`
**Wrong:** `bash pipeline-orchestrator.sh '{"task": "Build...", "project_dir": "..."}' "/path"`

## 5. Engine requires `description` field (contract drift)
**Symptom:** `pipeline-orchestrator.sh` exits 1 with `PIPELINE FAILED: task-start: HTTP 400: {"error":"description_required"}`.
**Root cause:** Engine `task.create` handler calls `validateTaskDescription(body.description)` which rejects descriptions shorter than 40 characters. The pipeline orchestrator previously only sent `{title, type, projectDir}` — the `description` field was missing entirely.
**Fix:** `pipeline-orchestrator.sh` must include a meaningful `description` in the TASK_JSON. The description should be built from the task context (task text + project dir + timestamp), not a placeholder. Pattern uses `os.environ` heredoc:
```python
import json, os, datetime
desc = os.environ["_AIC_TASK_DESC"]
proj = os.environ["_AIC_PROJECT_DIR"]
d = {
    "title": desc,
    "description": f"Pipeline task: {desc} | Workspace: {proj} | Invoked via pipeline-orchestrator.sh at {datetime.datetime.now(datetime.timezone.utc).isoformat()}",
    "type": "feature",
    "projectDir": proj
}
```
**Verified:** Task created successfully (`TASK-20260715-003`) after fix. No `description_required` error.
**Doc impact:** `SKILL.md` and `references/promo-landing-site-pattern.md` both updated to reflect `{title, description, type, projectDir}` as the canonical API contract.

## 6. `api-auth.sh` error reporting (before fix)
**Symptom:** `PIPELINE FAILED: task-start:` with empty message — no HTTP status, no response body.
**Root cause:** `curl -sf` flag (`-s` silent + `-f` fail) suppresses all output on HTTP errors. Exit code 1 with empty body.
**Fix:** Replace `curl -sf` with explicit HTTP status capture:
```bash
http_status=$(curl -s -o "$body_file" -w "%{http_code}" -H "$auth_flag" "$@")
if [ "$http_status" -ge 400 ] 2>/dev/null; then
    echo "HTTP $http_status: $(cat "$body_file")" >&2
    return 1
fi
```
**Verified:** After fix, error output shows: `HTTP 400: {"ok":false,"error":"description_required",...}`
