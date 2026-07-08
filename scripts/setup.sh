#!/bin/bash
# ============================================
# AI Engineering Company (AIC) — Auto Setup
# ============================================
# Usage: bash setup.sh
# Or:    curl -fsSL https://raw.githubusercontent.com/Deriest/aic-skill/main/scripts/setup.sh | bash
# ============================================

set -e

# Colors (Windows git-bash compatible — no -e needed with printf)
if [[ "${TERM:-dumb}" != "dumb" ]] && [[ -t 1 ]]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; CYAN=''; NC=''
fi

# Skill directory — cross-platform
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) SKILL_DIR="$(cygpath -u "${USERPROFILE:-$HOME}")/.hermes/skills/workflows/aic" ;;
  *)                     SKILL_DIR="${HOME}/.hermes/skills/workflows/aic" ;;
esac

# Helper: set or update env var in .env file
set_env() {
  local key="$1" value="$2" file="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

echo -e "${CYAN}"
echo "============================================"
echo "  AI Engineering Company — Setup Script"
echo "  10-Worker Orchestration for Hermes Agent"
echo "============================================"
echo -e "${NC}"

# ============================================
# Step 1: Check Dependencies
# ============================================
echo -e "${BLUE}[1/6] Checking dependencies...${NC}"

# Check Hermes Agent
if command -v hermes &> /dev/null; then
  echo -e "${GREEN}  Hermes Agent: $(hermes --version 2>/dev/null || echo 'installed')${NC}"
else
  echo -e "${RED}  Hermes Agent not found.${NC}"
  echo -e "${RED}  Install from: https://hermes-agent.nousresearch.com${NC}"
  exit 1
fi

# Check Node.js >= 18
if ! command -v node &> /dev/null; then
  echo -e "${RED}  Node.js not found. Install >= 18 from https://nodejs.org/${NC}"
  exit 1
fi
NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_VERSION" -lt 18 ]]; then
  echo -e "${RED}  Node.js >= 18 required, found v${NODE_VERSION}.${NC}"
  exit 1
fi
echo -e "${GREEN}  Node.js: $(node --version)${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
  echo -e "${RED}  npm not found.${NC}"
  exit 1
fi
echo -e "${GREEN}  npm: $(npm --version)${NC}"

# Check jq (needed for model fetching)
if ! command -v jq &> /dev/null; then
  echo -e "${YELLOW}  jq not found. Installing...${NC}"
  if command -v apt-get &> /dev/null; then
    sudo apt-get install -y jq 2>/dev/null || true
  elif command -v brew &> /dev/null; then
    brew install jq 2>/dev/null || true
  elif command -v choco &> /dev/null; then
    choco install jq -y 2>/dev/null || true
  elif command -v winget &> /dev/null; then
    winget install jqlang.jq 2>/dev/null || true
  fi
  if ! command -v jq &> /dev/null; then
    echo -e "${RED}  jq required for model auto-detection.${NC}"
    exit 1
  fi
fi
echo -e "${GREEN}  jq: $(jq --version)${NC}"

# Check git
if ! command -v git &> /dev/null; then
  echo -e "${RED}  git not found.${NC}"
  exit 1
fi
echo -e "${GREEN}  git: $(git --version)${NC}"

echo ""

# ============================================
# Step 2: Install/Update OpenCode
# ============================================
echo -e "${BLUE}[2/6] Installing OpenCode...${NC}"

if command -v opencode &> /dev/null; then
  CURRENT_VERSION=$(opencode --version 2>/dev/null || echo "unknown")
  echo -e "${YELLOW}  OpenCode already installed (${CURRENT_VERSION})${NC}"
  read -p "  Update to latest? (y/N): " UPDATE_OC
  if [[ "$UPDATE_OC" == "y" || "$UPDATE_OC" == "Y" ]]; then
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
      if command -v taskkill >/dev/null 2>&1; then taskkill /F /IM opencode.exe 2>/dev/null || true; else pkill opencode 2>/dev/null || true; fi
    fi
    npm install -g opencode-ai@latest
    echo -e "${GREEN}  OpenCode updated${NC}"
  else
    echo -e "${GREEN}  Keeping current version${NC}"
  fi
else
  echo "  Installing OpenCode..."
  npm install -g opencode-ai@latest
  echo -e "${GREEN}  OpenCode installed${NC}"
fi

echo ""

# ============================================
# Step 3: Configure Provider
# ============================================
echo -e "${BLUE}[3/6] Configure your AI provider...${NC}"
echo ""
echo "  Works with any OpenAI-compatible API:"
echo "  OpenRouter, Anthropic, OpenAI, local proxies, etc."
echo ""
echo -e "  ${CYAN}1)${NC} Connect to API (auto-detect models)"
echo -e "  ${CYAN}2)${NC} Free models (no auth needed)"
echo -e "  ${CYAN}3)${NC} Skip — I'll configure manually"
echo ""
read -p "  Choose [1-3]: " PROVIDER_CHOICE

# Initialize vars
PROVIDER_ID=""
BASE_URL=""
API_KEY=""
MODEL_HIGH_ID=""
MODEL_MID_ID=""
MODEL_LOW_ID=""

configure_api() {
  echo ""
  echo -e "${CYAN}  --- API Setup ---${NC}"
  echo ""

  read -p "  Base URL (e.g. https://openrouter.ai/api/v1): " BASE_URL
  BASE_URL="${BASE_URL%/}"
  read -p "  API Key: " API_KEY
  read -p "  Provider ID (short name, e.g. openrouter) [myprovider]: " PROVIDER_ID
  PROVIDER_ID="${PROVIDER_ID:-myprovider}"

  echo ""
  echo -e "${BLUE}  Fetching models from ${BASE_URL}/models ...${NC}"

  MODELS_RESPONSE=$(curl -sf "${BASE_URL}/models" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" 2>/dev/null) || {
    echo -e "${RED}  Failed to fetch models. Entering manual mode...${NC}"
    manual_model_entry
    return
  }

  MODEL_COUNT=$(echo "$MODELS_RESPONSE" | jq -r '.data | length' 2>/dev/null) || {
    echo -e "${RED}  Unexpected response format. Entering manual mode...${NC}"
    manual_model_entry
    return
  }

  if [[ "$MODEL_COUNT" -eq 0 ]]; then
    echo -e "${RED}  No models returned. Entering manual mode...${NC}"
    manual_model_entry
    return
  fi

  echo -e "${GREEN}  Found ${MODEL_COUNT} models:${NC}"
  echo ""

  declare -a MODEL_IDS=()
  for i in $(seq 0 $((MODEL_COUNT - 1))); do
    MID=$(echo "$MODELS_RESPONSE" | jq -r ".data[$i].id")
    MODEL_IDS+=("$MID")
    printf "    ${CYAN}%2d)${NC} %s\n" "$((i + 1))" "$MID"
  done

  echo ""

  local DEFAULT_HIGH=1
  local DEFAULT_MID=2
  local DEFAULT_LOW=3
  [[ $MODEL_COUNT -lt 2 ]] && DEFAULT_MID=1
  [[ $MODEL_COUNT -lt 3 ]] && DEFAULT_LOW=$DEFAULT_MID

  read -p "  Thinker model (PM, Architect, Governor) [${DEFAULT_HIGH}]: " PICK_HIGH
  PICK_HIGH="${PICK_HIGH:-$DEFAULT_HIGH}"
  read -p "  Crafter model (Engineers, small files) [${DEFAULT_MID}]: " PICK_MID
  PICK_MID="${PICK_MID:-$DEFAULT_MID}"
  read -p "  Sprinter model (QA) [${DEFAULT_LOW}]: " PICK_LOW
  PICK_LOW="${PICK_LOW:-$DEFAULT_LOW}"

  MODEL_HIGH_ID=$(resolve_model_pick "$PICK_HIGH" "${MODEL_IDS[@]}")
  MODEL_MID_ID=$(resolve_model_pick "$PICK_MID" "${MODEL_IDS[@]}")
  MODEL_LOW_ID=$(resolve_model_pick "$PICK_LOW" "${MODEL_IDS[@]}")

  echo ""
  echo -e "${GREEN}  Selected:${NC}"
  echo "    Thinker:  $MODEL_HIGH_ID"
  echo "    Crafter:  $MODEL_MID_ID"
  echo "    Sprinter: $MODEL_LOW_ID"

  generate_config
}

manual_model_entry() {
  echo ""
  read -p "  Thinker model ID (e.g. claude-opus-4): " MODEL_HIGH_ID
  read -p "  Crafter model ID (e.g. claude-sonnet-4): " MODEL_MID_ID
  read -p "  Sprinter model ID (e.g. claude-haiku-3.5): " MODEL_LOW_ID
  generate_config
}

resolve_model_pick() {
  local pick="$1"
  shift
  local models=("$@")
  if [[ "$pick" =~ ^[0-9]+$ ]] && [[ "$pick" -ge 1 ]] && [[ "$pick" -le ${#models[@]} ]]; then
    echo "${models[$((pick - 1))]}"
  else
    echo "$pick"
  fi
}

generate_config() {
  mkdir -p ~/.config/opencode

  # Auto-detect context limits
  echo "  Detecting context windows..."
  DETECT_SCRIPT="$(cd "$(dirname "$0")" && pwd)/detect-context.sh"
  if [[ -x "$DETECT_SCRIPT" ]]; then
    export CUSTOM_API_URL="${BASE_URL}"
    export CUSTOM_API_KEY="${API_KEY}"
    LIMITS=$("$DETECT_SCRIPT" "$PROVIDER_ID" "$MODEL_HIGH_ID" "$MODEL_MID_ID" "$MODEL_LOW_ID" 2>/dev/null | tail -1)
    TC=$(echo "$LIMITS" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['thinker']['context'])" 2>/dev/null || echo "800000")
    TO=$(echo "$LIMITS" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['thinker']['output'])" 2>/dev/null || echo "64000")
    CC=$(echo "$LIMITS" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['crafter']['context'])" 2>/dev/null || echo "512000")
    CO=$(echo "$LIMITS" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['crafter']['output'])" 2>/dev/null || echo "32000")
    SC=$(echo "$LIMITS" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['sprinter']['context'])" 2>/dev/null || echo "256000")
    SO=$(echo "$LIMITS" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['sprinter']['output'])" 2>/dev/null || echo "16000")
  else
    TC=800000; TO=64000; CC=512000; CO=32000; SC=256000; SO=16000
  fi

  echo "    Thinker limits:  context=${TC} output=${TO}"
  echo "    Crafter limits:  context=${CC} output=${CO}"
  echo "    Sprinter limits: context=${SC} output=${SO}"

  cat > ~/.config/opencode/opencode.jsonc << EOCONFIG
{
  "\\\$schema": "https://opencode.ai/config.json",
  "provider": {
    "${PROVIDER_ID}": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "${PROVIDER_ID}",
      "options": {
        "baseURL": "${BASE_URL}",
        "apiKey": "${API_KEY}"
      },
      "models": {
        "Thinker": { "name": "${MODEL_HIGH_ID}", "limit": { "context": ${TC}, "output": ${TO} } },
        "Crafter": { "name": "${MODEL_MID_ID}", "limit": { "context": ${CC}, "output": ${CO} } },
        "Sprinter": { "name": "${MODEL_LOW_ID}", "limit": { "context": ${SC}, "output": ${SO} } }
      }
    }
  }
}
EOCONFIG

  echo -e "${GREEN}  opencode.jsonc -> ~/.config/opencode/opencode.jsonc${NC}"

  # Write .env
  TCKB=$((TC / 1024))
  CCKB=$((CC / 1024))
  SCKB=$((SC / 1024))

  cat > "${SKILL_DIR}/.env" << EOENV
# AI Engineering Company — Auto-generated by setup.sh
PROVIDER_ID=${PROVIDER_ID}
MODEL_THINKER=Thinker
MODEL_CRAFTER=Crafter
MODEL_SPRINTER=Sprinter
AIC_CTX_THINKER_KB=${TCKB}
AIC_CTX_CRAFTER_KB=${CCKB}
AIC_CTX_SPRINTER_KB=${SCKB}
EOENV

  echo -e "${GREEN}  .env -> ${SKILL_DIR}/.env${NC}"
}

configure_free() {
  echo ""
  echo -e "${CYAN}  --- Free Models (No Auth) ---${NC}"
  echo "  Using opencode/deepseek-v4-flash-free for all workers."

  PROVIDER_ID="opencode"
  MODEL_HIGH_ID="deepseek-v4-flash-free"
  MODEL_MID_ID="deepseek-v4-flash-free"
  MODEL_LOW_ID="deepseek-v4-flash-free"
  BASE_URL="https://api.opencode.ai/v1"
  API_KEY="free"

  generate_config
}

configure_skip() {
  echo ""
  echo -e "${YELLOW}  Skipping provider config.${NC}"
  echo "  See references/opencode-custom-provider.md for guidance."
}

case $PROVIDER_CHOICE in
  1) configure_api ;;
  2) configure_free ;;
  3) configure_skip ;;
  *) echo -e "${RED}  Invalid choice${NC}"; exit 1 ;;
