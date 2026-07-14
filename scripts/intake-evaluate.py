#!/usr/bin/env python3
"""EPIC-201 deterministic requirement completeness (no confidence %)."""
import json
import os
import re
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
CHECKLIST_DIR = SKILL_DIR / "templates" / "intake-checklists"

PROJECT_TYPES = [
    "website", "mobile_app", "api", "ai_agent", "desktop_app",
    "library", "cli", "devops", "documentation", "generic",
]

# Keyword hints for field presence in free text (deterministic, case-insensitive)
FIELD_PATTERNS = {
    "business_goal": r"(business goal|tujuan|goal:|objective)",
    "target_user": r"(target user|pengguna|audience|persona)",
    "target_user_or_consumer": r"(target user|consumer|pengguna|audience)",
    "pages_or_ia": r"(pages?|sitemap|IA|information architecture|halaman)",
    "core_features": r"(features?|fitur|functionality)",
    "deployment": r"(deploy|hosting|cloudflare|vercel|vps|production)",
    "deployment_or_delivery": r"(deploy|delivery|ship|release)",
    "acceptance_criteria": r"(acceptance|criteria|AC:|definition of done|DoD)",
    "scope_in_out": r"(scope|in scope|out of scope|luas)",
    "constraints": r"(constraint|batasan|must not|non-negotiable)",
    "tech_stack": r"(react|vite|next|stack|typescript|python)",
}


def load_checklist(project_type: str) -> dict:
    path = CHECKLIST_DIR / f"{project_type}.yaml"
    if not path.exists():
        path = CHECKLIST_DIR / "generic.yaml"
    text = path.read_text()
    mandatory, optional = [], []
    section = None
    for line in text.splitlines():
        s = line.strip()
        if s == "mandatory:":
            section = "m"
            continue
        if s == "optional:":
            section = "o"
            continue
        if s.startswith("- ") and section == "m":
            mandatory.append(s[2:].strip())
        if s.startswith("- ") and section == "o":
            optional.append(s[2:].strip())
    return {"project_type": project_type, "mandatory": mandatory, "optional": optional}


def detect_engineering_request(text: str) -> bool:
    t = text.lower()
    verbs = (
        "build", "buat", "implement", "fix", "add feature", "refactor",
        "create api", "landing page", "website", "deploy", "migrate",
    )
    return any(v in t for v in verbs)


def detect_conversation_only(text: str) -> bool:
    t = text.lower()
    if detect_engineering_request(text):
        return False
    cues = ("explain", "jelaskan", "what is", "apa itu", "how does", "status", "hai", "hello")
    return any(c in t for c in cues)


def detect_prd_artifact(text: str, path_arg: str | None) -> bool:
    if path_arg and Path(path_arg).exists():
        return True
    return bool(re.search(r"\b(PRD|BRD|SRS)\b", text, re.I)) or "github.com" in text.lower() or "jira" in text.lower()


def detect_prd_intent(text: str) -> str | None:
    t = text.lower()
    if re.search(r"\b(review)\b.*\b(prd|brd|srs)\b", t) or "review prd" in t:
        return "review"
    if "improve" in t and ("prd" in t or "brd" in t):
        return "improve"
    if "architecture" in t or "arsitektur" in t:
        return "architecture"
    if "estimate" in t or "estimasi" in t or "timeline" in t:
        return "estimate"
    if re.search(r"\b(build|implement|buat)\b", t):
        return "build"
    return None


def detect_project_type(text: str, explicit: str | None) -> str:
    if explicit and explicit in PROJECT_TYPES:
        return explicit
    t = text.lower()
    rules = [
        ("website", ("website", "landing page", "marketing site")),
        ("mobile_app", ("mobile app", "ios", "android", "react native", "flutter")),
        ("api", ("rest api", "graphql", "endpoint", "openapi")),
        ("ai_agent", ("agent", "orchestrat", "hermes", "aic")),
        ("cli", ("cli", "command line")),
        ("devops", ("terraform", "kubernetes", "ci/cd", "pipeline")),
        ("documentation", ("documentation only", "docs only", "operator guide")),
        ("library", ("npm package", "library", "publishable")),
    ]
    best, score = "generic", 0
    for ptype, kws in rules:
        s = sum(1 for k in kws if k in t)
        if s > score:
            score, best = s, ptype
    return best if score >= 1 else "generic"


