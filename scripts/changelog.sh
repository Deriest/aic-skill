#!/usr/bin/env bash
# changelog.sh — Auto-generate changelog entry after task completion
# Usage: changelog.sh <task_title> <task_type> <duration> <files_changed>

set -euo pipefail

CHANGELOG="${HOME}/.hermes/skills/workflows/aic/CHANGELOG.md"
title="${1:-Unknown task}"
type="${2:-unknown}"
duration="${3:-}"
files="${4:-0}"
date="$(date '+%Y-%m-%d %H:%M')"

# Create changelog if doesn't exist
if [[ ! -f "$CHANGELOG" ]]; then
  cat > "$CHANGELOG" << 'EOF'
# AIC Changelog

Auto-generated changelog of completed tasks.

EOF
fi

# Type emoji
case "$type" in
  feature)   emoji="✨" ;;
  bug)       emoji="🐛" ;;
  security)  emoji="🔒" ;;
  infra)     emoji="🚀" ;;
  research)  emoji="🔍" ;;
  optimize)  emoji="⚡" ;;
  maintain)  emoji="🔧" ;;
  *)         emoji="📋" ;;
esac

# Append entry
cat >> "$CHANGELOG" << EOF
## $emoji $title
- **Date:** $date
- **Type:** $type
- **Duration:** ${duration:-unknown}
- **Files changed:** $files

EOF

echo "✅ Changelog entry added: $title"
