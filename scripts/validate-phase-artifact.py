#!/usr/bin/env python3
"""Contract-driven artifact validation. --json for structured WECP output."""
import importlib.util
import json
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location(
    "phase_contract_loader", SCRIPT_DIR / "phase-contract-loader.py"
)
pcl = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(pcl)

SESSION_MARKERS = (
    '"type":"tool_use"',
    '"type": "tool_use"',
    '"sessionID"',
    '"callID"',
)


def is_session_dump(text, forbidden, forbid_dump):
    if not forbid_dump:
        return False
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return True
    jsonish = sum(1 for ln in lines[:40] if ln.startswith("{") and ln.endswith("}"))
    if jsonish >= max(3, len(lines) // 2):
        return True
    head = text[:8000]
    if sum(1 for m in SESSION_MARKERS if m in head) >= 2:
        return True
    for pat in forbidden or []:
        if pat in head:
            return True
    return False


# --- Legacy (backward compatible) ---

def validate_file(skill_dir, phase, role, path):
    rc = pcl.load_role_contract(skill_dir, phase, role)
    if not rc:
        return True, "no contract (skip)"
    try:
        text = open(path, encoding="utf-8", errors="replace").read()
    except OSError as e:
        return False, str(e)
    v = rc.get("validation") or {}
    min_b = int(v.get("minBytes") or 10)
    if len(text.encode("utf-8")) < min_b:
        return False, f"below minBytes {min_b}"
    if is_session_dump(text, v.get("forbiddenPatterns") or [], v.get("forbidSessionDump", True)):
        return False, "raw session/NDJSON dump or forbidden pattern"
    miss = [s for s in (rc.get("requiredSections") or []) if s not in text]
    if miss:
        return False, "missing sections: " + ", ".join(miss)
    if not re.search(r"##\s+(Objective|Changes|Result|Scope|Requirements)", text):
        return False, "insufficient markdown structure"
    return True, "ok"


# --- Structured (for WECP) ---

def find_section_content(text, heading):
    pattern = r"^" + re.escape(heading) + r"\s*$"
    m = re.search(pattern, text, re.MULTILINE)
    if not m:
        return None
    level = len(heading) - len(heading.lstrip("#"))
    after = text[m.end():]
    next_pat = r"^#{1," + str(level) + r"}\s+\S"
    nm = re.search(next_pat, after, re.MULTILINE)
    return (after[:nm.start()] if nm else after).strip()


def validate_file_structured(skill_dir, phase, role, path, min_section_chars=40):
    rc = pcl.load_role_contract(skill_dir, phase, role)
    if not rc:
        return {"ok": True, "phase": phase, "role": role, "artifact": path,
                "errors": [], "repairHints": []}
    try:
        text = open(path, encoding="utf-8", errors="replace").read()
    except OSError as e:
        err = {"code": "FILE_ERROR", "severity": "error", "repairHint": str(e)}
        return {"ok": False, "phase": phase, "role": role, "artifact": path,
                "errors": [err], "repairHints": [str(e)]}

    errors = []
    v = rc.get("validation") or {}

    min_b = int(v.get("minBytes") or 10)
    if len(text.encode("utf-8")) < min_b:
        errors.append({"code": "ARTIFACT_TOO_SMALL", "severity": "error",
                        "repairHint": f"Artifact must be at least {min_b} bytes"})

    if is_session_dump(text, v.get("forbiddenPatterns") or [], v.get("forbidSessionDump", True)):
        errors.append({"code": "FORBIDDEN_PATTERN", "severity": "error",
                        "repairHint": "Remove raw JSON/NDJSON/session dumps; write structured markdown"})

    for section in rc.get("requiredSections") or []:
        content = find_section_content(text, section)
        if content is None:
            errors.append({"code": "MISSING_SECTION", "section": section, "severity": "error",
                           "repairHint": f"Add {section} with substantive content"})
        elif not content:
            errors.append({"code": "EMPTY_SECTION", "section": section, "severity": "error",
                           "repairHint": f"Fill {section} with substantive content"})
        elif len(content) < min_section_chars:
            errors.append({"code": "SECTION_TOO_SHORT", "section": section,
                           "chars": len(content), "minChars": min_section_chars,
                           "severity": "error",
                           "repairHint": f"Expand {section} to at least {min_section_chars} characters"})

    return {"ok": not errors, "phase": phase, "role": role, "artifact": path,
            "errors": errors, "repairHints": [e["repairHint"] for e in errors]}


if __name__ == "__main__":
    use_json = "--json" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--json"]
    if len(args) != 4:
        print("usage: validate-phase-artifact.py [--json] <skill_dir> <phase> <role> <path>",
              file=sys.stderr)
        sys.exit(2)
    if use_json:
        result = validate_file_structured(args[0], args[1], args[2], args[3])
        print(json.dumps(result))
        sys.exit(0 if result["ok"] else 1)
    ok, msg = validate_file(args[0], args[1], args[2], args[3])
    if not ok:
        print(msg, file=sys.stderr)
        sys.exit(1)
    print(msg)
    sys.exit(0)
