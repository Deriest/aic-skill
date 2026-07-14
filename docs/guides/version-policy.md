# Version policy

AIC uses a **single global version** for the product release lifecycle.

## Canonical version

**v3.1.3**

**Source of truth:** `CHANGELOG.md`, `SKILL.md` (`version:`), `GET /api/version`, annotated git tag, GitHub Release.

The following share **3.1.3** on each release:

- Product / documentation (README, CHANGELOG)
- Runtime API (`scripts/server.js`)
- Hermes skill package (`SKILL.md`)
- Dashboard application (`dashboard/package.json`)

## Third-party versions

npm dependencies in `dashboard/package-lock.json` (e.g. `@jridgewell/resolve-uri` 3.1.2) are **not** AIC versions — do not change them for product alignment.

## Historical entries

Older CHANGELOG sections (e.g. `[1.0.0] Runtime Baseline`) and archive docs may reference prior numbering; they are historical, not current.

## Tagging

Recommended tag: `v3.1.3` on the commit that includes this policy and aligned version constants.