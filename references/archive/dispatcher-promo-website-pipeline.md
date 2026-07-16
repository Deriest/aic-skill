# Promo Website Pipeline — Dispatcher Playbook

Session-hardened flow for one-page static sites promoting `github.com/Deriest/aic-skill`: English copy, dashboard-matched visuals.

## User constraints (freeze early)

Write `<project>/.aic/prompts/<TASK-ID>-design-brief.md`:

- **Language:** full English (no Indonesian in public UI)
- **Visual:** match AIC Operations Control Center — `#0f0f23`, `#1a1a2e`, `#00d4ff`, status yellow/green/gray
- **Publish target:** static (GitHub Pages), no backend v1

## Phase sequence (no skips)

| Phase | Workers | Artifacts | PM Review |
|-------|---------|-----------|-----------|
| Investigate | PM (thinker) | `docs/discovery-report.md`, `docs/work-package.md` | Both files |
| Planning | Architect (thinker) | `docs/architecture-spec.md` | With design-spec |
| Planning | **Designer Luna (thinker)** | `docs/design-spec.md` | With architecture-spec |
| Implementation | Frontend Leo (crafter) | Vite app, `npm run build` PASS | Per impl report |
| Verification | QA Eve (**crafter** if file mandatory) | `docs/verification-report.md` | `VERDICT: PASS` on disk |
| Closeout | Documentation Echo (**crafter** if file mandatory) | `docs/closeout-summary.md` | Optional Governor |

**Do NOT** spawn Frontend until `design-spec.md` exists when user asked for Designer or strict pipeline (*"kita ga pakai designer?"* → **yes for website**).

## Prompt files

Persist under `<project>/.aic/prompts/` (not `/tmp`):

- `TASK-*-pm-investigate-v2.txt` — concise docs only, reduce Opus timeout risk
- `TASK-*-architect-plan.txt`, `TASK-*-designer-spec.txt`
- `TASK-*-frontend-impl.txt` — list `design-spec.md` as authoritative UX

## Pause / config change

1. `process.kill` active spawn; `pkill -f opencode run.*<project>`
2. Set workers `idle` via API
3. Resume after user saves OpenCode config and says *lanjut*

## Post-spawn verification

- Run `npm run build` in project for Implementation evidence
- If QA exit 0 but `verification-report.md` missing, **rerun** with tier **`crafter`** — see `references/qa-rerun-until-pass.md`
- Loop until `grep 'VERDICT: PASS' docs/verification-report.md` (*tetap rerun sampai done*)
- **REWORK** (e.g. Lighthouse): `vite preview` + `npx lighthouse`, `docs/lighthouse-evidence.txt`, rerun QA
- `pm-review.sh`: trust `VERDICT: PASS` in output; exit 1 may be `xargs` quote bug

## User handoff

*"buat sampai jadi, nanti ku cek"* — complete pipeline without skips; **no git commit** until user asks.

## Related

- `references/promo-landing-site-pattern.md`
- `dispatcher-discipline-aic` — QA evidence, Dispatcher never edits site code