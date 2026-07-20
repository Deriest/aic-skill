# Changelog

## v4.0.1 — Dispatcher Compliance Hardening (2026-07-20)

### Security Hardening

- **CRITICAL**: Fixed RBAC enforcement ordering — RBAC now runs BEFORE route dispatch (was dead code for mutating endpoints)
- **HIGH**: Added SSRF protection for `/api/models` endpoint (blocks localhost, RFC1918, link-local, cloud metadata)
- **HIGH**: Fixed barrier timeout fail-open → fail-closed
- **HIGH**: Prevented phase injection through `task.retry` intent
- **HIGH**: Fixed PM review auto-pass on empty artifacts
- **HIGH**: Pipeline phase failure now sets BLOCKED state instead of completing task
- **HIGH**: Added lease double-finish TOCTOU guard
- **HIGH**: Added `validatePhase()` to reject unknown FSM phases
- **HIGH**: Lease tier now validated against PHASE_PLANS
- **HIGH**: `/api/reset` requires admin role (was accessible to any authenticated user)
- **HIGH**: `/api/runtime-gate` requires lead+ role
- **MEDIUM**: RBAC matrix tightened for member/viewer roles
- **MEDIUM**: Lease ID format validated in URL path

### Compliance

- Added compliance hardening tests (31 tests)
- Added adversarial bypass tests (13 tests)
- Added dispatcher hardening tests (34 tests)
- Added residual finding validation tests (14 tests)

### Verification

- Test Files: 8
- Tests: 131
- Passed: 131
- Failed: 0
