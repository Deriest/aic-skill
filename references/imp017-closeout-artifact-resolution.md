# IMP-017 — Closeout PM REWORK / Artifact Resolution (TASK-041)

**Session:** 2026-07-14. Investigation only. **FIX-017 PASS**, **IMP-015 PASS** on Closeout; terminal **BLOCKED** after `maxPmRepairAttempts`.

## Symptom

- Investigate → Verification **PM PASS**
- Closeout **PM REWORK** × N → `pm repair limit exceeded` → **BLOCKED**
- Log PM: rollup says `qa-output.md` **absent**, `planning-output.md` **TASK-040**; asks to fix inventory / lifecycle COMPLETE narrative

## Ground truth (041 `reports/`)

| Claim in Closeout `pm-output.md` | Disk |
|----------------------------------|------|
| `qa-output.md` absent | **`qa-output.md` exists** (TASK-041, substantive) |
| `planning-output.md` TASK-040 | **No `planning-output.md`** — Planning = `pm-output.md`, `architect-output.md`, `research-output.md` (041-aligned) |
| IMP-015 not exercised | **`engine.json` `rework`** + log `pm repair` on Closeout |

## Root cause (primary)

**Artifact Resolution** — Closeout worker (`pm` only per `fsm.js`) synthesizes phase inventory **without** mandatory grounding in actual `reports/*` files. Repair respawns `pm` with generic `phase-runner` prompt; **no manifest injection** → same class of rollup errors.

Not: IMP-015, Runtime, WECP validator, FIX-017.

## Why earlier phases PASS

Gate PM reviews **per-phase artifacts** that were correct. Closeout is a **cross-phase synthesis** task with **no** `closeout.json` contract (unlike `implementation.json`).

## Minimal fix (smallest)

1. **`phase-runner.sh`** — Closeout + `pm` only: block **CLOSEOUT DELIVERABLE** with:
   - `context.json` Task Authority (041)
   - Explicit list: glob/read `reports/*-output.md` for `AIC_TASK_ID`
   - Rules: only assert facts provable from those files; **do not** reference `planning-output.md` if missing; map Planning → pm/architect/research outputs
   - IMP-015: if `engine.json` `rework` or PM log shows repair in **this** task, document it (do not claim N/A)
   - **COMPLETE**: if Verification PM already PASS in same task + user description asks lifecycle COMPLETE, align narrative with engine terminal state (or split “structural closeout” vs “L4 poll” explicitly)

2. **Do not** raise `maxPmRepairAttempts` or change IMP-015 loop.

## OAT 041 checklist (forensics)

| Item | Result |
|------|--------|
| FIX-017 | PASS (generate PASS both crafters) |
| IMP-015 | PASS (Closeout repair, selective `pm`) |
| COMPLETE | No (Closeout PM cap) |

## Related

- `references/runtime-imp015-pm-repair-loop.md`
- `references/runtime-fix017-implementation-skeleton-lock.md`
- `references/runtime-oat-planning-artifact-alignment.md` (Planning naming — no single `planning-output.md` in FSM)