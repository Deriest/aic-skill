# Cache Hit regression & FIX-023 (WECP metrics)

## Symptom

Costs tab **HIT RATE** shows **0.0%** on default **Daily** filter while **Weekly/Total** still show ~60–80%.

## Root cause (investigation 2026-07-14)

| Layer | Status |
|-------|--------|
| Formula `cacheRead / (cacheRead + input)` in `server.js` | OK |
| `CostsPage.tsx` reads `summary.cacheHitRate` | OK |
| `.aic/metrics.json` on disk | OK (historical `cacheRead` present) |
| **Collection after WECP** | **Broken** |

From **2026-07-13** onward, contract phases use `worker-execution-pipeline.py`, which **did not** `POST /api/metrics`. Legacy `spawn-worker.sh` POST omitted `cacheRead`/`cacheWrite`.

Last entry with `cacheRead > 0` before gap: **2026-07-12**. Daily window = only post-gap rows → **0%**.

**Not** server restart (metrics persist on disk). **Not** dashboard bug.

## FIX-023 (shipped)

1. `scripts/opencode-token-extract.py` — one NDJSON pass; `merge_files` sums generate + repair JSON paths.
2. `worker-execution-pipeline.py` — `post_worker_metrics()` on WECP **PASS** (one POST per execution).
3. `spawn-worker.sh` — legacy path uses same extractor for POST body.

Schema unchanged: `tokens.input`, `output`, `reasoning`, `cacheRead`, `cacheWrite`, `total`.

## Verify

```bash
# Ad-hoc
OK_FIX023_HERMES_VERIFY  # py_compile + merge two sample files

# After real worker run
tail -1 .aic/metrics.json  # must include cacheRead key (0 or >0)
curl -s 'http://127.0.0.1:6868/api/metrics?from=YYYY-MM-DD' | jq '.summary.cacheHitRate'
```

Daily HIT RATE rises only when **new** runs include provider cache tokens in OpenCode JSON.

## Pitfalls

- **Costs default = daily** — looks like "regression" while weekly still healthy.
- **`/api/metrics/summary`** (Overview PERFORMANCE) has **no** `cacheHitRate` — cache UI is **Costs** only.
- Do not remove metrics when fixing artifacts — user requires input/cache for cost (`dispatcher-discipline-aic`).

## Related

- `references/token-tracking.md`
- `references/opencode-json-artifact-and-metrics.md`
- `references/wecp-architecture-and-pitfalls.md`
