#!/usr/bin/env python3
"""Backward-compat wrapper; prefer validate-phase-artifact.py."""
import subprocess
import sys
from pathlib import Path

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("usage: validate-implementation-artifact.py <worker> <path>", file=sys.stderr)
        sys.exit(2)
    skill = Path(__file__).resolve().parent.parent
    r = subprocess.run(
        [
            sys.executable,
            str(Path(__file__).parent / "validate-phase-artifact.py"),
            str(skill),
            "Implementation",
            sys.argv[1],
            sys.argv[2],
        ],
    )
    sys.exit(r.returncode)