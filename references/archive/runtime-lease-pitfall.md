# Runtime Lease Enforcement Pitfall

**Symptom:** 
Running ad-hoc tests via `bash scripts/spawn-worker.sh <phase> <tier> <dir> <prompt>` manually fails with the following error:
`ERROR: No runtime lease. Engine must issue lease before spawn.`

**Root Cause:** 
The orchestration engine now strictly enforces lease validation for worker execution. Workers cannot be spawned out-of-band directly via `spawn-worker.sh` without the NodeJS engine (`engine/index.js`) first issuing a valid lease in the state store.

**Resolution:**
To test workers, verify LLM connectivity, or run ad-hoc tasks:
1. **Do not** use `spawn-worker.sh` directly for testing.
2. **Use the pipeline:** Trigger tasks properly via the API (`POST /api/task-start`) or the orchestrator (`pipeline-orchestrator.sh`).
3. **Direct OpenCode bypass (for raw connectivity tests):** If you only need to test LLM connectivity outside the pipeline and don't need artifacts extracted, use `opencode` directly via stdin:
   ```bash
   echo "Test prompt" | opencode run -m <ModelName> --auto
   ```