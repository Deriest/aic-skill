#!/usr/bin/env python3
"""Worker Execution Compliance Pipeline (WECP).
Generates → Validates → Repairs → Validates → Submits.
Exit 0 = validated artifact submitted.  Exit 1 = failed after repair.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent


def load_config(skill_dir):
    p = Path(skill_dir) / ".aic" / "worker-compliance.json"
    if not p.is_file():
        return {"defaults": {"maxRepairAttempts": 2, "repairTimeout": 120, "minSectionChars": 40}}
    return json.loads(p.read_text())


def get_limits(cfg, phase, role):
    d = cfg.get("defaults", {})
    base: dict = {
        "maxRepairAttempts": int(d.get("maxRepairAttempts", 2)),
        "repairTimeout": int(d.get("repairTimeout", 120)),
        "minSectionChars": int(d.get("minSectionChars", 40)),
    }
    phase_cfg = (cfg.get("phases") or {}).get(phase, {})
    role_cfg = (phase_cfg.get("roles") or {}).get(role, {})
    for override in [phase_cfg, role_cfg]:
        for k, v in override.items():
            if k == "roles":
                continue
            if isinstance(v, (int, float, str)):
                base[k] = v
    return base


def extract_session_id(json_file):
    """Last non-empty sessionID from opencode --format json NDJSON."""
    if not json_file or not os.path.exists(json_file):
        return None
    sid = None
    for line in Path(json_file).read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            o = json.loads(line)
        except json.JSONDecodeError:
            continue
        for key in ("sessionID", "sessionId"):
            if o.get(key):
                sid = o[key]
            part = o.get("part") or {}
            if part.get(key):
                sid = part[key]
    return sid


def _write_node_runner(path, opencode_argv_template):
    """opencode_argv_template: list of JS expressions building argv array."""
    Path(path).write_text(
        'const { execFileSync } = require("child_process");\n'
        'const fs = require("fs");\n'
        'const model = process.argv[2];\n'
        'const cwd = process.argv[3];\n'
        'const timeout = parseInt(process.argv[4] || "300") * 1000;\n'
        'const outputFile = process.argv[5];\n'
        f'const argv = {opencode_argv_template};\n'
        'try {\n'
        '  const result = execFileSync("opencode", argv, {\n'
        '    cwd: cwd, timeout: timeout, encoding: "utf8",\n'
        '  });\n'
        '  fs.writeFileSync(outputFile, result);\n'
        '} catch (e) {\n'
        '  if (e.stdout) fs.writeFileSync(outputFile, e.stdout);\n'
        '  process.exit(e.status || 1);\n'
        '}\n'
    )


def run_opencode(prompt_file, model, cwd, timeout_sec):
    out = tempfile.mktemp(prefix="wecp-out-", suffix=".txt")
    node_script = tempfile.mktemp(prefix="wecp-run-", suffix=".js")
    _write_node_runner(
        node_script,
        '[ "run", process.argv[6], "-m", model, "--auto", "--format", "json" ]',
    )
    try:
        subprocess.run(
            ["node", node_script, model, str(cwd), str(timeout_sec), out, str(prompt_file)],
            check=True,
            timeout=timeout_sec + 60,
        )
        path = out if os.path.exists(out) and os.path.getsize(out) > 0 else None
        return path, extract_session_id(path) if path else None
    except subprocess.CalledProcessError as e:
        print(f"=== WECP: opencode exit={e.returncode} ===", file=sys.stderr)
        path = out if os.path.exists(out) and os.path.getsize(out) > 0 else None
        return path, extract_session_id(path) if path else None
    except subprocess.TimeoutExpired:
        print(f"=== WECP: opencode timeout ({timeout_sec}s) ===", file=sys.stderr)
        return None, None
    finally:
        safe_unlink(node_script)


def run_opencode_continue(session_id, message, model, cwd, timeout_sec):
    """Exactly one continue pass (Strategy B)."""
    out = tempfile.mktemp(prefix="wecp-out-cont-", suffix=".txt")
    node_script = tempfile.mktemp(prefix="wecp-run-cont-", suffix=".js")
    msg_js = json.dumps(message)
    _write_node_runner(
        node_script,
        f'[ "run", {msg_js}, "-m", model, "--continue", "-s", process.argv[6], "--auto", "--format", "json" ]',
    )
    try:
        subprocess.run(
            ["node", node_script, model, str(cwd), str(timeout_sec), out, session_id],
            check=True,
            timeout=timeout_sec + 60,
        )
        path = out if os.path.exists(out) and os.path.getsize(out) > 0 else None
        return path
    except subprocess.CalledProcessError as e:
        print(f"=== WECP: opencode continue exit={e.returncode} ===", file=sys.stderr)
        return out if os.path.exists(out) and os.path.getsize(out) > 0 else None
    except subprocess.TimeoutExpired:
        print(f"=== WECP: opencode continue timeout ({timeout_sec}s) ===", file=sys.stderr)
        return None
    finally:
        safe_unlink(node_script)


def load_continue_prompt():
    script = SCRIPT_DIR / "worker-continue-prompt.sh"
    if not script.is_file():
        return (
            "Output ONLY the final assistant message containing the complete markdown report. "
            "Do not call any tools."
        )
    r = subprocess.run(["bash", str(script)], capture_output=True, text=True, check=False)
    return (r.stdout or "").strip() or "Output ONLY the final markdown report. No tools."


def generate_with_optional_continue(prompt_path, model, project_dir, gen_timeout):
    """Pass 1 run + extract; on failure exactly one --continue if session id present."""
    json_file, session_id = run_opencode(prompt_path, model, project_dir, gen_timeout)
    if not json_file:
        return None, None

    md_file = extract_md(json_file)
    if md_file:
        return md_file, json_file

    if not session_id:
        print("=== WECP: generate extraction failed (no session for continue) ===", file=sys.stderr)
        safe_unlink(json_file)
        return None, None

    print("=== WECP: generate continue (Strategy B) ===", file=sys.stderr)
    cont_msg = load_continue_prompt()
    cont_json = run_opencode_continue(session_id, cont_msg, model, project_dir, gen_timeout)
    safe_unlink(json_file)
    if not cont_json:
        print("=== WECP: generate continue failed ===", file=sys.stderr)
        return None, None

    md_file = extract_md(cont_json)
    if not md_file:
        print("=== WECP: generate extraction failed after continue ===", file=sys.stderr)
        safe_unlink(cont_json)
        return None, None
    return md_file, cont_json


def extract_md(json_file):
    md_file = tempfile.mktemp(prefix="wecp-md-", suffix=".md")
    try:
        with open(md_file, "w") as f:
            subprocess.run(
                [sys.executable, str(SCRIPT_DIR / "opencode-json-to-md.py"), json_file],
                stdout=f, check=True,
            )
        return md_file
    except subprocess.CalledProcessError:
        return None


def _split_yaml_frontmatter(text):
    """Return (yaml_block, body) if leading --- ... --- else ('', text)."""
    if not text.startswith("---"):
        return "", text
    lines = text.splitlines(keepends=True)
    if not lines or lines[0].strip() != "---":
        return "", text
    for j in range(1, len(lines)):
        if lines[j].strip() == "---":
            return "".join(lines[: j + 1]), "".join(lines[j + 1 :])
    return "", text


def normalize_artifact_to_contract_h1(text, required_sections):
    """FIX-014: artifact begins at first required heading; strip session preamble."""
    if not required_sections:
        return text
    h1 = (required_sections[0] or "").strip()
    if not h1.startswith("#"):
        return text
    yaml_block, body = _split_yaml_frontmatter(text)
    lines = body.splitlines(keepends=True)
    h1_idx = None
    for i, ln in enumerate(lines):
        if ln.strip() == h1:
            h1_idx = i
            break
    if h1_idx is None:
        return text
    prefix = lines[:h1_idx]
    kept_blanks = [ln for ln in prefix if not ln.strip()]
    normalized_body = "".join(kept_blanks) + "".join(lines[h1_idx:])
    return yaml_block + normalized_body


def normalize_md_file(md_path, headings):
    path = Path(md_path)
    text = path.read_text(encoding="utf-8", errors="replace")
    norm = normalize_artifact_to_contract_h1(text, headings)
    if norm != text:
        path.write_text(norm, encoding="utf-8")
        print("=== WECP: normalized preamble (FIX-014) ===", file=sys.stderr)
    return norm


def validate(skill_dir, phase, role, artifact_path, min_section_chars):
    cmd = [sys.executable, str(SCRIPT_DIR / "validate-phase-artifact.py"),
           "--json", str(skill_dir), phase, role, str(artifact_path)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.stdout.strip():
        return json.loads(r.stdout.strip())
    return {"ok": False, "errors": [{"code": "VALIDATOR_ERROR", "repairHint": r.stderr}]}


def build_repair_prompt(original_prompt, artifact_text, errors, contract_headings):
    codes = [e.get("code") for e in errors]
    only_missing = bool(errors) and all(c == "MISSING_SECTION" for c in codes)
    if only_missing and contract_headings:
        lines = [
            "=== REPAIR INSTRUCTIONS (FIX-017: full skeleton) ===",
            "The artifact is missing required contract headings.",
            "Discard the previous structure. Output a COMPLETE new markdown report.",
            "Use EXACTLY these headings once each (character-for-character):",
            "",
        ]
        for h in contract_headings:
            lines.append(h)
        lines += [
            "",
            "Populate every section with substantive engineering content for the task.",
            "No preamble before the first heading. No planning or exploratory prose.",
            "",
            "=== ORIGINAL TASK PROMPT ===",
            original_prompt[:6000],
        ]
        return "\n".join(lines)

    lines = [
        "=== REPAIR INSTRUCTIONS ===",
        "Fix ONLY the listed issues. Do NOT regenerate the entire document.",
        "Preserve all existing good content. Patch/expand only failing sections.",
        "",
        "Issues:",
    ]
    for err in errors:
        section = err.get("section", "")
        code, hint = err["code"], err.get("repairHint", "")
        lines.append(f"  - [{code}] {section}: {hint}" if section else f"  - [{code}]: {hint}")
    lines += ["", "Required headings:"]
    for h in contract_headings:
        lines.append(f"  {h}")
    lines += ["", "=== CURRENT ARTIFACT ===", artifact_text[:8000]]
    if len(artifact_text) > 8000:
        lines.append(f"\n[truncated at 8000/{len(artifact_text)} chars]")
    lines += ["", "=== ORIGINAL TASK PROMPT ===", original_prompt[:4000]]
    return "\n".join(lines)


def load_contract_headings(skill_dir, phase, role):
    cmd = [sys.executable, str(SCRIPT_DIR / "phase-contract-loader.py"), "load", str(skill_dir), phase]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return []
    pc = json.loads(r.stdout)
    return ((pc.get("roles") or {}).get(role) or {}).get("requiredSections") or []


def safe_unlink(p):
    try:
        if p and os.path.exists(p):
            os.unlink(p)
    except OSError:
        pass


def post_worker_metrics(skill_dir, worker, tier, model, json_paths, task_id=""):
    """One POST /api/metrics per WECP execution (sum of NDJSON files)."""
    if not json_paths:
        return
    extract_py = SCRIPT_DIR / "opencode-token-extract.py"
    r = subprocess.run(
        [sys.executable, str(extract_py), *[str(p) for p in json_paths if p]],
        capture_output=True,
        text=True,
        check=False,
    )
    if r.returncode != 0 or not r.stdout.strip():
        print("=== WECP: metrics extract failed ===", file=sys.stderr)
        return
    tokens = json.loads(r.stdout.strip())
    if not tokens.get("input"):
        return
    api_url = os.environ.get("AIC_API_URL", "http://localhost:6868").rstrip("/")
    payload = {
        "worker": worker,
        "tier": tier,
        "model": model,
        "taskId": task_id or None,
        "tokens": tokens,
        "durationSec": 0,
    }
    headers = {"Content-Type": "application/json"}
    auth_file = Path(skill_dir) / ".aic" / "auth.json"
    if auth_file.is_file():
        try:
            headers["X-API-Key"] = json.loads(auth_file.read_text())["apiKeys"][0]["key"]
        except (KeyError, IndexError, json.JSONDecodeError):
            pass
    try:
        import urllib.request

        req = urllib.request.Request(
            f"{api_url}/api/metrics",
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        urllib.request.urlopen(req, timeout=15)
    except Exception as e:
        print(f"=== WECP: metrics POST failed: {e} ===", file=sys.stderr)


def run_pipeline(skill_dir, worker, tier, project_dir, prompt_file):
    cfg = load_config(skill_dir)
    phase_raw = os.environ.get("AIC_PIPELINE_PHASE", "Implementation")
    phase = phase_raw[0].upper() + phase_raw[1:].lower() if phase_raw else "Implementation"
    limits = get_limits(cfg, phase, worker)
    max_repairs = limits["maxRepairAttempts"]
    min_section_chars = limits["minSectionChars"]
    repair_timeout = limits.get("repairTimeout", 120)

    env_file = Path(skill_dir) / ".env"
    if env_file.is_file():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

    provider = os.environ.get("PROVIDER", "aic")
    tier_model = {"thinker": "MODEL_THINKER", "crafter": "MODEL_CRAFTER", "sprinter": "MODEL_SPRINTER"}
    model = f"{provider}/{os.environ.get(tier_model.get(tier, 'MODEL_CRAFTER'), '')}"
    # Initial generation uses tier TIMEOUT (same as legacy spawn-worker), repairs use repairTimeout
    gen_timeout = int(os.environ.get("TIMEOUT", "1800"))

    prompt_text = Path(prompt_file).read_text(encoding="utf-8", errors="replace")
    headings = load_contract_headings(skill_dir, phase, worker)  # phase already normalized

    report_dir = None
    task_id = os.environ.get("AIC_TASK_ID", "")
    if task_id:
        report_dir = Path(skill_dir) / ".aic" / "tasks" / task_id / "reports"
        report_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = str(report_dir / f"{worker}-output.md") if report_dir else None

    print(f"=== WECP: {worker} phase={phase} tier={tier} repairs={max_repairs} ===", file=sys.stderr)
    md_file = None
    val_errors = []
    json_paths = []

    for attempt in range(max_repairs + 1):
        tag = f"repair#{attempt}" if attempt > 0 else "generate"
        print(f"--- WECP: {tag} ---", file=sys.stderr)

        current_prompt = prompt_file
        repair_tmp = None
        if attempt > 0:
            repair_tmp = tempfile.NamedTemporaryFile(
                mode="w", suffix=".txt", prefix="wecp-repair-", delete=False
            )
            repair_tmp.write(build_repair_prompt(
                prompt_text, Path(md_file or "").read_text(encoding="utf-8", errors="replace"),
                val_errors, headings,
            ))
            repair_tmp.close()
            current_prompt = repair_tmp.name

        json_file = None
        if attempt == 0:
            md_file, json_file = generate_with_optional_continue(
                current_prompt, model, project_dir, gen_timeout
            )
            if not md_file:
                print(f"=== WECP: {tag} opencode failed ===", file=sys.stderr)
                return 1
        else:
            json_file = run_opencode(current_prompt, model, project_dir, repair_timeout)[0]
            if repair_tmp:
                safe_unlink(repair_tmp.name)

            if not json_file:
                print(f"=== WECP: {tag} opencode failed ===", file=sys.stderr)
                continue

            md_file = extract_md(json_file)
            if not md_file:
                print(f"=== WECP: {tag} extraction failed ===", file=sys.stderr)
                safe_unlink(json_file)
                continue

        if attempt == 0 and repair_tmp:
            safe_unlink(repair_tmp.name)

        if json_file:
            json_paths.append(json_file)

        normalize_md_file(md_file, headings)

        result = validate(skill_dir, phase, worker, md_file, min_section_chars)
        val_errors = result.get("errors", [])
        if result["ok"]:
            print(f"=== WECP: {tag} PASS ===", file=sys.stderr)
            post_worker_metrics(skill_dir, worker, tier, model, json_paths, task_id)
            for jp in json_paths:
                safe_unlink(jp)
            json_paths.clear()
            if artifact_path:
                shutil.copy2(md_file, artifact_path)
            safe_unlink(md_file)
            return 0

        codes = [e["code"] for e in val_errors]
        print(f"=== WECP: {tag} FAIL: {codes} ===", file=sys.stderr)

        if attempt == 0 and any(c in codes for c in ("FILE_ERROR",)):
            print("=== WECP: unrecoverable ===", file=sys.stderr)
            safe_unlink(md_file)
            for jp in json_paths:
                safe_unlink(jp)
            return 1

        # keep md_file for repair prompt; retain json_paths for token sum on success

    print(f"=== WECP: FAILED_AFTER_REPAIR ({max_repairs} attempts) ===", file=sys.stderr)
    safe_unlink(md_file)
    for jp in json_paths:
        safe_unlink(jp)
    return 1


if __name__ == "__main__":
    if len(sys.argv) < 6:
        print("usage: worker-execution-pipeline.py <skill_dir> <worker> <tier> <project_dir> <prompt_file>",
              file=sys.stderr)
        sys.exit(2)
    sys.exit(run_pipeline(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]))
