#!/usr/bin/env python3
"""FIX-019: Post-generation gate for Planning workers after PM repair respawn."""
import json
import re
import sys
from pathlib import Path


def load_ctx(ctx_path: Path) -> dict:
    if not ctx_path.is_file():
        return {}
    return json.loads(ctx_path.read_text(encoding="utf-8"))


def check(worker: str, text: str, ctx: dict) -> tuple[bool, str]:
    tid = (ctx.get("taskId") or "").strip()
    title = (ctx.get("title") or "").strip()
    desc = (ctx.get("description") or "").strip()
    w = worker.lower()
    reasons = []

    if tid and tid not in text:
        reasons.append(f"missing task id {tid}")

    if w == "research":
        if "# Planning Research" not in text:
            reasons.append("missing H1 '# Planning Research'")
        if "Task Title:" not in text or title not in text:
            reasons.append("missing Task Authority title")
        if "Task Description:" not in text or (desc and desc[:20] not in text and desc not in text):
            if desc and desc not in text:
                reasons.append("missing Task Description in authority block")

    if w in ("architect", "pm"):
        if "## Task Authority" not in text and "Task Title:" not in text:
            reasons.append("missing Task Authority block")
        if title and title not in text:
            reasons.append("missing title in artifact")

    if w == "pm" and tid:
        # stale TASK-YYYYMMDD-NNN that is not current
        for m in re.findall(r"TASK-\d{8}-\d{3}", text):
            if m != tid:
                reasons.append(f"stale task reference {m}")
                break

    if reasons:
        return False, "; ".join(reasons)
    return True, "ok"


def main():
    if len(sys.argv) < 5:
        print("usage: planning-post-gen-gate.py check <worker> <artifact.md> <context.json>", file=sys.stderr)
        sys.exit(2)
    _, mode, worker, art_path, ctx_path = sys.argv[:5]
    if mode != "check":
        sys.exit(2)
    text = Path(art_path).read_text(encoding="utf-8", errors="replace")
    ctx = load_ctx(Path(ctx_path))
    ok, msg = check(worker, text, ctx)
    if ok:
        print("PASS")
        sys.exit(0)
    print(f"FAIL: {msg}")
    sys.exit(1)


if __name__ == "__main__":
    main()