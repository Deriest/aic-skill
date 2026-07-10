#!/usr/bin/env bash
# audit-platform.sh — Enterprise Audit Platform for AIC
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
AUDIT_LOG="$SKILL_DIR/.aic/audit.log"
ACTION="${1:?Usage: audit-platform.sh <action> [args]}"
ARG="${2:-}"; ARG2="${3:-}"; ARG3="${4:-}"

case "$ACTION" in
  query)
    FILTER="${ARG:-}"; VALUE="${ARG2:-}"; LIMIT="${ARG3:-50}"
    python3 - "$AUDIT_LOG" "$FILTER" "$VALUE" "$LIMIT" << 'PYEOF'
import json, sys, re
logfile, filt, val, limit = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
try:
    lines = open(logfile).readlines()
except FileNotFoundError:
    print("No audit log found"); sys.exit(0)
count = 0
for line in lines:
    line = line.strip()
    if not line: continue
    if filt and val and val not in line: continue
    print(f"  {line}")
    count += 1
    if count >= limit: break
print(f"  ({count} entries)")
PYEOF
    ;;
  export)
    FORMAT="${ARG:-json}"; OUTFILE="${ARG2:-/tmp/audit-export}"
    python3 - "$AUDIT_LOG" "$FORMAT" "$OUTFILE" << 'PYEOF'
import json, sys, re
logfile, fmt, outfile = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    lines = [l.strip() for l in open(logfile) if l.strip()]
except FileNotFoundError:
    print("No audit log found"); sys.exit(0)
if fmt == "csv":
    with open(outfile + ".csv", "w") as f:
        f.write("timestamp,type,details\n")
        for l in lines:
            parts = l.split(" ", 2)
            f.write(",".join(parts) + "\n")
    print(f"Exported: {outfile}.csv ({len(lines)} entries)")
else:
    with open(outfile + ".json", "w") as f:
        json.dump(lines, f, indent=2)
    print(f"Exported: {outfile}.json ({len(lines)} entries)")
PYEOF
    ;;
  history)
    RESOURCE="${ARG:?Missing resource}"; LIMIT="${ARG2:-20}"
    grep -i "$RESOURCE" "$AUDIT_LOG" 2>/dev/null | tail -"$LIMIT" || echo "No history for $RESOURCE"
    ;;
  stats)
    python3 - "$AUDIT_LOG" << 'PYEOF'
import sys, collections
try:
    lines = open(sys.argv[1]).readlines()
except FileNotFoundError:
    print("No audit log"); sys.exit(0)
types = collections.Counter()
for l in lines:
    parts = l.strip().split(" ", 2)
    if len(parts) >= 2:
        types[parts[1] if len(parts[1]) < 40 else "OTHER"] += 1
print(f"Total entries: {len(lines)}")
for t, c in types.most_common(10):
    print(f"  {t}: {c}")
PYEOF
    ;;
  *)
    echo "ERROR: Unknown action '$ACTION'" >&2; exit 1
    ;;
esac
