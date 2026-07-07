#!/usr/bin/env bash
# detect-context.sh — Auto-detect context window per model, output limit config
# Usage: detect-context.sh <provider> <thinker_model> <crafter_model> <sprinter_model>
# Supports: openai, anthropic, openrouter, custom
# Output: limit context/output values for opencode.jsonc

set -euo pipefail

PROVIDER="${1:-openai}"
MODEL_THINKER="${2:-}"
MODEL_CRAFTER="${3:-}"
MODEL_SPRINTER="${4:-}"

# Known context windows (fallback when API doesn't expose it)
declare -A KNOWN_CONTEXT=(
  # OpenAI
  ["gpt-4o"]=128000 ["gpt-4o-mini"]=128000 ["gpt-4.1"]=1048576
  ["gpt-4.1-mini"]=1048576 ["gpt-4.1-nano"]=1048576
  ["o3"]=200000 ["o4-mini"]=200000 ["o3-pro"]=200000
  # Anthropic
  ["claude-opus-4"]=200000 ["claude-sonnet-4"]=200000
  ["claude-3.5-sonnet"]=200000 ["claude-3.5-haiku"]=200000
  ["claude-3-opus"]=200000 ["claude-3-sonnet"]=200000 ["claude-3-haiku"]=200000
  # Google
  ["gemini-2.5-pro"]=1048576 ["gemini-2.5-flash"]=1048576
  ["gemini-2.0-flash"]=1048576 ["gemini-1.5-pro"]=2097152
  ["gemini-1.5-flash"]=1048576
  # xAI
  ["grok-3"]=131072 ["grok-3-mini"]=131072
  # OpenRouter aliases (strip org prefix)
  ["openai/gpt-4o"]=128000 ["anthropic/claude-opus-4"]=200000
  ["google/gemini-2.5-pro"]=1048576 ["deepseek/deepseek-chat-v3"]=65536
)

# Query OpenAI-compatible /models endpoint for context window
query_context_api() {
  local base_url="$1"
  local api_key="$2"
  local model="$3"

  # Try /models/{model_id} first
  local resp
  resp=$(curl -s --connect-timeout 5 \
    -H "Authorization: Bearer $api_key" \
    "${base_url}/models/${model}" 2>/dev/null || echo "{}")

  # Parse context_length from various provider formats
  local ctx
  ctx=$(echo "$resp" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    # OpenAI format
    if 'context_length' in d:
        print(d['context_length'])
    elif 'context_window' in d:
        print(d['context_window'])
    # Nested in model object
    elif 'model' in d and 'context_length' in d['model']:
        print(d['model']['context_length'])
    # Anthropic format
    elif 'max_input_tokens' in d:
        print(d['max_input_tokens'])
    else:
        print(0)
except:
    print(0)
" 2>/dev/null || echo "0")

  echo "$ctx"
}

# Query /models list and find context for specific model
query_context_list() {
  local base_url="$1"
  local api_key="$2"
  local model="$3"

  local resp
  resp=$(curl -s --connect-timeout 5 \
    -H "Authorization: Bearer $api_key" \
    "${base_url}/models" 2>/dev/null || echo '{"data":[]}')

  local ctx
  ctx=$(echo "$resp" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    models = d.get('data', d.get('models', []))
    target = '$model'.lower()
    for m in models:
        mid = (m.get('id', '') or m.get('name', '')).lower()
        if mid == target or mid.endswith('/' + target):
            for key in ['context_length', 'context_window', 'max_input_tokens', 'max_context_length']:
                if key in m and m[key]:
                    print(m[key])
                    sys.exit(0)
    print(0)
except:
    print(0)
" 2>/dev/null || echo "0")

  echo "$ctx"
}

# Get context window for a model
get_context() {
  local model="$1"

  # 1. Check hardcoded table first (instant, no API call)
  local known="${KNOWN_CONTEXT[$model]:-0}"
  if [[ "$known" -gt 0 ]]; then
    echo "$known"
    return
  fi

  # 2. Try API query if we have credentials
  local api_key="${CUSTOM_API_KEY:-${OPENAI_API_KEY:-${ANTHROPIC_API_KEY:-}}}"
  local base_url="${CUSTOM_API_URL:-${OPENAI_BASE_URL:-https://api.openai.com/v1}}"

  # Strip trailing /
  base_url="${base_url%/}"

  if [[ -n "$api_key" ]]; then
    local ctx
    ctx=$(query_context_api "$base_url" "$api_key" "$model")
    if [[ "$ctx" -gt 0 ]]; then
      echo "$ctx"
      return
    fi
    ctx=$(query_context_list "$base_url" "$api_key" "$model")
    if [[ "$ctx" -gt 0 ]]; then
      echo "$ctx"
      return
    fi
  fi

  # 3. Fallback: conservative default
  echo "128000"
}

# Calculate limits proportional to context window
# Thinker: 80% context, 8% output
# Crafter: 60% context, 6% output
# Sprinter: 40% context, 4% output
calc_limits() {
  local ctx="$1"
  local pct_ctx="$2"
  local pct_out="$3"

  local limit_ctx=$(( ctx * pct_ctx / 100 ))
  local limit_out=$(( ctx * pct_out / 100 ))

  # Minimums
  [[ $limit_ctx -lt 4096 ]] && limit_ctx=4096
  [[ $limit_out -lt 2048 ]] && limit_out=2048

  echo "$limit_ctx $limit_out"
}

# Main
echo "Detecting context windows..." >&2

CTHINKER=$(get_context "$MODEL_THINKER")
CCRAFTER=$(get_context "$MODEL_CRAFTER")
CSPRINTER=$(get_context "$MODEL_SPRINTER")

read -r TC TO <<< "$(calc_limits "$CTHINKER" 80 8)"
read -r CC CO <<< "$(calc_limits "$CCRAFTER" 60 6)"
read -r SC SO <<< "$(calc_limits "$CSPRINTER" 40 4)"

echo "" >&2
echo "Detected context windows:" >&2
echo "  Thinker  ($MODEL_THINKER):  ${CTHINKER} → limit: context=${TC}, output=${TO}" >&2
echo "  Crafter  ($MODEL_CRAFTER):  ${CCRAFTER} → limit: context=${CC}, output=${CO}" >&2
echo "  Sprinter ($MODEL_SPRINTER): ${CSPRINTER} → limit: context=${SC}, output=${SO}" >&2

# Output as JSON for setup.sh to consume
printf '{"thinker":{"context":%d,"output":%d,"window":%d},"crafter":{"context":%d,"output":%d,"window":%d},"sprinter":{"context":%d,"output":%d,"window":%d}}' "$TC" "$TO" "$CTHINKER" "$CC" "$CO" "$CCRAFTER" "$SC" "$SO" "$CSPRINTER" 
