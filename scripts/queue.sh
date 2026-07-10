#!/usr/bin/env bash
# queue.sh — Task Queue for AIC
# Usage: queue.sh <action> [args]
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
QUEUE_FILE="$SKILL_DIR/.aic/queue.json"
DEAD_FILE="$SKILL_DIR/.aic/queue-dead.json"
mkdir -p "$SKILL_DIR/.aic"
ACTION="${1:?Usage: queue.sh <enqueue|dequeue|status|list|retry>}"

case "$ACTION" in
  enqueue)
    TASK_ID="${2:?Missing task_id}"; PRIORITY="${3:-2}"; WORKER="${4:-auto}"
    python3 << 'PYEOF'
import json, sys, os, time
qf = os.environ.get("QUEUE_FILE", ".aic/queue.json")
task_id, priority, worker = sys.argv[1], int(sys.argv[2]), sys.argv[3]
q = []
try:
    with open(qf) as f: q = json.load(f)
except: pass
q.append({"task_id": task_id, "priority": priority, "worker": worker, "status": "queued", "created": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "retries": 0})
q.sort(key=lambda x: x.get("priority", 2))
with open(qf, "w") as f: json.dump(q, f, indent=2)
print("Enqueued: %s (priority=%d)" % (task_id, priority))
PYEOF
    ;;
  dequeue)
    python3 << 'PYEOF'
import json, os
qf = os.environ.get("QUEUE_FILE", ".aic/queue.json")
q = []
try:
    with open(qf) as f: q = json.load(f)
except: pass
pending = [x for x in q if x.get("status") == "queued"]
if not pending:
    print("EMPTY")
else:
    task = pending[0]
    task["status"] = "running"
    with open(qf, "w") as f: json.dump(q, f, indent=2)
    print("%s %s %s" % (task["task_id"], task.get("worker","auto"), task.get("priority",2)))
PYEOF
    ;;
  status)
    python3 << 'PYEOF'
import json, os
qf = os.environ.get("QUEUE_FILE", ".aic/queue.json")
try: q = json.load(open(qf))
except: q = []
queued = sum(1 for x in q if x.get("status") == "queued")
running = sum(1 for x in q if x.get("status") == "running")
print("Queue: %d total, %d queued, %d running" % (len(q), queued, running))
PYEOF
    ;;
  list)
    python3 << 'PYEOF'
import json, os, sys
qf = os.environ.get("QUEUE_FILE", ".aic/queue.json")
try: q = json.load(open(qf))
except: q = []
for t in q:
    print("%s [%s] priority=%d worker=%s" % (t.get("task_id","?"), t.get("status","?"), t.get("priority",2), t.get("worker","?")))
PYEOF
    ;;
  retry)
    TASK_ID="${2:?Missing task_id}"
    python3 << 'PYEOF'
import json, sys, os
qf = os.environ.get("QUEUE_FILE", ".aic/queue.json")
df = os.environ.get("DEAD_FILE", ".aic/queue-dead.json")
task_id = sys.argv[1]
try: q = json.load(open(qf))
except: q = []
for t in q:
    if t.get("task_id") == task_id:
        if t.get("retries", 0) >= 3:
            t["status"] = "dead"
            dead = []
            try:
                with open(df) as f: dead = json.load(f)
            except: pass
            dead.append(t)
            with open(df, "w") as f: json.dump(dead, f, indent=2)
            print("Dead: %s (max retries)" % task_id)
        else:
            t["retries"] = t.get("retries", 0) + 1
            t["status"] = "queued"
            print("Retry: %s (attempt %d)" % (task_id, t["retries"]))
        break
with open(qf, "w") as f: json.dump(q, f, indent=2)
PYEOF
    ;;
  *) echo "Unknown: $ACTION"; exit 1 ;;
esac
