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
    "business_goal": r"(business goal|tujuan|goal:|objective|purpose)",
    "target_user": r"(target user|pengguna|audience|persona|target reader|target developer)",
    "target_user_or_consumer": r"(target user|consumer|pengguna|audience)",
    "target_consumer": r"(consumer|pengguna|client|developer)",
    "pages_or_ia": r"(pages?|sitemap|IA|information architecture|halaman)",
    "endpoints_or_resources": r"(endpoints?|resources?|routes?|api)",
    "core_features": r"(features?|fitur|functionality)",
    "core_capabilities": r"(capabilities|kemampuan|features?)",
    "core_components": r"(components?|komponen|services?)",
    "core_functions": r"(functions?|fungsi|methods?)",
    "commands_and_args": r"(commands?|arguments?|flags?|perintah)",
    "topics_covered": r"(topics?|topik|content|isi)",
    "deployment": r"(deploy|hosting|cloudflare|vercel|vps|production)",
    "deployment_or_delivery": r"(deploy|delivery|ship|release)",
    "deployment_strategy": r"(deploy|strategy|pipeline|ci/cd)",
    "acceptance_criteria": r"(acceptance|criteria|AC:|definition of done|DoD)",
    "scope_in_out": r"(scope|in scope|out of scope|luas)",
    "constraints": r"(constraint|batasan|must not|non-negotiable)",
    "tech_stack": r"(react|vite|next|stack|typescript|python|node|go|rust)",
    "platform_target": r"(platform|ios|android|web)",
    "os_target": r"(os|windows|mac|linux)",
    "infrastructure_target": r"(infrastructure|aws|gcp|azure|k8s)",
    "llm_provider": r"(llm|openai|anthropic|claude|gpt|provider)",
    "package_manager": r"(npm|pip|cargo|go mod|composer)",
    "format_or_platform": r"(format|markdown|pdf|html|confluence|notion)",
    "purpose": r"(purpose|tujuan|goal|objective)",
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
    if __import__("re").search(r"\b(review)\b.*\b(prd|brd|srs)\b", t) or "review prd" in t:
        return "review"
    if "improve" in t and ("prd" in t or "brd" in t):
        return "improve"
    if "architecture" in t or "arsitektur" in t:
        return "architecture"
    if "estimate" in t or "estimasi" in t or "timeline" in t:
        return "estimate"
    if __import__("re").search(r"\b(build|implement|buat)\b", t):
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
        ("ai_agent", ("agent", "orchestrat", "hermes", "aic", "llm")),
        ("cli", ("cli", "command line", "terminal tool")),
        ("devops", ("terraform", "kubernetes", "ci/cd", "pipeline", "docker")),
        ("documentation", ("documentation only", "docs only", "operator guide", "readme")),
        ("library", ("npm package", "library", "publishable", "pip install")),
        ("desktop_app", ("desktop", "electron", "tauri", "windows app")),
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
    return bool(__import__("re").search(pat, text, __import__("re").I))

def detect_micro_quick(text: str) -> bool:
    t = text.lower()
    return bool(
        __import__("re").search(r"fix typo|typo on|line \d+", t)
        and __import__("re").search(r"readme|\.md|\.txt|file", t)
    )

def extract_repo_context(project_dir: str) -> str:
    """Lightweight heuristic scanning of high-signal files."""
    if not project_dir:
        return ""
    p = Path(project_dir)
    if not p.exists() or not p.is_dir():
        return ""
    
    ctx = []
    # Tech stack hints
    if (p / "package.json").exists():
        ctx.append("npm node typescript react next vite")
    if (p / "requirements.txt").exists() or (p / "pyproject.toml").exists():
        ctx.append("python pip")
    if (p / "go.mod").exists():
        ctx.append("go golang")
    if (p / "Cargo.toml").exists():
        ctx.append("rust cargo")
    
    # Deployment / DevOps hints
    if (p / "Dockerfile").exists():
        ctx.append("docker container deployment")
    if (p / "docker-compose.yml").exists() or (p / "docker-compose.yaml").exists():
        ctx.append("docker-compose orchestration")
    
    # General context (first 50 lines of README)
    readme = p / "README.md"
    if readme.exists():
        try:
            with open(readme, "r", encoding="utf-8") as f:
                head = "".join([next(f) for _ in range(50)])
                ctx.append(head)
        except Exception:
            pass
            
    return " ".join(ctx)

