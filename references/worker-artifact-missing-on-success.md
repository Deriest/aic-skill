# QA / Closeout: spawn exit 0 but artifact missing

**Observed 2026-07-13 (TASK-AIC-WEB-001):** `spawn-worker.sh qa` and `documentation` both exited 0; `docs/verification-report.md` and `docs/closeout-summary.md` were **not** on disk.

## Dispatcher rule

- **Worker exit 0 ≠ deliverable exists.** After QA/Closeout, `test -f docs/verification-report.md` (or path in prompt).
- **Haiku (sprinter)** often exits 0 without writing the file — use **`crafter`** for QA/Closeout file deliverables.
- If missing: **rerun** (see `references/qa-rerun-until-pass.md`).
- If file exists with **`VERDICT: REWORK`**: remediate evidence, rerun until **`VERDICT: PASS`**.
- Dispatcher may run build/Lighthouse to unblock REWORK — not a substitute for final worker `VERDICT: PASS` when user requires strict SOP.

## Prompt hardening

```text
MANDATORY OUTPUT FILE: /path/to/docs/verification-report.md
If this file does not exist when you finish, the task is incomplete.
```

## Cross-refs

- `references/qa-rerun-until-pass.md`
- `dispatcher-discipline-aic` — QA Validation Policy (vision/terminal evidence)
- `references/dispatcher-promo-website-pipeline.md`