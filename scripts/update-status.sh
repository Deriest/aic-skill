#!/bin/bash
# AIC Office — Update Status Script
# 
# Usage: ./update-status.sh [action] [data]
#
# Actions:
#   task-start    - Start a new task
#   phase-start   - Start a phase
#   phase-complete - Complete a phase
#   agent-status  - Update agent status
#   log           - Add log entry
#
# Examples:
#   ./update-status.sh task-start '{"title":"Build API","type":"feature","id":"TASK-001"}'
#   ./update-status.sh phase-start '{"name":"PM","agents":["pm"]}'
#   ./update-status.sh agent-status '{"agent":"pm","status":"working"}'

STATUS_FILE="${HOME}/.hermes/skills/workflows/aic/status.json"

# Initialize status file if not exists
if [ ! -f "$STATUS_FILE" ]; then
    echo '{"connected":true,"currentTask":null,"phases":[],"agents":{},"log":{"message":"Dashboard initialized","type":"info"}}' > "$STATUS_FILE"
fi

ACTION="$1"
DATA="$2"

case "$ACTION" in
    task-start)
        # Update current task
        jq --argjson data "$DATA" '.currentTask = $data | .log = {message: "Task started: " + $data.title, type: "info"}' "$STATUS_FILE" > "${STATUS_FILE}.tmp" && mv "${STATUS_FILE}.tmp" "$STATUS_FILE"
        echo "Task started"
        ;;
    
    phase-start)
        # Add new phase
        jq --argjson data "$DATA" '.phases += [$data] | .log = {message: "Phase started: " + $data.name, type: "info"}' "$STATUS_FILE" > "${STATUS_FILE}.tmp" && mv "${STATUS_FILE}.tmp" "$STATUS_FILE"
        echo "Phase started"
        ;;
    
    phase-complete)
        # Complete last phase
        jq '.phases[-1].status = "complete" | .log = {message: "Phase completed", type: "success"}' "$STATUS_FILE" > "${STATUS_FILE}.tmp" && mv "${STATUS_FILE}.tmp" "$STATUS_FILE"
        echo "Phase completed"
        ;;
    
    agent-status)
        # Update agent status
        AGENT=$(echo "$DATA" | jq -r '.agent')
        STATUS=$(echo "$DATA" | jq -r '.status')
        jq --arg agent "$AGENT" --arg status "$STATUS" '.agents[$agent] = {status: $status} | .log = {message: "Agent " + $agent + ": " + $status, type: (if $status == "working" then "warning" elif $status == "complete" then "success" else "info" end)}' "$STATUS_FILE" > "${STATUS_FILE}.tmp" && mv "${STATUS_FILE}.tmp" "$STATUS_FILE"
        echo "Agent $AGENT: $STATUS"
        ;;
    
    log)
        # Add log entry
        MSG=$(echo "$DATA" | jq -r '.message // "Unknown"')
        TYPE=$(echo "$DATA" | jq -r '.type // "info"')
        jq --arg msg "$MSG" --arg type "$TYPE" '.log = {message: $msg, type: $type}' "$STATUS_FILE" > "${STATUS_FILE}.tmp" && mv "${STATUS_FILE}.tmp" "$STATUS_FILE"
        echo "Log added"
        ;;
    
    reset)
        # Reset status
        echo '{"connected":true,"currentTask":null,"phases":[],"agents":{},"log":{"message":"Status reset","type":"info"}}' > "$STATUS_FILE"
        echo "Status reset"
        ;;
    
    *)
        echo "Usage: $0 [task-start|phase-start|phase-complete|agent-status|log|reset] [json-data]"
        echo ""
        echo "Examples:"
        echo "  $0 task-start '{\"title\":\"Build API\",\"type\":\"feature\",\"id\":\"TASK-001\"}'"
        echo "  $0 phase-start '{\"name\":\"PM\",\"status\":\"working\"}'"
        echo "  $0 agent-status '{\"agent\":\"pm\",\"status\":\"working\"}'"
        echo "  $0 log '{\"message\":\"Test completed\",\"type\":\"success\"}'"
        echo "  $0 reset"
        exit 1
        ;;
esac
