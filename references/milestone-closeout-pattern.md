# Milestone Closeout Pattern

## Trigger

When all Work Packages in a milestone are:
- Implemented
- Verified (PASS)
- Re-verified (if regression patches applied)
- Runtime OAT PASS (if applicable)

---

## 5-Phase Closeout Sequence

### Phase 1 — PM Final Review

Review all milestone artifacts:
- Scope completion (all WPs addressed)
- Planning compliance (implementation matches plan)
- Repository implementation (code matches docs)
- Verification results
- Re-verification results (if applicable)
- Regression patches (if any)
- Runtime OAT results
- Remaining risks
- Deferred items

**Output:** PM-FINAL-REVIEW-<M>.md with APPROVED/REJECTED decision.

### Phase 2 — Documentation Synchronization

Verify consistency between:
- Plan document (e.g., G-PLAN.md)
- Repository (actual code)
- Implementation report
- Verification report
- Re-verification report
- Regression patch reports
- Runtime OAT report

**Checks:**
- No documentation drift
- No undocumented implementation
- No missing capability

**Output:** DOCUMENTATION-SYNC-<M>.md

### Phase 3 — Repository Validation

Confirm:
- No unfinished Work Packages
- No temporary debug code
- No remaining workarounds from regression patches
- All runtime integrations working
- No direct runtime curl calls remain (use curl_api)
- Repository clean

**Test method:** Syntax checks, grep for raw curl, verify api-auth.sh sourced, Node syntax, dashboard build.

**Output:** Validation evidence in closeout report.

### Phase 4 — Baseline Summary

Summarize:
- Implemented capabilities
- Runtime improvements
- Authentication improvements
- Repository impact
- Dashboard impact
- Deferred items

**Output:** BASELINE-<M>.md

### Phase 5 — Commit & Baseline

- Stage only milestone-relevant files (NOT runtime artifacts in .aic/)
- Commit with descriptive message
- Push to remote
- Declare milestone as official project baseline

**Output:** Commit hash, push confirmation.

---

## Deliverables

Each closeout produces:
- <M>-CLOSEOUT-REPORT.md (master report)
- PM-FINAL-REVIEW-<M>.md
- DOCUMENTATION-SYNC-<M>.md
- BASELINE-<M>.md

---

## Pitfall: Staging .aic/ Artifacts

Runtime OAT creates artifacts in `.aic/tasks/`, `.aic/workers/`, `.aic/shared-context/`. These are runtime state, NOT code. NEVER commit them in milestone closeout.

**Correct:** `git add scripts/ .gitignore` (code only)
**Wrong:** `git add .aic/` (runtime artifacts)

---

## Pitfall: Closeout Without Runtime OAT

Closeout requires Runtime OAT PASS for milestones that touch runtime (E, F, G, H). Milestones that only touch documentation or planning (investigation-only) may skip Runtime OAT.

---

## Final Decision Template

```
Milestone <M> = CLOSED
Project Baseline Updated (commit <hash>)
Ready to begin Milestone <M+1> Investigation
```