esac

echo ""

# ============================================
# Step 4: Install Skill
# ============================================
echo -e "${BLUE}[4/6] Installing AIC skill...${NC}"

REPO_URL="https://github.com/Deriest/aic-skill.git"
TEMP_DIR=$(mktemp -d)

echo "  Cloning from GitHub..."
git clone --depth 1 "$REPO_URL" "$TEMP_DIR/aic-skill" 2>/dev/null || {
  echo -e "${YELLOW}  Git clone failed. Downloading as zip...${NC}"
  curl -sL "https://github.com/Deriest/aic-skill/archive/refs/heads/main.zip" -o "$TEMP_DIR/aic-skill.zip"
  unzip -q "$TEMP_DIR/aic-skill.zip" -d "$TEMP_DIR"
  mv "$TEMP_DIR/aic-skill-main" "$TEMP_DIR/aic-skill"
}

mkdir -p "$SKILL_DIR"
cp -r "$TEMP_DIR/aic-skill/SKILL.md" "$SKILL_DIR/"
cp -r "$TEMP_DIR/aic-skill/references" "$SKILL_DIR/"
cp -r "$TEMP_DIR/aic-skill/templates" "$SKILL_DIR/"
cp -r "$TEMP_DIR/aic-skill/scripts" "$SKILL_DIR/"
cp -r "$TEMP_DIR/aic-skill/dashboard" "$SKILL_DIR/" 2>/dev/null || true