def field_present(field: str, text: str) -> bool:
    pat = FIELD_PATTERNS.get(field)
    if not pat:
        return False
    return bool(re.search(pat, text, re.I))


def detect_micro_quick(text: str) -> bool:
    t = text.lower()
    return bool(
        re.search(r"fix typo|typo on|line \d+", t)
        and re.search(r"readme|\.md|\.txt|file", t)
    )


def evaluate(text: str, project_type: str | None = None, prd_path: str | None = None) -> dict:
    if detect_conversation_only(text) and not detect_engineering_request(text):
        return {
            "intake_mode": "conversation",
            "completeness": "NOT_APPLICABLE",
            "pipeline_allowed": False,
            "spawn_workers": False,
        }

    if detect_micro_quick(text):
        return {
            "intake_mode": "quick",
            "project_type": "generic",
            "completeness": "PASS",
            "mandatory": {},
            "missing_for_planning": [],
            "pipeline_allowed": True,
            "spawn_workers": True,
            "micro_task": True,
        }

    if detect_prd_artifact(text, prd_path):
        intent = detect_prd_intent(text)
        mode = "from_prd"
        pipeline = intent == "build"
        return {
            "intake_mode": mode,
            "prd_intent": intent or "clarify_one_question",
            "completeness": "NOT_APPLICABLE",
            "pipeline_allowed": pipeline,
            "spawn_workers": pipeline,
            "approval_required": pipeline,
        }

    ptype = detect_project_type(text, project_type)
    cl = load_checklist(ptype)
    mandatory = cl.get("mandatory") or []
    fields = {}
    missing = []
    for f in mandatory:
        ok = field_present(f, text)
        fields[f] = "PRESENT" if ok else "MISSING"
        if not ok:
            missing.append(f)

    completeness = "PASS" if not missing else "FAIL"
    mode = "quick" if completeness == "PASS" else "discovery"

    return {
        "intake_mode": mode,
        "project_type": ptype,
        "completeness": completeness,
        "mandatory": fields,
        "missing_for_planning": missing,
        "pipeline_allowed": mode == "quick",
        "spawn_workers": mode == "quick",
        "discovery_bounds": {"min": 3, "target": "5-7", "max": 10},
        "prd_artifact": f"PRD_<ProjectName>.md",
    }


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", default="", help="User request text")
    ap.add_argument("--type", default=None, help="Force project_type")
    ap.add_argument("--prd", default=None, help="Path to PRD file")
    ap.add_argument("--case", default=None, help="Named verification case")
    args = ap.parse_args()

    cases = {
        "conversation": ("jelaskan apa itu phase barrier", None, None),
        "quick": ("fix typo on README line 5, acceptance: grep shows correct word", None, None),
        "discovery": ("buat landing page untuk biochar", None, None),
        "from_prd_review": ("review this PRD attached", None, "/tmp/PRD_x.md"),
        "from_prd_improve": ("improve the PRD formatting", None, "/tmp/PRD_x.md"),
        "from_prd_architecture": ("generate architecture from PRD", None, "/tmp/PRD_x.md"),
        "from_prd_estimate": ("estimate effort from PRD", None, "/tmp/PRD_x.md"),
        "from_prd_build": ("build the project from this PRD", None, "/tmp/PRD_x.md"),
        "from_prd_upload_only": ("here is the PRD", None, "/tmp/PRD_x.md"),
    }

    if args.case:
        if args.case not in cases:
            print(json.dumps({"error": "unknown case"}))
            sys.exit(1)
        text, ptype, prd = cases[args.case]
        if args.case == "from_prd_upload_only":
            Path("/tmp/PRD_x.md").write_text("# PRD\n\n## Business Goal\nx\n")
        result = evaluate(text, ptype, prd)
        print(json.dumps(result, indent=2))
        return

    text = args.text or sys.stdin.read()
    print(json.dumps(evaluate(text, args.type, args.prd), indent=2))


if __name__ == "__main__":
    main()