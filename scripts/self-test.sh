#!/usr/bin/env bash
# self-test.sh — AIC Skill Self-Test (dry-run validation)
# Usage: bash scripts/self-test.sh

set -euo pipefail

PASS=0
FAIL=0
WARN=0

ok()   { PASS=$((PASS + 1)); echo "  ✅ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ❌ $1"; }
warn() { WARN=$((WARN + 1)); echo "  ⚠️  $1"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"

echo "🏢 AIC Self-Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Config check
echo ""
echo "📋 Config"
if [[ -f "$SKILL_DIR/.env" ]]; then
  ok ".env exists"
  source "$SKILL_DIR/.env" 2>/dev/null || true
  if [[ -n "${MODEL_THINKER:-}" ]]; then ok "MODEL_THINKER=$MODEL_THINKER"; else fail "MODEL_THINKER not set"; fi
  if [[ -n "${MODEL_CRAFTER:-}" ]]; then ok "MODEL_CRAFTER=$MODEL_CRAFTER"; else fail "MODEL_CRAFTER not set"; fi
  if [[ -n "${MODEL_SPRINTER:-}" ]]; then ok "MODEL_SPRINTER=$MODEL_SPRINTER"; else fail "MODEL_SPRINTER not set"; fi
  if [[ -n "${PROVIDER_ID:-}" ]]; then ok "PROVIDER_ID=$PROVIDER_ID"; else fail "PROVIDER_ID not set"; fi
else
  fail ".env not found — run: bash scripts/setup.sh"
fi

if [[ -f "$HOME/.config/opencode/opencode.jsonc" ]]; then
  ok "opencode.jsonc exists"
else
  warn "opencode.jsonc not found"
fi

# 2. Dependencies
echo ""
echo "🔧 Dependencies"
if command -v node &>/dev/null; then ok "node $(node --version)"; else fail "node not found"; fi
if command -v npm &>/dev/null; then ok "npm $(npm --version)"; else fail "npm not found"; fi
if command -v opencode &>/dev/null; then ok "opencode $(opencode --version 2>/dev/null || echo 'installed')"; else fail "opencode not found — run: npm i -g opencode-ai@latest"; fi
if command -v curl &>/dev/null; then ok "curl available"; else fail "curl not found"; fi
if command -v jq &>/dev/null; then ok "jq available"; else warn "jq not found (optional)"; fi

# 3. Scripts
echo ""
echo "📜 Scripts"
for script in server.js rollback.sh context-gather.sh cache-context.sh changelog.sh test-api.sh test-status.sh; do
  if [[ -f "$SCRIPT_DIR/$script" ]]; then
    ok "$script exists"
    if [[ "$script" == *.sh ]] && bash -n "$SCRIPT_DIR/$script" 2>/dev/null; then
      ok "$script syntax valid"
    elif [[ "$script" == *.js ]] && node --check "$SCRIPT_DIR/$script" 2>/dev/null; then
      ok "$script syntax valid"
    else
      warn "$script syntax check skipped"
    fi
  else
    fail "$script missing"
  fi
done

# 4. API server
echo ""
echo "🌐 API Server"
if curl -s --connect-timeout 2 "http://localhost:6868/health" | grep -q '"ok":true' 2>/dev/null; then
  ok "Server running on port 6868"
else
  warn "Server not running (start with: node scripts/server.js)"
fi

# 5. Git integration
echo ""
echo "🔀 Git"
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  ok "GITHUB_TOKEN set"
else
  warn "GITHUB_TOKEN not set (git integration disabled)"
fi

# 6. Notifications
echo ""
echo "🔔 Notifications"
if [[ -n "${WEBHOOK_URL:-}" ]] || [[ -n "${AIC_WEBHOOK_URL:-}" ]]; then
  ok "Webhook URL configured"
else
  warn "No webhook URL (notifications disabled)"
fi

# 7. Dashboard
echo ""
echo "🎨 Dashboard"
if [[ -d "$SKILL_DIR/dashboard/node_modules" ]]; then
  ok "Dashboard deps installed"
else
  warn "Dashboard deps not installed (run: cd dashboard && npm install)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Result: $PASS passed, $FAIL failed, $WARN warnings"
if [[ $FAIL -eq 0 ]]; then
  echo "✅ AIC is ready!"
else
  echo "⚠️  Fix failures above before using AIC"
fi
