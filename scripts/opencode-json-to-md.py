#!/usr/bin/env python3
"""Extract assistant text from opencode --format json NDJSON; metrics stay on raw file."""
import json
import sys

def main():
    path = sys.argv[1]
    raw = open(path, encoding="utf-8", errors="replace").read()
    texts = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            o = json.loads(line)
        except json.JSONDecodeError:
            continue
        if o.get("type") != "text":
            continue
        part = o.get("part") or {}
        t = part.get("text")
        if t:
            texts.append(t)
    out = "\n\n".join(texts).strip()
    if out:
        sys.stdout.write(out)
    else:
        sys.stderr.write("no assistant text in session; do not submit raw JSON\n")
        sys.exit(1)

if __name__ == "__main__":
    main()