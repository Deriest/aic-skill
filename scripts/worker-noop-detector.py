#!/usr/bin/env python3
"""IMP-024-C: detect unsupported no-op claims without evidence."""
import re
import sys
from pathlib import Path

NOOP_PHRASES = re.compile(
    r"(no changes|already exists|no files modified|nothing to do|"
    r"no modification|verified without|already contains|file exists and)",
    re.I,
)
EVIDENCE = re.compile(
    r"(\.[a-zA-Z0-9_/-]+\.(md|sh|py|js|tsx?|json|yaml|yml|css|html)|"
    r"line[s]?\s*\d+|L\d+|\bpath:\s*|\bscripts/|\bdashboard/)",
    re.I,
)


def unsupported_noop(text: str) -> bool:
    if not text or len(text.strip()) < 80:
        return False
    if not NOOP_PHRASES.search(text):
        return False
    # If strong evidence present, allow VERIFIED narrative
    if EVIDENCE.search(text):
        return False
    return True


def main():
    if len(sys.argv) < 2:
        sys.exit(2)
    text = Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
    sys.exit(0 if unsupported_noop(text) else 1)


if __name__ == "__main__":
    main()