rm -rf "$TEMP_DIR"

# Install dashboard deps
if [[ -f "$SKILL_DIR/dashboard/package.json" ]]; then
  echo "  Installing dashboard dependencies..."
  cd "$SKILL_DIR/dashboard" && npm install --silent 2>/dev/null && cd - > /dev/null
fi

echo -e "${GREEN}  Skill installed -> ${SKILL_DIR}${NC}"

echo ""

# ============================================
# Step 5: Setup Project Folder
# ============================================
echo -e "${BLUE}[5/6] Setup project folder...${NC}"
echo ""
echo "  Set your workspace path. All your projects live here."
echo "  Each subfolder = a project that AIC can work on."
echo ""

# Detect default: use /home/<user> or $HOME
DEFAULT_PROJECT="$HOME"
echo -e "  ${CYAN}Default:${NC} ${DEFAULT_PROJECT}"
echo ""

read -p "  Workspace path [${DEFAULT_PROJECT}]: " PROJECT_PATH
PROJECT_PATH="${PROJECT_PATH:-$DEFAULT_PROJECT}"

# Resolve to absolute path
PROJECT_PATH="$(cd "$PROJECT_PATH" 2>/dev/null && pwd)" || {
  echo -e "${RED}  Path not found: ${PROJECT_PATH}${NC}"
  echo -e "${YELLOW}  Using ${DEFAULT_PROJECT}${NC}"
  PROJECT_PATH="$DEFAULT_PROJECT"
}

