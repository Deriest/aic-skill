# Global version alignment report — v3.1.3

**PM decision:** Single global AIC version **v3.1.3**. No commit, tag, or release in this phase.

## 1. Files modified (working tree)

| File | Change |
|------|--------|
| `CHANGELOG.md` | Latest release `[2.1.0]` → `[3.1.3]`; `[1.0.0]` historical preserved |
| `README.md` | Global v3.1.3 table; removed split 2.1.0 / 2.0.0 / dual skill policy |
| `scripts/server.js` | `/api/version` constant `2.0.0` → `3.1.3` (response shape unchanged) |
| `dashboard/package.json` | `1.0.0` → `3.1.3` (aligned with product) |
| `docs/guides/version-policy.md` | Rewritten for single global version |
| `SKILL.md` | **Unchanged** (already `3.1.3`) |

**Not modified:** `dashboard/package-lock.json` (npm deps only; run `npm install` later if lock root version should match — optional hygiene).

**Superseded doc (stale):** `references/release-version-alignment-v2.1.0.md` — describes prior PM decision v2.1.0; keep as history or archive later.

## 2. Version alignment summary

All **current** AIC-facing surfaces aligned to **3.1.3**. Obsolete **current** product markers (2.1.0, 2.0.0 API, 1.1.0, 3.1.2 in README) removed from active docs.

## 3. Final version matrix

| Component | Version |
|-----------|---------|
| **AIC Product** | **3.1.3** |
| **Runtime API** | **3.1.3** |
| **Hermes Skill** | **3.1.3** |
| **Dashboard** | **3.1.3** |
| **Git tag (remote)** | v2.0.0 (legacy) — **v3.1.3 not tagged yet** |

## 4. Backward compatibility impact

| Area | Impact |
|------|--------|
| `/api/version` | Clients see `3.1.3` instead of `2.0.0` — **string only**; no schema/endpoint change |
| Runtime behavior | **None** (constant only) |
| Hermes skill load | **None** (version already 3.1.3) |
| Operators on v2.0.0 tag | Git history unchanged; HEAD docs/API report new global semver |

## 5. Verification checklist

| Surface | v3.1.3 |
|---------|--------|
| README | ✓ |
| CHANGELOG (head) | ✓ |
| server.js | ✓ |
| SKILL.md | ✓ (pre-existing) |
| version-policy.md | ✓ |
| dashboard/package.json | ✓ |

**Residual:** `package-lock.json` root still `1.0.0` until npm refresh; archive/refs may mention 2.0.0 in **historical** OAT docs — not current product.

## 6. Recommendation

## **READY FOR TAG**

After PM **commit** alignment: `git tag -a v3.1.3`, push tag, GitHub release from CHANGELOG `[3.1.3]`.

---

No commit, tag, or release performed in this phase.