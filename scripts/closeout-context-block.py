#!/usr/bin/env python3
"""FIX-018: Build Closeout context block from live task artifacts (manifest + engine)."""
import json
import sys
from pathlib import Path


def main():
    if len(sys.argv) < 3:
        sys.exit(2)
    skill_dir = Path(sys.argv[1])
    task_id = sys.argv[2]
    ctx_path = Path(sys.argv[3]) if len(sys.argv) > 3 else skill_dir / ".aic/tasks" / task_id / "context.json"

    ctx = json.loads(ctx_path.read_text(encoding="utf-8")) if ctx_path.is_file() else {}
    tid = ctx.get("taskId") or task_id
    title = ctx.get("title", "")
    desc = ctx.get("description", "")

    task_dir = skill_dir / ".aic/tasks" / tid
    reports_dir = task_dir / "reports"
    manifest = []
    if reports_dir.is_dir():
        manifest = sorted(p.name for p in reports_dir.glob("*.md") if p.is_file())

    engine = {}
    eng_path = task_dir / "engine.json"
    if eng_path.is_file():
        try:
            engine = json.loads(eng_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            engine = {}

    pipeline = engine.get("pipelineState", "(unknown)")
    phase_status = engine.get("phaseStatus", "(unknown)")
    rework = engine.get("rework")
    pm_review = engine.get("pmReview") or {}

    verification_pm_pass = (
        pm_review.get("phase") == "Verification"
        and pm_review.get("exitCode") == 0
        and (pm_review.get("verdicts") or {}).get("all") == "PASS"
    )

    imp015_exercised = bool(
        rework
        and (
            (rework.get("attempt") or 0) > 0
            or rework.get("lastVerdict") == "REWORK"
        )
    )

    manifest_lines = "\n".join(f"  - {f}" for f in manifest) if manifest else "  (no .md files yet)"

    rework_lines = "none"
    if rework:
        rework_lines = json.dumps(rework, indent=2)

    complete_rule = ""
    if verification_pm_pass:
        complete_rule = """
Verification PM already PASS for this task (engine.json pmReview).
You MUST prepare a lifecycle COMPLETE recommendation for this task only.
Do not defer to a future OAT or reference previous task ids.
Do not claim phases are missing when their artifacts are listed in the manifest.
"""

    print(f"""CLOSEOUT CONTEXT (mandatory — FIX-018)

CURRENT TASK AUTHORITY
Task ID: {tid}
Task Title: {title}
Task Description: {desc}

Reports directory (only source of truth for phase evidence):
{reports_dir}

Manifest — reports/*.md (use ONLY these filenames; never invent or assume others):
{manifest_lines}

Engine snapshot:
  pipelineState: {pipeline}
  phaseStatus: {phase_status}
  rework: see below
  IMP-015 exercised this task: {"yes" if imp015_exercised else "no"} (from engine.json rework / PM REWORK history)

Rework JSON:
{rework_lines}

Required rollup sources (use manifest only):
  Planning: pm-output.md, architect-output.md, research-output.md (if present)
  Implementation: backend-output.md, frontend-output.md (if present)
  Verification: qa-output.md (if present)
  Do NOT reference planning-output.md unless it appears in the manifest above.

Rules:
- Never reference reports absent from the manifest.
- Never reference previous task ids (e.g. TASK-040) unless that id equals Task ID above.
- Never claim IMP-015 was not exercised if rework shows attempts or REWORK on this task.
- Never reuse historical rollups from other tasks.
- Every factual claim must be verifiable from manifest files or engine.json.
{complete_rule}""")


if __name__ == "__main__":
    main()