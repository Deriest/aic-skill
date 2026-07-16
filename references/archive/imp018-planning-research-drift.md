# IMP-018 — Planning research context drift (investigation)

**When:** OAT 042 Planning PM REWORK after 040/041 Planning PASS; research off-brief (generic Hermes/OpenCode integration, wrong **TASK-20260713-002**) while FIX-016 block present.

## Conclusion

| Ruled out | Still primary |
|-----------|----------------|
| Missing `context.json` / `RESEARCH_PLANNING_BLOCK` | **OpenCode thinker** nondeterminism |
| Prompt ordering vs 040/041 | **Stale artifacts** on disk during IMP-015 repair (pre-FIX-019) |
| `TASK-002` in repo or prompt | **Hallucination / wrong package** in generated markdown (PM read artifact) |

## 042 first PM cycle (log)

Often **mixed trio**: `pm-output.md` still **TASK-040 / OAT-IMP015**, `architect` wrong package (e.g. DOCCONSOL), `research` off FIX-018 — not research-only failure.

## Smallest corrective action (shipped FIX-019)

1. Delete repaired worker artifacts before respawn.
2. Inject PM findings into repair prompt.
3. Planning post-gen gate + one regen.

Do **not** only strengthen forbidden lists without artifact clear + repair feedback.

## OAT note

FIX-018 OAT can fail in **Planning** before Closeout — that is not a Closeout regression.

## Related

- `references/runtime-fix016-planning-research-scope.md`
- `references/runtime-fix019-pm-repair-respawn.md`
- `references/runtime-imp015-pm-repair-loop.md`