def get_state_path(project_dir: str | None) -> Path:
    base = Path(".aic/intake")
    if project_dir:
        base = Path(project_dir) / ".aic" / "intake"
    base.mkdir(parents=True, exist_ok=True)
    return base / "session.json"

def read_state(project_dir: str | None) -> dict:
    path = get_state_path(project_dir)
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception:
            pass
    return {
        "version": 1,
        "project": None,
        "project_type": None,
        "intake_mode": None,
        "selected_intent": None,
        "prd_intent": None,
        "operator_approved": False,
        "question_count": 0,
        "max_questions": 10,
        "known_fields": {},
        "missing_fields": [],
        "created_at": None,
        "updated_at": None,
    }


def build_discovery_llm_payload(eval_result: dict, state: dict) -> dict:
    """Structured input for LLM question wording only (Option C). Validator owns fields."""
    mandatory = eval_result.get("mandatory") or {}
    known = {k: v for k, v in mandatory.items() if v in ("PRESENT", "DERIVABLE")}
    missing = list(eval_result.get("missing_for_planning") or [])
    return {
        "project_type": eval_result.get("project_type") or state.get("project_type"),
        "known_fields": known,
        "missing_fields": missing,
        "question_count": int(state.get("question_count") or 0),
        "max_questions": int(state.get("max_questions") or 10),
        "selected_intent": state.get("selected_intent") or state.get("prd_intent"),
    }


def discovery_stop_reason(eval_result: dict, state: dict) -> dict:
    """Deterministic stop signals — unchanged frozen conditions."""
    missing = eval_result.get("missing_for_planning") or []
    completeness = eval_result.get("completeness")
    qc = int(state.get("question_count") or 0)
    mx = int(state.get("max_questions") or 10)
    if completeness == "PASS" or not missing:
        return {"should_stop": True, "reason": "mandatory_complete"}
    if qc >= mx:
        return {"should_stop": True, "reason": "question_limit"}
    return {"should_stop": False, "reason": None}

def write_state(project_dir: str | None, state: dict):
    path = get_state_path(project_dir)
    import time
    if not state.get("created_at"):
        state["created_at"] = time.time()
    state["updated_at"] = time.time()
    path.write_text(json.dumps(state, indent=2))

