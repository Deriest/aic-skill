# Pm Consolidated

> **Consolidated from 3 files.** Originals archived in `references/archive/`.

**Original files merged:**
- `pm-orders-response-format.md`
- `pm-review-exit-code-pitfall.md`
- `pm-timeout-investigation.md`

---

---

## Source: `pm-orders-response-format.md`

# PM Orders Response Format

When the user issues a strictly formatted management directive (e.g., `PM FINAL INVESTIGATION ORDER` or `PM FINAL RELEASE ORDER`), you must adopt a machine-like, highly constrained response format.

## Core Rules
1. **Strict Deliverables:** Output *only* the explicitly requested deliverables (usually as a numbered list or compact table).
2. **Binary Final Status:** End the response with exactly one of the permitted terminal states requested by the user (e.g., `READY FOR COMMIT`, `REQUIRES REWORK`, `RELEASE SUCCESSFUL`, `RELEASE FAILED`).
3. **No Conversational Filler:** Omit all greetings, acknowledgments, recommendations, architectural discussions, or mentions of "future work". Do not narrate your actions or append conversational wrappers like "Here is the result:". 
4. **Scope Discipline:** Execute only what is explicitly ordered. Do not propose new improvements, do not implement placeholder fixes, and do not modify files beyond the defined investigation/release scope.

## Example Output (PM FINAL RELEASE ORDER)

1. **Repository audit summary:** 4 files modified (`SKILL.md`, `scripts/engine/index.js`, `scripts/health-check.sh`, `.gitignore`). No conflicts, branch `main`.
2. **Commit SHA:** `2ac729fb94e740b5db7ebd80432c21be1932c5d1`
3. **Tag SHA:** `28183bea71f5ff40cb1e5b2f301e34e46696a737`
4. **Push result:** SUCCESS
5. **Remote verification:** 
   - `HEAD` = `2ac729fb94e740b5db7ebd80432c21be1932c5d1`
   - `refs/tags/v3.1.6` = `28183bea71f5ff40cb1e5b2f301e34e46696a737`
6. **Final status:**

RELEASE SUCCESSFUL
---

## Source: `pm-review-exit-code-pitfall.md`

# pm-review.sh exit code vs verdict

**Observed 2026-07-13 (TASK-AIC-WEB-001):** PM output contained `VERDICT: PASS` but script exited `1` with:

```
xargs: unmatched double quote; by default quotes are special to xargs unless you use the -0 option
```

**Observed 2026-07-13 (TASK-20260713-019, guarded Runtime OAT):** PM decision was PASS; model printed `**VERDICT: PASS**`. `grep '^VERDICT:'` missed → **UNKNOWN** exit **3** → engine **BLOCKED**. Log: `/tmp/aic-server-6868.log`. **Runtime behaved correctly**; fix parser (strip `*`, match `VERDICT:` anywhere on line).

## Dispatcher rule

- Parse **VERDICT:** from output — authoritative for gate advance
- Do **not** treat exit `1` alone as REWORK when output shows PASS
- Exit **3** with PASS in raw = false BLOCKED — parser fix, not FSM
- If ambiguous, re-run or escalate

## Fix (runtime maintainers) — FIX-004 shipped

1. Verdict: `python3` in `pm-review.sh` — strip `*`, first `(?i)VERDICT\s*:\s*(\w+)` → PASS|REWORK|BLOCKED|FAIL; empty → UNKNOWN exit 3.
2. After opencode: `opencode-json-to-md.py` before grep.
3. Worker reports: same extractor before `reports/*-output.md`; no raw fallback (FIX-005).
4. No `xargs` on verdict body.
5. Ad-hoc: `/tmp/hermes-verify-pm-verdict.sh` pattern.

Related: `references/opencode-json-artifact-and-metrics.md`, `references/runtime-oat-guarded-forensics.md`
---

## Source: `pm-timeout-investigation.md`

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