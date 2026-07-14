#!/usr/bin/env python3
"""IMP-002 pilot: load phase deliverable contracts and render prompt/PM rubric."""
import json
import os
import re
import sys
from pathlib import Path

PHASE_FILE = {
    "investigate": "investigate.json",
    "implementation": "implementation.json",
}


def contracts_dir(skill_dir: str) -> Path:
    return Path(skill_dir) / ".aic" / "phase-contracts"


def normalize_phase(phase: str) -> str:
    return re.sub(r"[^a-z]", "", phase.lower())


def load_phase_contract(skill_dir: str, phase: str) -> dict | None:
    key = normalize_phase(phase)
    fname = PHASE_FILE.get(key)
    if not fname:
        return None
    path = contracts_dir(skill_dir) / fname
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def load_role_contract(skill_dir: str, phase: str, role: str) -> dict | None:
    pc = load_phase_contract(skill_dir, phase)
    if not pc:
        return None
    return (pc.get("roles") or {}).get(role)


def render_worker_prompt_block(skill_dir: str, phase: str, role: str) -> str:
    rc = load_role_contract(skill_dir, phase, role)
    if not rc:
        return ""
    lines = [
        "",
        "Phase deliverable contract (required):",
        f"Artifact: reports/{rc['artifact']['filename']}",
        "Use EXACTLY these Markdown headings and fill each with substantive content:",
    ]
    for h in rc.get("requiredSections") or []:
        lines.append(h)
    for rule in rc.get("promptRules") or []:
        lines.append(f"Rule: {rule}")
    for ac in rc.get("acceptanceCriteria") or []:
        lines.append(f"Acceptance: {ac}")
    return "\n".join(lines) + "\n"


def render_pm_rubric(skill_dir: str, phase: str) -> str:
    pc = load_phase_contract(skill_dir, phase)
    if not pc:
        return ""
    lines = [
        "",
        "## Phase deliverable contract (authoritative for this review)",
        f"Phase: {pc.get('phase', phase)}",
        f"Schema: {pc.get('schemaVersion', '?')}",
    ]
    for role, rc in (pc.get("roles") or {}).items():
        lines.append(f"### Role: {role} — artifact: {rc['artifact']['filename']}")
        for h in rc.get("requiredSections") or []:
            lines.append(f"- Required heading: {h}")
        for ac in rc.get("acceptanceCriteria") or []:
            lines.append(f"- Acceptance: {ac}")
        for rule in rc.get("promptRules") or []:
            lines.append(f"- Rule: {rule}")
    lines.append(
        "Validate artifacts against the contract above. REWORK if contract is not met."
    )
    return "\n".join(lines)


def artifact_filenames_for_phase(skill_dir: str, phase: str) -> list[str]:
    pc = load_phase_contract(skill_dir, phase)
    if not pc:
        return []
    out = []
    for rc in (pc.get("roles") or {}).values():
        fn = (rc.get("artifact") or {}).get("filename")
        if fn:
            out.append(fn)
    return out


def main():
    if len(sys.argv) < 3:
        print("usage: phase-contract-loader.py <command> <skill_dir> [phase] [role]", file=sys.stderr)
        sys.exit(2)
    cmd, skill_dir = sys.argv[1], sys.argv[2]
    if cmd == "prompt-block":
        phase, role = sys.argv[3], sys.argv[4]
        sys.stdout.write(render_worker_prompt_block(skill_dir, phase, role))
    elif cmd == "pm-rubric":
        phase = sys.argv[3]
        sys.stdout.write(render_pm_rubric(skill_dir, phase))
    elif cmd == "artifact-files":
        phase = sys.argv[3]
        for f in artifact_filenames_for_phase(skill_dir, phase):
            print(f)
    elif cmd == "load":
        phase = sys.argv[3]
        pc = load_phase_contract(skill_dir, phase)
        print(json.dumps(pc or {}))
    else:
        print(f"unknown command: {cmd}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()