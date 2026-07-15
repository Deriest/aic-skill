# Promo landing site (AIC-SKILL / GitHub publish)

## When to use
User asks for a **one-page marketing site** to promote the **aic-skill** GitHub repo (`https://github.com/Deriest/aic-skill`), intended for **static publish** (GitHub Pages, Netlify, etc.). Classify as **feature**; run full pipeline in the **target project directory** (not the skill repo unless explicitly requested).

## User preferences (this user / TVD)
- **Copy language:** **Full English** on the public site — even when the user chats in Indonesian. Indonesian is for Dispatcher conversation only unless they ask for bilingual.
- **Visual:** **Match the Operations Control Center dashboard** — dark ops / pixel-office aesthetic. **Not** a generic SaaS gradient landing.
- **Content source:** `README.md`, `references/dispatcher-github-readme.md`, worker names/personalities from README "The Team" section.

## Dispatcher workflow
1. `POST /api/task-start` with `{id, title, description, type: "feature", projectDir}`. The `description` field is mandatory (minimum 40 characters).
2. Spawn **PM (Investigate)** with prompt referencing repo URL and publish goal.
3. When user states visual/language constraints mid-flight, write **`<project>/.aic/prompts/<TASK-ID>-design-brief.md`** (allowed prompt artifact). Reference it in all later worker prompts (Designer, Frontend).
4. **Never** implement HTML/CSS/React in Dispatcher — Frontend Engineer only.
5. **No auto-commit** — user reviews before publish.

## Visual baseline (align with `dashboard/tailwind.config.js`)
| Token | Hex / role |
|-------|------------|
| `aic-bg-dark` | `#0f0f23` page background |
| `aic-bg-panel` | `#1a1a2e` cards |
| `aic-border` | `#2a2a4a` borders |
| `aic-accent` | `#00d4ff` links, highlights, glow |
| `aic-green` | `#00ff88` success accents |
| `aic-yellow` | `#ffcc00` active/working accents |
| `aic-text` | `#e0e0e0` body |
| `aic-text-dim` | `#6b7280` secondary |

Optional: `font-pixel` / Press Start 2P for small labels only — do not overuse on marketing hero (readability).

Load also: `references/ui-theming-rules.md`, `references/dashboard-theming-and-workflow.md`.

## Recommended one-page sections (English)
1. **Hero** — tagline + value prop + primary CTA → GitHub repo
2. **What is AIC** — Dispatcher, 5-phase pipeline, 15 workers (summary)
3. **Features** — Knowledge platform, dashboard, parallel engineers, multi-project, cost tracking
4. **The team** — compact roster (Hermes, Aria, Atlas, Leo, Eve, …) optional
5. **Quick start** — `setup.sh`, `/aic`, `/aic project <path>` (monospace block)
6. **Dashboard** — screenshot or styled mock (placeholders OK in v1)
7. **Footer** — MIT, GitHub link, Hermes / Nous attribution as appropriate

## Technical v1
- Static only: Vite+React single page or plain HTML/CSS in project root
- Mobile-responsive; relative asset paths for GitHub Pages
- **Out of scope v1:** live `localhost:6868` API, auth, Indonesian copy, light theme

## Publish checklist (Governor / user)
- [ ] `npm run build` produces `dist/` (if Vite)
- [ ] All links point to correct GitHub org/repo
- [ ] QA: browser + mobile width smoke test
- [ ] User explicitly approves before `git push` / Pages enable

## Related template
Copy and customize: `templates/promo-design-brief.md` → `<project>/.aic/prompts/<TASK-ID>-design-brief.md`