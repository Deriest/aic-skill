#!/usr/bin/env bash
set -euo pipefail
# FIX-006: shared Worker Invocation Completion Contract (all roles/phases)
cat << 'COMPLETION'
Worker Invocation Completion Contract (mandatory):
- The task is not complete until a final assistant message exists.
- The final assistant message must contain the complete markdown report (the deliverable).
- The markdown report is the deliverable; tool execution alone does not satisfy this contract.
- Do not end the session after tool execution only.
- After producing the full report in assistant message text, stop.
- No further tool calls after the report is written.
COMPLETION