# QA / Closeout — rerun until done (SOP)

User correction (2026-07-13): *"kalau ad yang gagal harus rerun donk sesuai sop"* / *"tetap rerun sampai done"*.

## Failure modes

| Signal | Not PASS |
|--------|----------|
| `spawn-worker.sh` exit 0 | **No** — if mandatory file missing, **FAIL** |
| `docs/verification-report.md` missing | **FAIL** → rerun |
| Report ends `VERDICT: REWORK` | **FAIL** → fix evidence → rerun QA |
| Report ends `VERDICT: PASS` | **DONE** (verify with `grep VERDICT: PASS` on disk) |

## Tier

- **Sprinter (Haiku)** for QA/Closeout with **mandatory file write** often exits 0 without creating the file (observed 2×).
- **Default:** spawn `qa` and `documentation` with tier **`crafter`** (Sonnet) when deliverable is `docs/verification-report.md` or `docs/closeout-summary.md`.

## Dispatcher loop (bash)

```bash
REPORT=/home/tvd/PROJECT/docs/verification-report.md
for attempt in 1 2 3; do
  bash spawn-worker.sh qa crafter "$PROJECT" "$PROMPT"
  grep -q 'VERDICT: PASS' "$REPORT" 2>/dev/null && break
done
test -f "$REPORT" && grep -q 'VERDICT: PASS' "$REPORT" || escalate to user
```

After kill/pause, reset stale **working** on dashboard: `POST /api/agent-status` → `idle` for affected worker.

## REWORK: Lighthouse / WP-8

If QA marks checklist item 12 (Lighthouse ≥90) **PENDING** or **REWORK**:

1. `npm run build && npm run preview -- --host 127.0.0.1 --port 4173`
2. Use URL with correct `base` (e.g. `http://127.0.0.1:4173/AIC-WEB/`)
3. `npx lighthouse <url> --only-categories=performance,accessibility --chrome-flags="--headless --no-sandbox" --output=json --output-path=/tmp/lh.json`
4. Write scores to `docs/lighthouse-evidence.txt`
5. Rerun QA with prompt: include evidence, require `VERDICT: PASS`

Do **not** treat Dispatcher backfill of the report as substitute for a passing **worker** verdict when user demanded strict rerun — use backfill only to unblock REWORK evidence, then rerun Eve.

## Gate vs worker

- Dispatcher may run build/Lighthouse to **unblock** REWORK.
- Official **PASS** requires worker-written `verification-report.md` with `VERDICT: PASS` unless user accepts gate-only closeout.

## Related

- `references/worker-artifact-missing-on-success.md`
- `references/dispatcher-promo-website-pipeline.md`
- `dispatcher-discipline-aic` — QA Validation Policy