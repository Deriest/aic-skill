#!/usr/bin/env python3
"""IMP-024-C: prompt blocks for trivial verification tasks."""
import json
import sys
from pathlib import Path

GUIDANCE = """
TRIVIAL / VERIFICATION TASK MODE (mandatory)

This task is verification-oriented. You MUST:
- Perform real inspection (read/grep/list files in the project directory).
- Include concrete evidence: file paths and line numbers where applicable.
- State explicitly VERIFIED (unchanged) or CHANGED (with diff summary).
- NEVER claim "already exists", "no changes", or "verified" without path:line evidence.

Forbidden unsupported claims:
- "The file exists" without citing path and what you read.
- Empty ## Verification or ## Result sections.
""".strip()

IMPL_TEMPLATE = """
TRIVIAL IMPLEMENTATION TEMPLATE (mandatory — keep all contract headings)

Populate every required section with substantive content.

If no source files were modified:
- ## Files Modified: none (or list only report paths if applicable)
- ## Verification: completed — cite commands or reads and path:line evidence
- ## Result: VERIFIED — one paragraph summarizing what was checked and outcome

If files were changed:
- ## Files Modified: list each path
- ## Verification: how you confirmed the change
- ## Result: CHANGED — brief summary

Do not leave sections empty. Do not use planning diary prose.
""".strip()


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "guidance"
    if cmd == "guidance":
        print(GUIDANCE)
        return
    if cmd == "implementation":
        print(IMPL_TEMPLATE)
        return
    if cmd == "noop-regen":
        print(
            "REGENERATION REQUIRED: Your prior artifact claimed no work or verification "
            "without path:line evidence. Re-run inspection. Cite real files. "
            "Use Files Modified: none + Result: VERIFIED only if evidence is in ## Verification."
        )
        return
    if cmd == "classify-and-guidance":
        ctx_path = sys.argv[2] if len(sys.argv) > 2 else ""
        if not ctx_path or not Path(ctx_path).is_file():
            return
        import subprocess

        r = subprocess.run(
            [sys.executable, str(Path(__file__).resolve().parent / "trivial-task-classifier.py"), ctx_path],
            capture_output=True,
            text=True,
        )
        if r.returncode == 0 and r.stdout.strip():
            if json.loads(r.stdout.strip()).get("trivial"):
                print(GUIDANCE)
        return
    print("usage: trivial-task-prompt.py guidance|implementation|noop-regen|classify-and-guidance [context.json]", file=sys.stderr)
    sys.exit(2)


if __name__ == "__main__":
    main()