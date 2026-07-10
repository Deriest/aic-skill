#!/usr/bin/env bash
# metrics.sh — Runtime Metrics for AIC
# Usage: metrics.sh <action> [args]
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
METRICS_FILE="$SKILL_DIR/.aic/metrics.json"
mkdir -p "$SKILL_DIR/.aic"
ACTION="${1:?Usage: metrics.sh <record|query|summary|export|prune>}"

case "$ACTION" in
  record)
    WORKER="${2:-unknown}"; TIER="${3:-unknown}"; MODEL="${4:-unknown}"
    INPUT="${5:-0}"; OUTPUT="${6:-0}"; DURATION="${7:-0}"
    python3 << 'PYEOF'
import json, os, sys, time
mf = os.environ.get("METRICS_FILE", ".aic/metrics.json")
os.makedirs(os.path.dirname(mf), exist_ok=True)
m = []
try:
    with open(mf) as f: m = json.load(f)
except: pass
m.append({"id": "metric-%d-%s" % (time.time()*1000, os.urandom(3).hex()), "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "worker": sys.argv[1], "tier": sys.argv[2], "model": sys.argv[3], "tokens": {"input": int(sys.argv[4]), "output": int(sys.argv[5])}, "durationSec": float(sys.argv[6])})
with open(mf, "w") as f: json.dump(m, f, indent=2)
print("Recorded: %s %s" % (sys.argv[1], sys.argv[2]))
PYEOF
    ;;
  query)
    FROM="${2:-}"; TO="${3:-}"; TIER="${4:-}"
    python3 << 'PYEOF'
import json, os, sys
mf = os.environ.get("METRICS_FILE", ".aic/metrics.json")
try: m = json.load(open(mf))
except: m = []
fr, to, tier = sys.argv[1], sys.argv[2], sys.argv[3]
if fr: m = [x for x in m if x.get("timestamp","") >= fr]
if to: m = [x for x in m if x.get("timestamp","") <= to]
if tier: m = [x for x in m if x.get("tier") == tier]
print("Metrics: %d entries" % len(m))
for x in m[-10:]:
    print("  %s worker=%s tier=%s in=%d out=%d dur=%ss" % (x["timestamp"][:19], x.get("worker","?"), x.get("tier","?"), x.get("tokens",{}).get("input",0), x.get("tokens",{}).get("output",0), x.get("durationSec",0)))
PYEOF
    ;;
  summary)
    python3 << 'PYEOF'
import json, os
mf = os.environ.get("METRICS_FILE", ".aic/metrics.json")
try: m = json.load(open(mf))
except: m = []
total_in = sum(x.get("tokens",{}).get("input",0) for x in m)
total_out = sum(x.get("tokens",{}).get("output",0) for x in m)
workers = set(x.get("worker","unknown") for x in m)
tiers = {}
for x in m:
    t = x.get("tier","unknown")
    tiers[t] = tiers.get(t, 0) + 1
print("Total requests: %d" % len(m))
print("Total tokens: %d in / %d out" % (total_in, total_out))
print("Workers: %s" % ", ".join(sorted(workers)))
for t, c in sorted(tiers.items()):
    print("  Tier %s: %d requests" % (t, c))
PYEOF
    ;;
  export)
    FORMAT="${2:-json}"
    if [[ "$FORMAT" == "csv" ]]; then
      python3 << 'PYEOF'
import json, os, sys
mf = os.environ.get("METRICS_FILE", ".aic/metrics.json")
try: m = json.load(open(mf))
except: m = []
print("id,timestamp,worker,tier,model,input,output,duration")
for x in m:
    print("%s,%s,%s,%s,%s,%d,%d,%s" % (x.get("id",""), x.get("timestamp",""), x.get("worker",""), x.get("tier",""), x.get("model",""), x.get("tokens",{}).get("input",0), x.get("tokens",{}).get("output",0), x.get("durationSec",0)))
PYEOF
    else
      cat "$METRICS_FILE" 2>/dev/null || echo "[]"
    fi
    ;;
  prune)
    DAYS="${2:-30}"
    python3 << 'PYEOF'
import json, os, sys, datetime
mf = os.environ.get("METRICS_FILE", ".aic/metrics.json")
try: m = json.load(open(mf))
except: m = []
cutoff = (datetime.datetime.utcnow() - datetime.timedelta(days=int(sys.argv[1]))).strftime("%Y-%m-%dT%H:%M:%SZ")
before = len(m)
m = [x for x in m if x.get("timestamp","") >= cutoff]
with open(mf, "w") as f: json.dump(m, f, indent=2)
print("Pruned %d entries (kept %d)" % (before - len(m), len(m)))
PYEOF
    ;;
  *) echo "Unknown: $ACTION"; exit 1 ;;
esac