# Count subfolders
SUB_COUNT=$(find "$PROJECT_PATH" -maxdepth 1 -mindepth 1 -type d ! -name '.*' 2>/dev/null | wc -l)

echo ""
echo -e "${GREEN}  Workspace: ${PROJECT_PATH}${NC}"
echo -e "    Folders: ${SUB_COUNT} found"

# List a few
find "$PROJECT_PATH" -maxdepth 1 -mindepth 1 -type d ! -name '.*' 2>/dev/null | head -5 | while read d; do
  echo "      $(basename "$d")"
done
if [[ "$SUB_COUNT" -gt 5 ]]; then
  echo "      ... and $((SUB_COUNT - 5)) more"
fi

# Write workspace path to .env
set_env "AIC_PROJECT_DIR" "$PROJECT_PATH" "$SKILL_DIR/.env"

echo ""

# ============================================
# Step 6: Set GitHub Token
# ============================================
echo -e "${BLUE}[6/6] GitHub token...${NC}"
echo ""

# Check env first
EXISTING_TOKEN="${GITHUB_TOKEN:-}"

if [[ -n "$EXISTING_TOKEN" ]]; then
  echo -e "${GREEN}  Found GITHUB_TOKEN in environment${NC}"
  MASKED="${EXISTING_TOKEN:0:4}...${EXISTING_TOKEN: -4}"
  echo -e "    Token: ${MASKED}"
  read -p "  Use this token? (Y/n): " USE_EXISTING
  if [[ ! "$USE_EXISTING" =~ ^[Nn] ]]; then
    set_env "GITHUB_TOKEN" "$EXISTING_TOKEN" "$SKILL_DIR/.env"
    echo -e "${GREEN}  GitHub token saved${NC}"
  else
    read -p "  Enter new GitHub token (ghp_...): " NEW_TOKEN
    if [[ -n "$NEW_TOKEN" ]]; then
      set_env "GITHUB_TOKEN" "$NEW_TOKEN" "$SKILL_DIR/.env"
      echo -e "${GREEN}  GitHub token saved${NC}"
    else
      echo -e "${YELLOW}  Skipped (local only)${NC}"
      set_env "GITHUB_TOKEN" "" "$SKILL_DIR/.env"
    fi
  fi
