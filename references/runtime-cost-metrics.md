# Runtime cost and metrics

## How cost is recorded

- **File:** `.aic/metrics.json` (append via `POST /api/metrics`)
- **Who posts:** `spawn-worker.sh` **legacy** branch only — after opencode, greps last `"input"`/`"output"` from NDJSON file
- **WECP path:** `worker-execution-pipeline.py` does **not** POST metrics (gap vs user expectation on cost tracking)

## Payload gaps

- POST body: `worker`, `tier`, `model`, `tokens` — **`taskId` not sent** (all 72 historical entries lack `taskId`)
- `GET /api/metrics` → `summary.cost` = USD estimate over **entire** metrics array (server.js rates), not filtered by task status

## User question: “task done masuk cost?”

**No per-task rule.** Done/failed/BLOCKED does not gate inclusion. Any legacy spawn with non-zero input tokens adds to global cost. Task `status: done` in `state.json` is unrelated to metrics linkage.

## Dashboard vs authoritative cost

- Authoritative: `GET /api/metrics` (nested `summary.cost`)
- `/api/metrics/summary` (ops-endpoints) — flat object, **no** cost field (different endpoint)

## When answering user about cost

Cite metrics.json + spawn path; mention WECP runs may be **missing** from cost until WECP posts metrics.

## Dispatcher answer template (Indonesian)

Task **done** tidak otomatis punya baris cost sendiri. Total cost = semua entri di `metrics.json` (legacy spawn dengan token). Status done/failed tidak difilter. WECP path saat ini biasanya **tidak** POST metrics.