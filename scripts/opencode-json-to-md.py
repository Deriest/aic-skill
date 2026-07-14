#!/usr/bin/env python3
"""Extract assistant text from opencode --format json NDJSON; metrics stay on raw file."""
import json
import sys

def _extract_text_from_obj(o):
    """Best-effort text extraction from opencode NDJSON object."""
    # Primary: {type:"text", part:{text:"..."}}
    # Robust: any object where part.text exists, regardless of outer type
    part = o.get("part")
    if isinstance(part, dict):
        t = part.get("text")
        if isinstance(t, str) and t.strip():
            return t
        # Some versions put content as string
        c = part.get("content")
        if isinstance(c, str) and c.strip():
            return c
        # delta streaming
        d = part.get("delta")
        if isinstance(d, str) and d.strip():
            return d
    # Top-level text fallbacks
    if isinstance(o.get("text"), str) and o["text"].strip():
        return o["text"]
    return None

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
        # Prefer explicit type:text but accept any with part.text
        if o.get("type") == "text":
            t = _extract_text_from_obj(o)
            if t:
                texts.append(t)
            continue
        # Robust: if text exists anywhere, collect it (covers variant schemas)
        t = _extract_text_from_obj(o)
        if t:
            texts.append(t)

    out = "\n\n".join(texts).strip()
    if not out:
        sys.stderr.write("no assistant text in session; do not submit raw JSON\n")
        sys.exit(1)

    # Markdown sanity: must not be raw NDJSON leak
    stripped = out.lstrip()
    if stripped.startswith('{"type":') or stripped.startswith('{"id":') or '"type":"step_start"' in stripped[:500] or '"type":"tool_use"' in stripped[:500]:
        # Output still looks like NDJSON, not markdown
        sys.stderr.write("extracted output looks like NDJSON, not markdown; failing\n")
        sys.exit(1)

    # Basic markdown sanity: at least one heading or 20+ chars
    if len(out) < 20:
        sys.stderr.write("extracted output too short to be valid markdown\n")
        sys.exit(1)

    sys.stdout.write(out)


if __name__ == "__main__":
    main()
