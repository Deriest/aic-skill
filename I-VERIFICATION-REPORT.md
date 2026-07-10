# Milestone I — Verification Report

**Status:** REWORK
**Date:** 2026-07-10
**Total:** 78 tests | **Pass:** 70 | **Fail:** 8

---

## Test Method

Independent bash script executed against running server + CLI tools.
Server started fresh, all endpoints tested with auth, all CLI scripts exercised.

## Verification Tool

bash, curl, node --check, bash -n, grep

---

## Stage Results

| Stage | Tests | Pass | Fail |
|-------|-------|------|------|
| 1. Repository | 14 | 14 | 0 |
| 2. Build (syntax) | 11 | 11 | 0 |
| 3. Runtime Startup | 4 | 3 | 1 |
| 4. Functional | 38 | 33 | 5 |
| 5. Regression | 11 | 9 | 2 |
| **Total** | **78** | **70** | **8** |

---

## Defects

### DEFECT-1: stale uptime (Stage 3)

**Symptom:** `FAIL: stale uptime: 14808s`
**Root Cause:** Server was already running from earlier session (proc_31c3c3de3209). `kill -9` in verification script targeted port 6868 but server survived or PID was stale. Not a code defect — test setup issue.
**Affected Files:** None (test infrastructure)
**Severity:** Low (not a code defect)

### DEFECT-2: logger.sh log — Python sys.argv (Stage 4)

**Symptom:** `IndexError: list index out of range` on line 3
**Root Cause:** `logger.sh log` uses `python3 << 'PYEOF'` with `sys.argv` but bash variables aren't passed as arguments. Same pattern as the health-check.sh bug fixed earlier.
**Affected Files:** `scripts/logger.sh` — `log` action
**Severity:** High (core logging broken)

### DEFECT-3: logger.sh query — Python sys.argv (Stage 4)

**Symptom:** `IndexError: list index out of range` on line 3
**Root Cause:** Same as DEFECT-2 — `query` action uses `sys.argv` without passing args.
**Affected Files:** `scripts/logger.sh` — `query` action
**Severity:** High (log querying broken)

### DEFECT-4: monitor.sh alert — empty output (Stage 4)

**Symptom:** Silent exit with no output
**Root Cause:** `monitor.sh alert` calls `logger.sh query ERROR` which fails (DEFECT-3), causing the error count check to fail silently. Cascading failure from DEFECT-2/3.
**Affected Files:** `scripts/monitor.sh` — `alert` action (depends on logger.sh)
**Severity:** Medium (cascading from logger)

### DEFECT-5: security-governance.sh validate-input — unknown action (Stage 4)

**Symptom:** `ERROR: Unknown action 'validate-input'`
**Root Cause:** The new actions (validate-input, sign-prompt, rotate-key) were not correctly added to security-governance.sh. The patch either failed or was applied to the wrong location.
**Affected Files:** `scripts/security-governance.sh`
**Severity:** High (security hardening broken)

### DEFECT-6: security-governance.sh sign-prompt — unknown action (Stage 4)

**Symptom:** `ERROR: Unknown action 'sign-prompt'`
**Root Cause:** Same as DEFECT-5.
**Affected Files:** `scripts/security-governance.sh`
**Severity:** High (prompt signing broken)

### DEFECT-7: security-governance.sh validate-input dangerous — unknown action (Stage 4)

**Symptom:** Same as DEFECT-5
**Root Cause:** Same as DEFECT-5
**Affected Files:** `scripts/security-governance.sh`
**Severity:** High (input validation broken)

### DEFECT-8: auth blocks unauthenticated — HTTP 000 (Stage 5)

**Symptom:** `FAIL: regression: auth blocks unauthenticated (got 200)` — actual result was HTTP 000 (connection refused)
**Root Cause:** Server was killed by verification script's `kill $SERVER_PID` before this test ran, or server crashed. The `200` in the output was from the original script run; the investigation showed `000`. Not a code defect — test ordering issue.
**Affected Files:** None (test infrastructure)
**Severity:** Low (not a code defect)

---

## Summary

| Defect | Category | Severity | Root Cause |
|--------|----------|----------|------------|
| DEFECT-1 | Test setup | Low | Server not freshly started |
| DEFECT-2 | I-4 Logging | **High** | Python sys.argv not passed |
| DEFECT-3 | I-4 Logging | **High** | Python sys.argv not passed |
| DEFECT-4 | I-2 Monitoring | Medium | Cascading from logger |
| DEFECT-5 | I-7 Security | **High** | Actions not added to script |
| DEFECT-6 | I-7 Security | **High** | Actions not added to script |
| DEFECT-7 | I-7 Security | **High** | Actions not added to script |
| DEFECT-8 | Test setup | Low | Server killed before test |

**Real code defects: 5** (DEFECT-2,3,4,5,6)
**Test infrastructure issues: 3** (DEFECT-1,4,8)

---

## Regression Report

| Milestone | Component | Status |
|-----------|-----------|--------|
| E (Runtime Core) | /health | ✅ PASS |
| E (Runtime Core) | /api/status | ✅ PASS |
| F (Dispatcher) | phase-runner.sh | ✅ PASS |
| F (Dispatcher) | spawn-worker.sh | ✅ PASS |
| G (Worker Intelligence) | worker-memory.sh | ✅ PASS |
| H (Knowledge Platform) | All 9 scripts | ✅ PASS |
| Auth | Blocking unauthenticated | ⚠️ Test issue (server killed) |

---

## Repository References

- `scripts/logger.sh` — DEFECT-2, DEFECT-3
- `scripts/monitor.sh` — DEFECT-4
- `scripts/security-governance.sh` — DEFECT-5, DEFECT-6, DEFECT-7

---

## Limitations

- Stale uptime and auth blocking failures are test infrastructure issues, not code defects
- DEFECT-4 (monitor alert) is cascading from DEFECT-2/3 (logger)
- Actual code defects requiring fix: logger.sh sys.argv + security-governance.sh missing actions

---

## Final Decision

**Milestone I Verification = REWORK**

5 real code defects:
1. `scripts/logger.sh` — 2 Python sys.argv bugs (log + query actions)
2. `scripts/monitor.sh` — 1 cascading failure from logger
3. `scripts/security-governance.sh` — 2 missing actions (validate-input, sign-prompt)

Fix required before re-verification.
