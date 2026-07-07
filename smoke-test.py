#!/usr/bin/env python3
import sys
import urllib.request
import json
import time

BASE = "http://localhost:6868"

def req(path, method="GET", data=None):
    url = f"{BASE}{path}"
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode("utf-8") if data is not None else None
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        print(f"Error {method} {path}: {e}")
        return None

def test_activity_log_spam():
    print("1. Verifying activity log polling does not spam...")
    req("/api/reset", "POST", {})
    # Poll once to drain any existing logs
    first = req("/api/status")
    # Poll 3 times in a row
    p1 = req("/api/status")
    p2 = req("/api/status")
    p3 = req("/api/status")
    
    c1 = len(p1.get("logs", []))
    c2 = len(p2.get("logs", []))
    c3 = len(p3.get("logs", []))
    
    print(f"   Logs after first poll: {c1}, second: {c2}, third: {c3}")
    return c1 == 0 and c2 == 0 and c3 == 0

def test_dispatcher_avatar():
    print("2. Verifying dispatcher avatar updates to 'working'...")
    req("/api/reset", "POST", {})
    req("/api/agent-status", "POST", {"agent": "dispatcher", "status": "working"})
    status = req("/api/status")
    disp_status = status.get("agents", {}).get("dispatcher", {}).get("status")
    print(f"   Dispatcher agent status in /api/status: {disp_status}")
    return disp_status == "working"

def test_task_start_complete():
    print("3. Verifying task_start creates entry and task_complete clears it...")
    req("/api/reset", "POST", {})
    req("/api/task-start", "POST", {"title": "Smoke Task", "type": "feature", "id": "T-SMOKE"})
    status1 = req("/api/status")
    task1 = status1.get("currentTask")
    print(f"   Task after start: {task1}")
    
    req("/api/task-complete", "POST", {})
    status2 = req("/api/status")
    task2 = status2.get("currentTask")
    print(f"   Task after complete: {task2}")
    
    return task1 is not None and task1.get("id") == "T-SMOKE" and task2 is None

def main():
    # Preflight check to make sure server is up
    health = req("/health")
    if not health or not health.get("ok"):
        print("FAIL: Server not reachable on 6868")
        sys.exit(1)
        
    pass_cnt = 0
    fail_cnt = 0
    
    if test_activity_log_spam():
        print("PASS: Activity log does not spam when no new actions happen")
        pass_cnt += 1
    else:
        print("FAIL: Activity log spams or did not drain")
        fail_cnt += 1
        
    if test_dispatcher_avatar():
        print("PASS: Dispatcher avatar updates to 'working'")
        pass_cnt += 1
    else:
        print("FAIL: Dispatcher avatar status did not update")
        fail_cnt += 1
        
    if test_task_start_complete():
        print("PASS: task_start creates and task_complete clears currentTask")
        pass_cnt += 1
    else:
        print("FAIL: task_start/complete flow did not work")
        fail_cnt += 1
        
    print(f"\nSmoke Test Results: {pass_cnt} passed, {fail_cnt} failed")
    sys.exit(0 if fail_cnt == 0 else 1)

if __name__ == "__main__":
    main()
