#!/usr/bin/env python3
"""
AIC Office — Update Status Script

Usage: python update-status.py [action] [json-data]

Actions:
  task-start     - Start a new task
  phase-start    - Start a phase
  phase-complete - Complete a phase
  agent-status   - Update agent status
  log            - Add log entry
  reset          - Reset status

Examples:
  python update-status.py task-start '{"title":"Build API","type":"feature","id":"TASK-001"}'
  python update-status.py phase-start '{"name":"PM","status":"working"}'
  python update-status.py agent-status '{"agent":"pm","status":"working"}'
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime

STATUS_FILE = Path.home() / ".hermes" / "skills" / "workflows" / "aic" / "status.json"

def load_status():
    if STATUS_FILE.exists():
        try:
            return json.loads(STATUS_FILE.read_text())
        except:
            pass
    return {
        "connected": True,
        "currentTask": None,
        "phases": [],
        "agents": {},
        "logs": [],
        "log": {"message": "Dashboard initialized", "type": "info"}
    }

def save_status(status):
    STATUS_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATUS_FILE.write_text(json.dumps(status, indent=2))

def append_log(status, message, msg_type):
    """Append a log entry to the queue and update backward-compat field."""
    entry = {"message": message, "type": msg_type}
    if "logs" not in status:
        status["logs"] = []
    status["logs"].append(entry)
    status["log"] = entry

def main():
    if len(sys.argv) < 2:
        print("Usage: python update-status.py [task-start|phase-start|phase-complete|agent-status|log|reset] [json-data]")
        sys.exit(1)
    
    action = sys.argv[1]
    data = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    
    status = load_status()
    
    if action == "task-start":
        status["currentTask"] = data
        append_log(status, f"Task started: {data.get('title', 'Unknown')}", "info")
        print(f"Task started: {data.get('title')}")
    
    elif action == "phase-start":
        status["phases"].append(data)
        append_log(status, f"Phase started: {data.get('name', 'Unknown')}", "info")
        print(f"Phase started: {data.get('name')}")
    
    elif action == "phase-complete":
        if status["phases"]:
            status["phases"][-1]["status"] = "complete"
        append_log(status, "Phase completed", "success")
        print("Phase completed")
    
    elif action == "agent-status":
        agent = data.get("agent", "unknown")
        agent_status = data.get("status", "idle")
        engine = data.get("engine")  # "delegate" | "opencode" | None
        agent_entry = {"status": agent_status}
        if engine:
            agent_entry["engine"] = engine
        status["agents"][agent] = agent_entry
        msg_type = "warning" if agent_status == "working" else "success" if agent_status == "complete" else "info"
        engine_str = f" [{engine}]" if engine else ""
        append_log(status, f"Agent {agent}: {agent_status}{engine_str}", msg_type)
        print(f"Agent {agent}: {agent_status}{engine_str}")
    
    elif action == "log":
        append_log(status, data.get("message", "Unknown"), data.get("type", "info"))
        print(f"Log added: {data.get('message')}")
    
    elif action == "task-complete":
        title = status.get("currentTask", {}).get("title", "Unknown") if status.get("currentTask") else "Unknown"
        status["currentTask"] = None
        status["phases"] = []
        status["agents"] = {}
        append_log(status, f"✅ Task completed: {title}", "success")
        print(f"Task completed: {title}")
    
    elif action == "reset":
        status = {
            "connected": True,
            "currentTask": None,
            "phases": [],
            "agents": {},
            "logs": [],
            "log": {"message": "Status reset", "type": "info"}
        }
        print("Status reset")
    
    else:
        print(f"Unknown action: {action}")
        sys.exit(1)
    
    save_status(status)

if __name__ == "__main__":
    main()