def evaluate(text: str, project_type: str | None = None, prd_path: str | None = None, project_dir: str | None = None) -> dict:
    # 1. Context Engine: Unified ingestion
    full_context = text
    
    # PRD Context
    if prd_path and Path(prd_path).exists():
        try:
            full_context += "\n" + Path(prd_path).read_text(encoding="utf-8")
        except Exception:
            pass
            
    # Repo Context
    repo_context = extract_repo_context(project_dir if project_dir else "")
    
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

    # Only return early for From PRD if we just want intent resolution, 
    # but for requirement completeness context testing, we still need to evaluate.
    # The architecture states PRD intent "Build" requires gap checklist PASS.
    intent = None
    if detect_prd_artifact(text, prd_path):
        intent = detect_prd_intent(text)
        if intent and intent != "build":
            return {
                "intake_mode": "from_prd",
                "prd_intent": intent,
                "completeness": "NOT_APPLICABLE",
                "pipeline_allowed": False,
                "spawn_workers": False,
                "approval_required": False,
            }
        if not intent:
            return {
                "intake_mode": "from_prd",
                "prd_intent": "clarify_one_question",
                "completeness": "NOT_APPLICABLE",
                "pipeline_allowed": False,
                "spawn_workers": False,
                "approval_required": False,
            }

    ptype = detect_project_type(full_context, project_type)
    cl = load_checklist(ptype)
    mandatory = cl.get("mandatory") or []
    optional = cl.get("optional") or []
    fields = {}
    missing = []
    
    # Process both mandatory and optional fields so they appear in output
    all_fields = mandatory + optional
    
    for f in all_fields:
        # Check primary context (chat + PRD)
        ok = field_present(f, full_context)
        if ok:
            fields[f] = "PRESENT"
        else:
            # Check secondary context (Repo) for DERIVABLE
            if field_present(f, repo_context):
                fields[f] = "DERIVABLE"
            else:
                fields[f] = "MISSING"
                if f in mandatory:
                    missing.append(f)

    completeness = "PASS" if not missing else "FAIL"
    
    # For intent == "build", if completeness == "FAIL", we must transition back to Discovery
    mode = "quick" if completeness == "PASS" else "discovery"
    if intent:
        mode = "from_prd"
        
    out = {
        "intake_mode": mode,
        "project_type": ptype,
        "completeness": completeness,
        "mandatory": fields,
        "missing_for_planning": missing,
        "pipeline_allowed": completeness == "PASS",
        "spawn_workers": completeness == "PASS",
        "discovery_bounds": {"min": 3, "target": "5-7", "max": 10},
        "prd_artifact": f"PRD_<ProjectName>.md",
    }
    
    if intent:
        out["prd_intent"] = intent
        if intent == "build":
            out["approval_required"] = True
            if completeness == "PASS":
                # Only if gap checklist passes is the pipeline natively allowed
                out["pipeline_allowed"] = True
                out["spawn_workers"] = True
            else:
                # If gap fails, pipeline is NOT allowed until discovery loops complete
                pass

    if out.get("intake_mode") == "discovery" or (completeness == "FAIL" and not intent):
        if out.get("intake_mode") != "from_prd":
            out["intake_mode"] = "discovery"
            out["pipeline_allowed"] = False
            out["spawn_workers"] = False
        st = read_state(project_dir) if project_dir else {}
        out["discovery_stop"] = discovery_stop_reason(out, st)
        out["llm_question_input"] = build_discovery_llm_payload(out, st)

    return out


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", default="", help="User request text")
    ap.add_argument("--type", default=None, help="Force project_type")
    ap.add_argument("--prd", default=None, help="Path to PRD file")
    ap.add_argument("--dir", default=None, help="Project directory path")
    ap.add_argument("--case", default=None, help="Named verification case")
    ap.add_argument("--state-init", action="store_true", help="Initialize or reset state")
    ap.add_argument("--state-increment", action="store_true", help="Increment question count")
    ap.add_argument("--state-approve", action="store_true", help="Approve pipeline")
    ap.add_argument("--state-show", action="store_true", help="Print current state")
    ap.add_argument("--discovery-payload", action="store_true", help="Print LLM question input JSON only")
    args = ap.parse_args()

    if args.state_show:
        print(json.dumps(read_state(args.dir), indent=2))
        return

    if args.state_init:
        fresh = read_state(None)
        for k in ("question_count", "operator_approved", "known_fields", "missing_fields"):
            if k == "question_count":
                fresh[k] = 0
            elif k == "operator_approved":
                fresh[k] = False
            elif k == "known_fields":
                fresh[k] = {}
            elif k == "missing_fields":
                fresh[k] = []
        write_state(args.dir, fresh)
        print(json.dumps({"ok": True, "action": "init"}))
        return
        
    if args.state_increment:
        st = read_state(args.dir)
        st["question_count"] += 1
        write_state(args.dir, st)
        print(json.dumps({"ok": True, "action": "increment", "count": st["question_count"]}))
        return
        
    if args.state_approve:
        st = read_state(args.dir)
        st["operator_approved"] = True
        write_state(args.dir, st)
        print(json.dumps({"ok": True, "action": "approve"}))
        return

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

    text = args.text or (sys.stdin.read() if not sys.stdin.isatty() else "")
    out = evaluate(text, args.type, args.prd, args.dir)

    if args.discovery_payload:
        st = read_state(args.dir)
        print(json.dumps(build_discovery_llm_payload(out, st), indent=2))
        return

    # State integration: auto-update state with results if we have a dir
    if args.dir:
        st = read_state(args.dir)
        st["intake_mode"] = out.get("intake_mode")
        st["prd_intent"] = out.get("prd_intent")
        st["selected_intent"] = out.get("prd_intent") or st.get("selected_intent")
        st["project_type"] = out.get("project_type")
        st["missing_fields"] = out.get("missing_for_planning", [])
        mandatory = out.get("mandatory") or {}
        st["known_fields"] = {k: v for k, v in mandatory.items() if v in ("PRESENT", "DERIVABLE")}
        if out.get("pipeline_allowed"):
            st["operator_approved"] = True
        write_state(args.dir, st)

    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()