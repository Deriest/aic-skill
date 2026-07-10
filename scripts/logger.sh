#!/usr/bin/env bash
# logger.sh — Structured Logger for AIC
# Usage: logger.sh <action> [args]
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$SKILL_DIR/.aic/logs"
LOG_FILE="$LOG_DIR/app.log"
mkdir -p "$LOG_DIR"
ACTION="${1:?Usage: logger.sh <log|query|tail|rotate|export>}"

case "$ACTION" in
  log)
    LEVEL="${2:?Missing level}"; CAT="${3:?Missing category}"; MSG="${4:?Missing message}"; DATA="${5:-{}}"
    export LOG_FILE LEVEL CAT MSG DATA
    python3 << 'PYEOF'
import json, os, time
lf = os.environ["LOG_FILE"]
level = os.environ.get("LEVEL","INFO")
cat = os.environ.get("CAT","app")
msg = os.environ.get("MSG","")
data = os.environ.get("DATA","{}")
entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "level": level, "cat": cat, "msg": msg}
try: entry["data"] = json.loads(data)
except: entry["data"] = {}
with open(lf, "a") as f: f.write(json.dumps(entry) + "\n")
print("%s [%s] %s: %s" % (entry["ts"], level, cat, msg))
PYEOF
    ;;
  query)
    LEVEL="${2:-}"; CAT="${3:-}"; LIMIT="${4:-50}"
    export LOG_FILE LEVEL CAT LIMIT
    python3 << 'PYEOF'
import json, os
lf = os.environ["LOG_FILE"]
level = os.environ.get("LEVEL","")
cat = os.environ.get("CAT","")
limit = int(os.environ.get("LIMIT","50"))
try:
    with open(lf) as f: lines = f.readlines()
except: lines = []
entries = []
for l in lines:
    try: entries.append(json.loads(l.strip()))
    except: pass
if level: entries = [e for e in entries if e.get("level") == level]
if cat: entries = [e for e in entries if e.get("cat") == cat]
for e in entries[-limit:]:
    print("%s [%s] %s: %s" % (e.get("ts","?"), e.get("level","?"), e.get("cat","?"), e.get("msg","")))
PYEOF
    ;;
  tail)
    LINES="${2:-20}"
    tail -n "$LINES" "$LOG_FILE" 2>/dev/null || echo "No logs"
    ;;
  rotate)
    if [[ -f "$LOG_FILE" ]]; then
      mv "$LOG_FILE" "$LOG_FILE.$(date +%Y%m%d-%H%M%S)"
      echo "Rotated"
    else
      echo "No log to rotate"
    fi
    ;;
  export)
    cat "$LOG_FILE" 2>/dev/null || echo ""
    ;;
  *) echo "Unknown: $ACTION"; exit 1 ;;
esac
