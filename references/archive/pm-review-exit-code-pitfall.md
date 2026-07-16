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