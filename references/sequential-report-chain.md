# Sequential Report-Chain Workflow (2026-07-08)

## Model

Each department reports back to Dispatcher, who creates the next prompt based on that report.

```
User → Dispatcher → PM → report → Dispatcher → Architect → report → Dispatcher → Engineer → report → Dispatcher → QA → report → Dispatcher → Governor → report → Dispatcher → User
```

## Rules
1. Sequential only — no parallel departments
2. Reports flow through Dispatcher — departments never communicate directly
3. Dispatcher creates each prompt based on previous department's report (not pre-generated)
4. Every user request restarts from Investigate
5. Rejection: QA rejects → re-spawn Engineer; Governor rejects → re-spawn QA

## Dispatcher Lifecycle Phases

```
task-start → currentTask set, workers reset to idle
phase-start Investigation → spawn PM
PM completes → Dispatcher reads report → phase-start Planning → spawn Architect
Architect completes → Dispatcher reads report → phase-start Execution → spawn Engineer
Engineer completes → Dispatcher reads report → phase-start Verification → spawn QA
QA completes → Dispatcher reads report → phase-start Documentation → spawn Governor
Governor completes → phase Closeout → task-complete
```

## API Calls Per Phase Transition

```bash
# Start task
curl -s -X POST $API/api/task-start -d '{"id":"TASK-...","title":"...","type":"..."}'

# Advance phase
curl -s -X POST $API/api/task-status -d '{"currentPhase":"Investigation"}'

# Worker status
curl -s -X POST $API/api/agent-status -d '{"agent":"pm","status":"working"}'
curl -s -X POST $API/api/agent-status -d '{"agent":"pm","status":"complete"}'

# Close
curl -s -X POST $API/api/task-status -d '{"currentPhase":"Closeout"}'
curl -s -X POST $API/api/task-complete
```