else
  echo -e "${YELLOW}  No GITHUB_TOKEN found in environment${NC}"
  read -p "  Enter GitHub token (ghp_..., empty to skip): " NEW_TOKEN
  if [[ -n "$NEW_TOKEN" ]]; then
    set_env "GITHUB_TOKEN" "$NEW_TOKEN" "$SKILL_DIR/.env"
    echo -e "${GREEN}  GitHub token saved${NC}"
  else
    echo -e "${YELLOW}  Skipped (local only)${NC}"
    set_env "GITHUB_TOKEN" "" "$SKILL_DIR/.env"
  fi
fi

# ============================================
# Done
# ============================================
echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}  Setup Complete!${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""
echo -e "${GREEN}Installed:${NC}"
echo "  Hermes:      $(hermes --version 2>/dev/null || echo 'installed')"
echo "  OpenCode:    $(opencode --version 2>/dev/null || echo 'installed')"
echo "  Skill:       ${SKILL_DIR}"
echo "  Project:     ${PROJECT_PATH}"
echo ""
echo -e "${GREEN}Config:${NC}"
echo "  opencode.jsonc:  ~/.config/opencode/opencode.jsonc"
echo "  .env:            ${SKILL_DIR}/.env"
echo ""
echo -e "${GREEN}Workers:${NC}"
echo "  Thinker  = ${MODEL_HIGH_ID:-not set}  (PM, Architect, Governor)"
echo "  Crafter  = ${MODEL_MID_ID:-not set}  (Engineers)"
echo "  Sprinter = ${MODEL_LOW_ID:-not set}  (QA)"
echo ""
echo -e "${GREEN}Start:${NC}"
echo "  hermes              # then type: /aic"
echo "  hermes -s aic       # preload skill"
echo ""
echo -e "${YELLOW}Tip: /yolo to skip permission prompts${NC}"
echo ""
