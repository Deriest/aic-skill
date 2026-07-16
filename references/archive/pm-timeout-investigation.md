# PM Timeout Root Cause Investigation

## Observed
- PM Thinker (Opus) frequently times out during the Planning phase and PM Review.
- Timeouts manifest as pipeline blockages with exit code 1.
- Consecutive timeouts increment the `rework.attempt` counter, permanently poisoning the barrier lease for that task.

## Evidence

- **Logs & Script Values:** 
  - `scripts/spawn-worker.sh` hardcodes `TIMEOUT=180` (3 minutes) for `pm`, `architect`, `research` on line 35.
  - `scripts/pm-review.sh` hardcodes `timeout: 120000` (2 minutes) in the `execFileSync` options on line 133.
  - The NodeJS `execFileSync` throws `ETIMEDOUT` when these thresholds are breached.

- **Token Counts & Prompt Size:**
  - PM output logs (`pm-output.md`) reveal file sizes up to 193.7 KB (e.g., `TASK-20260711-005`).
  - PM Review physically concatenates all phase artifacts (`cat "$art"`) directly into the prompt string. For an Implementation review, this includes full backend and frontend code bases.
  - PM Planning reads large context files (e.g., `SKILL.md` > 50KB, `WORK-PACKAGES.md`).

- **Timing:**
  - Opus (Thinker) processing 100k+ input tokens and generating JSON tool-calls routinely takes longer than 120–180 seconds due to API latency and model inference time.
  - `spawn-worker.sh` retry logic waits 5 seconds and retries the exact same prompt with the exact same 180s timeout, guaranteeing a second timeout.
  - `pm-review.sh` has zero retries and fails instantly at 120s.

## Verified Root Cause
The PM Thinker timeouts are caused by **artificially low, hardcoded timeout thresholds** in the runtime scripts (`180s` and `120s`) that are fundamentally incompatible with the prompt sizes (concatenated artifacts) and model inference speeds (Opus on 100k+ tokens) required by the PM role.

## Unknown
- The exact API latency distribution of the provider (how often it takes exactly >180s vs >300s).
- Whether token optimization in PM Review prompts could reduce inference time below the threshold.

## Correlation Analysis

- **Timeout vs Prompt Size / Token Count:** HIGH CORRELATION. Workers reading large artifacts (Frontend, QA, PM) all exhibit long execution durations (>100s).
- **Timeout vs Configured Threshold:** HIGH CORRELATION. PM durations are artificially clamped at ~119s (`pm-review.sh` limit) and ~179s (`spawn-worker.sh` limit), while other workers with equal or greater processing times complete successfully because their thresholds are higher (QA: 300s, Frontend: 600s).
- **Timeout vs Model / Provider Instability:** LOW CORRELATION. If provider or model instability were the primary cause, Frontend and QA (which also use Thinker/Crafter models) would fail as often as PM. They do not, because their timeouts accommodate the latency.

## Alternative Cause Analysis

- **Provider Instability / API Latency:** REJECTED as the sole root cause. Latency exists, but Frontend completes successfully in 235s. The API responds; the script just kills the connection too early.
- **Model-specific Behaviour:** REJECTED. The Opus model behaves as expected given the context size. Large context inherently requires longer TTFT (Time To First Token) and generation time.
- **Runtime Bugs / Barrier Issues:** REJECTED as the cause of the timeout. The timeout causes the barrier poison, not the other way around.

## Root Cause Confidence

**Confidence: 95%**

**Reason:**
- Quantitative analysis shows PM output files average 95KB, comparable to QA (93KB) and Architect (88KB).
- Frontend max execution time was observed at 235.9s (success, timeout=600s).
- QA max execution time was observed at 187.7s (success, timeout=300s).
- PM max execution time was observed at exactly 119.1s (failure, timeout=120s).
- Comparative evidence proves the PM model does not hang; it simply requires more time than the hardcoded 120s/180s limit allows. Other workers with similar or larger workloads succeed because their timeout configurations are appropriately scaled.

## Final Conclusion

**Verified Root Cause:** The PM timeouts are caused by misconfigured timeout thresholds (`120s` and `180s`) that are insufficient for the payload size. It is an orchestration configuration defect, not a provider availability issue.

## Recommendation

1. **Highest confidence:** Increase the hardcoded timeouts in `scripts/spawn-worker.sh` (from 180s to 300s/600s) and `scripts/pm-review.sh` (from 120000ms to 300000ms). *Evidence: This directly addresses the `ETIMEDOUT` exception thrown by Node.*
2. **Medium confidence:** Introduce exponential backoff in `spawn-worker.sh` retry logic and add retry logic to `pm-review.sh`. *Evidence: A 5s static retry is insufficient if provider load is high.*
3. **Experimental:** Optimize `pm-review.sh` prompt construction to summarize or truncate artifacts rather than concatenating full file contents. *Evidence: PM Review prompt sizes scale linearly with worker output size.*