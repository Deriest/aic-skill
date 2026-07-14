# FIX-022 — Self-host Press Start 2P (dashboard)

## Symptom

Dashboard looks like smooth system monospace, not pixel bitmap. DevTools **computed** `font-family` shows `"Press Start 2P", monospace` but **Rendered fonts** is Menlo/Consolas.

## Root cause

Dashboard served from AIC `server.js` (`:6868`) uses CSP:

`style-src 'self' 'unsafe-inline'` — no `fonts.googleapis.com` / `fonts.gstatic.com`.

Google Fonts links in `index.html` do not load webfont files (`gstatic` requests = 0). Browser uses **monospace fallback** while still reporting Press Start 2P in computed style.

**Do not relax CSP** as the default fix — self-host under `font-src 'self'`.

## Fix (shipped pattern)

1. Download official TTF → `dashboard/public/fonts/PressStart2P-Regular.ttf` (Vite copies to `dist/fonts/` on build).
2. `dashboard/src/index.css`:

```css
@font-face {
  font-family: 'Press Start 2P';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/PressStart2P-Regular.ttf') format('truetype');
}
```

3. Remove Google Fonts `<link>` / preconnect from `dashboard/index.html`.
4. Remove `antialiased` from `body` `@apply` in `index.css` — pixel glyphs should render crisp (`webkitFontSmoothing: auto`).

Keep Tailwind `font-pixel` and family name **Press Start 2P** unchanged.

## Verify

- Network: **0** requests to `googleapis` / `gstatic`.
- Network: `PressStart2P-Regular.ttf` from same origin (`/fonts/...`, ~115KB).
- Ad-hoc: `OK_FIX022_SELFHOST_FONT` script (dist font exists, no googleapis in html, no antialiased on body, `npm run build`).
- Hard refresh after rebuild (`Ctrl+Shift+R`).

## Related

- `references/dashboard-regression-audit-post-runtime-stability.md` — p99 / cumulative task / font investigation
- `references/ui-theming-rules.md` — `font-body` undefined in Tailwind (class is no-op; inherits body)

## Milestone

Dashboard UI only — **not** Runtime Stability bundle (`45b04e8` excluded `dashboard/**`).