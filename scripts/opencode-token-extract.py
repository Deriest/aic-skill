#!/usr/bin/env python3
"""Extract token usage from OpenCode --format json NDJSON (one pass per file)."""
import json
import re
import sys
from pathlib import Path

_FIELDS = ("input", "output", "reasoning", "cacheRead", "cacheWrite")
_ALIASES = {"cache_read": "cacheRead", "cache_write": "cacheWrite"}


def _deep_collect(obj, acc):
    if isinstance(obj, dict):
        for k, v in obj.items():
            kk = _ALIASES.get(k, k)
            if kk in _FIELDS and isinstance(v, (int, float)):
                acc[kk] = int(v)
            else:
                _deep_collect(v, acc)
    elif isinstance(obj, list):
        for x in obj:
            _deep_collect(x, acc)


def extract_from_file(path):
    """Last usage snapshot in file (parity with spawn-worker grep tail -1)."""
    p = Path(path)
    if not p.is_file():
        return {k: 0 for k in _FIELDS}
    acc = {k: 0 for k in _FIELDS}
    for line in p.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            _deep_collect(json.loads(line), acc)
        except json.JSONDecodeError:
            for key in _FIELDS:
                m = re.search(rf'"{key}"\s*:\s*(\d+)', line)
                if m:
                    acc[key] = int(m.group(1))
            for alias, canon in _ALIASES.items():
                m = re.search(rf'"{alias}"\s*:\s*(\d+)', line)
                if m:
                    acc[canon] = int(m.group(1))
    return acc


def merge_files(paths):
    """Sum per-file last snapshots across one worker execution (generate + repairs)."""
    total = {k: 0 for k in _FIELDS}
    for path in paths:
        snap = extract_from_file(path)
        for k in _FIELDS:
            total[k] += snap[k]
    total["total"] = total["input"] + total["output"] + total["reasoning"]
    return total


if __name__ == "__main__":
    paths = sys.argv[1:]
    print(json.dumps(merge_files(paths)))