#!/usr/bin/env bash
# resource-manager.sh — Resource Management for AIC
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
QUOTAS_FILE="$SKILL_DIR/.aic/quotas.json"
METRICS_DIR="$SKILL_DIR/.aic/metrics"
ACTION="${1:?Usage: resource-manager.sh <action> [args]}"
ARG="${2:-}"; ARG2="${3:-}"

[[ -f "$QUOTAS_FILE" ]] || echo '{}' > "$QUOTAS_FILE"

case "$ACTION" in
  set-quota)
    WS="${ARG:?Missing workspace}"; QUOTA="${ARG2:?Missing max_tokens_per_day}"
    python3 - "$QUOTAS_FILE" "$WS" "$QUOTA" << 'PYEOF'
import json, sys
qf, ws, quota = json.load(open(sys.argv[1])), sys.argv[2], int(sys.argv[3])
qf[ws] = {"max_tokens_per_day": quota, "max_workers": 10, "max_projects": 5}
json.dump(qf, open(sys.argv[1], "w"), indent=2)
print(f"Quota set: {ws} → {quota} tokens/day")
PYEOF
    ;;
  get-usage)
    WS="${ARG:-all}"
    python3 - "$METRICS_DIR" "$WS" << 'PYEOF'
import json, sys, os, glob
md, ws = sys.argv[1], sys.argv[2]
total_in, total_out, count = 0, 0, 0
for f in glob.glob(os.path.join(md, "*.json")):
    try:
        d = json.load(open(f))
        total_in += d.get("input_tokens", 0)
        total_out += d.get("output_tokens", 0)
        count += 1
    except: pass
print(f"Usage ({ws}): {count} metrics, {total_in} input, {total_out} output tokens")
PYEOF
    ;;
  check-limit)
    WS="${ARG:?Missing workspace}"
    python3 - "$QUOTAS_FILE" "$WS" "$METRICS_DIR" << 'PYEOF'
import json, sys, os, glob
qf, ws, md = json.load(open(sys.argv[1])), sys.argv[2], sys.argv[3]
quota = qf.get(ws, {}).get("max_tokens_per_day", float("inf"))
total = 0
for f in glob.glob(os.path.join(md, "*.json")):
    try:
        d = json.load(open(f))
        total += d.get("input_tokens", 0) + d.get("output_tokens", 0)
    except: pass
if total >= quota:
    print(f"EXCEEDED: {ws} used {total}/{quota}"); sys.exit(1)
print(f"OK: {ws} used {total}/{quota}")
PYEOF
    ;;
  list)
    python3 - "$QUOTAS_FILE" << 'PYEOF'
import json, sys
qf = json.load(open(sys.argv[1]))
for ws, q in qf.items():
    print(f"  {ws}: max_tokens={q.get('max_tokens_per_day','∞')} max_workers={q.get('max_workers',10)}")
if not qf:
    print("  No quotas configured")
PYEOF
    ;;
  *)
    echo "ERROR: Unknown action '$ACTION'" >&2; exit 1
    ;;
esac
