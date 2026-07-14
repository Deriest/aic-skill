#!/usr/bin/env python3
"""IMP-024-C: detect verification-oriented / trivial tasks from context.json."""
import json
import re
import sys
from pathlib import Path

KEYWORDS = re.compile(
    r"\b(verify|check|inspect|confirm|smoke|readme|documentation|config|"
    r"section exists|exists and|if missing|read-only|minimal task|"
    r"one sentence|no code changes|validation-only)\b",
    re.I,
)
TITLE_HINTS = re.compile(r"(^Smoke-|^OAT\b|smoke|verify|config-check|readme)", re.I)


def classify(context: dict) -> dict:
    title = (context.get("title") or "").strip()
    desc = (context.get("description") or "").strip()
    blob = f"{title}\n{desc}"
    hits = KEYWORDS.findall(blob)
    title_hit = bool(TITLE_HINTS.search(title))
    trivial = bool(hits) or title_hit
    return {
        "trivial": trivial,
        "reasons": list(dict.fromkeys(hits))[:8],
        "titleHint": title_hit,
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"trivial": False}))
        return
    p = Path(sys.argv[1])
    if not p.is_file():
        print(json.dumps({"trivial": False}))
        return
    ctx = json.loads(p.read_text(encoding="utf-8"))
    print(json.dumps(classify(ctx)))


if __name__ == "__main__":
    main()