# Dashboard Config — Fetch Models

## Behavior (current)

- UI: `dashboard/src/pages/ConfigPage.tsx` → `fetchModels()` calls **`POST /api/models`** on the AIC server (same-origin; satisfies CSP `connect-src 'self'`).
- Server: `scripts/server.js` → `fetchUpstreamModelsJson(baseURL, apiKey)` proxies to `{baseURL}/models` (HTTP or HTTPS, follows redirects server-side).
- Config load: `GET /api/config` reads `.env` + `~/.config/opencode/opencode.jsonc`; populates `baseURL` / `apiKey` from provider `options`.

## Failure signature

| Message | Likely cause |
|---------|----------------|
| `Failed to fetch` (CSP) | Browser blocked direct proxy URL — use `/api/models` proxy (implemented) |
| `Failed to fetch` (other) | Server down, wrong baseURL, upstream timeout |
| `HTTP error! status: 401` | Wrong or empty API key in form state |
| `Response data is not an array` | Non–OpenAI-compatible JSON (expect `{ data: [{ id }] }`) |

## Verify split

1. **From AIC server host:** `curl -H "Authorization: Bearer $API_KEY" "$BASE_URL/models"` → if 200, proxy is fine.
2. **From browser:** FETCH MODELS must hit `/api/models` only — never widen CSP to arbitrary hosts.

## Deploy note

`dashboard/dist/` is gitignored. After pull: `cd dashboard && npm run build`, then `scripts/deploy.sh restart`.

## Operator quick start

```bash
bash scripts/deploy.sh start   # port 6868
curl -s http://127.0.0.1:6868/health
```

## Version on landing (related)

Do not use `SKILL.md` `version:` as product version on promo sites — use CHANGELOG / global tag (PM: **v3.1.3**). See `references/promo-landing-site-pattern.md`.