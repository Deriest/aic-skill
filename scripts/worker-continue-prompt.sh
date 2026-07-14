#!/usr/bin/env bash
# IMP-007 Strategy B: single shared continue prompt (WECP only)
cat << 'CONTINUE'
Output ONLY the final assistant message containing the complete markdown report required by the task and phase deliverable contract.

Do not call any tools. Do not explore further. Do not add commentary outside the report.

The markdown report is the deliverable. After this message, stop.
CONTINUE