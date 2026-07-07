#!/bin/bash
# ============================================
# 🏢 AI Engineering Company (AIC) — Auto Setup
# ============================================
# Usage: bash setup.sh
# Or:    curl -fsSL https://raw.githubusercontent.com/Deriest/aic-skill/main/scripts/setup.sh | bash
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Skill directory
SKILL_DIR="${HOME}/.hermes/skills/workflows/aic"

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════╗"
echo "║  🏢 AI Engineering Company — Setup Script   ║"
echo "║  10-Worker Orchestration for Hermes Agent    ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# ============================================
# Step 1: Check Dependencies
# ============================================
echo -e "${BLUE}[1/4] Checking dependencies...${NC}"

# Check Node.js >= 18
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js not found. Please install Node.js >= 18 from https://nodejs.org/${NC}"
    exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_VERSION" -lt 18 ]]; then
    echo -e "${RED}Node.js >= 18 required, found v${NODE_VERSION}. Please upgrade from https://nodejs.org/${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm not found. Please install npm.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm $(npm --version)${NC}"

# Check jq (needed for model fetching)
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}jq not found. Installing...${NC}"
    if command -v apt-get &> /dev/null; then
        sudo apt-get install -y jq 2>/dev/null || true
    elif command -v brew &> /dev/null; then
        brew install jq 2>/dev/null || true
    fi
    if ! command -v jq &> /dev/null; then
        echo -e "${RED}jq required for model auto-detection. Install from https://jqlang.github.io/jq/${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✓ jq $(jq --version)${NC}"

# ============================================
# Step 2: Install/Update OpenCode
# ============================================
echo -e "${BLUE}[2/4] Installing OpenCode...${NC}"

if command -v opencode &> /dev/null; then
    CURRENT_VERSION=$(opencode --version 2>/dev/null || echo "unknown")
    echo -e "${YELLOW}OpenCode already installed (${CURRENT_VERSION})${NC}"
    read -p "Update to latest? (y/N): " UPDATE_OC
    if [[ "$UPDATE_OC" == "y" || "$UPDATE_OC" == "Y" ]]; then
        if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
            if command -v taskkill >/dev/null 2>&1; then taskkill /F /IM opencode.exe 2>/dev/null || true; else pkill opencode 2>/dev/null || true; fi
        fi
        npm install -g opencode-ai@latest
        echo -e "${GREEN}✓ OpenCode updated${NC}"
    fi
else
    echo "Installing OpenCode..."
    npm install -g opencode-ai@latest
    echo -e "${GREEN}✓ OpenCode installed${NC}"
fi

# ============================================
# Step 3: Configure Provider + Models
# ============================================
echo -e "${BLUE}[3/4] Configure your AI provider...${NC}"
echo ""
echo "This works with any OpenAI-compatible API:"
echo "  OpenRouter, Anthropic, OpenAI, local proxies, etc."
echo ""
echo -e "  ${CYAN}1)${NC} Connect to API (auto-detect models)"
echo -e "  ${CYAN}2)${NC} Free models (no auth needed)"
echo -e "  ${CYAN}3)${NC} Skip — I'll configure manually"
echo ""
read -p "Choose [1-3]: " PROVIDER_CHOICE

# Initialize vars
PROVIDER_ID=""
BASE_URL=""
API_KEY=""
MODEL_HIGH_ID=""
MODEL_MID_ID=""
MODEL_LOW_ID=""

configure_api() {
    echo ""
    echo -e "${CYAN}--- API Setup ---${NC}"
    echo ""

    # Get connection info
    read -p "Base URL (e.g. https://openrouter.ai/api/v1): " BASE_URL
    BASE_URL="${BASE_URL%/}"
    read -p "API Key: " API_KEY
    read -p "Provider ID (short name for config, e.g. openrouter) [myprovider]: " PROVIDER_ID
    PROVIDER_ID="${PROVIDER_ID:-myprovider}"

    # Fetch available models
    echo ""
    echo -e "${BLUE}Fetching available models from ${BASE_URL}/models ...${NC}"

    MODELS_RESPONSE=$(curl -sf "${BASE_URL}/models" \
        -H "Authorization: Bearer ${API_KEY}" \
        -H "Content-Type: application/json" 2>/dev/null) || {
        echo -e "${RED}Failed to fetch models. Check URL and API key.${NC}"
        echo -e "${YELLOW}Entering manual mode...${NC}"
        manual_model_entry
        return
    }

    MODEL_COUNT=$(echo "$MODELS_RESPONSE" | jq -r '.data | length' 2>/dev/null) || {
        echo -e "${RED}Unexpected response format. Entering manual mode...${NC}"
        manual_model_entry
        return
    }

    if [[ "$MODEL_COUNT" -eq 0 ]]; then
        echo -e "${RED}No models returned. Entering manual mode...${NC}"
        manual_model_entry
        return
    fi

    echo -e "${GREEN}Found ${MODEL_COUNT} models:${NC}"
    echo ""

    # Build indexed arrays
    declare -a MODEL_IDS=()
    for i in $(seq 0 $((MODEL_COUNT - 1))); do
        MID=$(echo "$MODELS_RESPONSE" | jq -r ".data[$i].id")
        MODEL_IDS+=("$MID")
        printf "  ${CYAN}%2d)${NC} %s\n" "$((i + 1))" "$MID"
    done

    echo ""

    # Let user pick 3 models — defaults: first, second, third
    local DEFAULT_HIGH=1
    local DEFAULT_MID=2
    local DEFAULT_LOW=3
    [[ $MODEL_COUNT -lt 2 ]] && DEFAULT_MID=1
    [[ $MODEL_COUNT -lt 3 ]] && DEFAULT_LOW=$DEFAULT_MID

    read -p "Select Thinker model (PM, Architect, complex reasoning) [${DEFAULT_HIGH}]: " PICK_HIGH
    PICK_HIGH="${PICK_HIGH:-$DEFAULT_HIGH}"
    read -p "Select Crafter model (Engineers, standard coding) [${DEFAULT_MID}]: " PICK_MID
    PICK_MID="${PICK_MID:-$DEFAULT_MID}"
    read -p "Select Sprinter model (QA, fast/lightweight) [${DEFAULT_LOW}]: " PICK_LOW
    PICK_LOW="${PICK_LOW:-$DEFAULT_LOW}"

    # Resolve picks (number or raw model ID)
    MODEL_HIGH_ID=$(resolve_model_pick "$PICK_HIGH" "${MODEL_IDS[@]}")
    MODEL_MID_ID=$(resolve_model_pick "$PICK_MID" "${MODEL_IDS[@]}")
    MODEL_LOW_ID=$(resolve_model_pick "$PICK_LOW" "${MODEL_IDS[@]}")

    echo ""
    echo -e "${GREEN}Selected:${NC}"
    echo "  Thinker:  $MODEL_HIGH_ID"
    echo "  Crafter:  $MODEL_MID_ID"
    echo "  Sprinter: $MODEL_LOW_ID"

    generate_config
}

manual_model_entry() {
    echo ""
    read -p "Thinker model ID (e.g. claude-opus-4): " MODEL_HIGH_ID
    read -p "Crafter model ID (e.g. claude-sonnet-4): " MODEL_MID_ID
    read -p "Sprinter model ID (e.g. claude-haiku-3.5): " MODEL_LOW_ID
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
    cat > ~/.config/opencode/opencode.jsonc << EOCONFIG
{
  "\$schema": "https://opencode.ai/config.json",
  "provider": {
    "${PROVIDER_ID}": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "${PROVIDER_ID}",
      "options": {
        "baseURL": "${BASE_URL}",
        "apiKey": "${API_KEY}"
      },
      "models": {
        "Thinker": { "name": "${MODEL_HIGH_ID}" },
        "Crafter": { "name": "${MODEL_MID_ID}" },
        "Sprinter": { "name": "${MODEL_LOW_ID}" }
      }
    }
  }
}
EOCONFIG

    echo -e "${GREEN}✓ OpenCode config → ~/.config/opencode/opencode.jsonc${NC}"

    cat > "${SKILL_DIR}/.env" << EOENV
# AI Engineering Company — Auto-generated by setup.sh
PROVIDER_ID=${PROVIDER_ID}
MODEL_THINKER=Thinker
MODEL_CRAFTER=Crafter
MODEL_SPRINTER=Sprinter
EOENV

    echo -e "${GREEN}✓ .env → ${SKILL_DIR}/.env${NC}"
}

configure_free() {
    echo ""
    echo -e "${CYAN}--- Free Models (No Auth) ---${NC}"
    echo "Using opencode/deepseek-v4-flash-free for all workers."
    echo "Note: Free models may have rate limits."

    PROVIDER_ID="opencode"
    MODEL_HIGH_ID="deepseek-v4-flash-free"
    MODEL_MID_ID="deepseek-v4-flash-free"
    MODEL_LOW_ID="deepseek-v4-flash-free"

    mkdir -p ~/.config/opencode
    cat > ~/.config/opencode/opencode.jsonc << EOCONFIG
{
  "\$schema": "https://opencode.ai/config.json",
  "provider": {
    "opencode": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "OpenCode Free",
      "options": {
        "baseURL": "https://api.opencode.ai/v1",
        "apiKey": "free"
      },
      "models": {
        "Thinker": { "name": "deepseek-v4-flash-free" },
        "Crafter": { "name": "deepseek-v4-flash-free" },
        "Sprinter": { "name": "deepseek-v4-flash-free" }
      }
    }
  }
}
EOCONFIG

    cat > "${SKILL_DIR}/.env" << EOENV
# AI Engineering Company — Auto-generated by setup.sh
PROVIDER_ID=opencode
MODEL_THINKER=Thinker
MODEL_CRAFTER=Crafter
MODEL_SPRINTER=Sprinter
EOENV

    echo -e "${GREEN}✓ Config written${NC}"
}

configure_skip() {
    echo ""
    echo -e "${YELLOW}Skipping provider config. You'll need to configure manually.${NC}"
    echo "See references/opencode-custom-provider.md for guidance."

    PROVIDER_ID="YOUR_PROVIDER"
    MODEL_HIGH_ID="YOUR_THINKER_MODEL"
    MODEL_MID_ID="YOUR_CRAFTER_MODEL"
    MODEL_LOW_ID="YOUR_SPRINTER_MODEL"
}

case $PROVIDER_CHOICE in
    1) configure_api ;;
    2) configure_free ;;
    3) configure_skip ;;
    *) echo -e "${RED}Invalid choice${NC}"; exit 1 ;;
esac

echo -e "${GREEN}✓ Provider configured: ${PROVIDER_ID}${NC}"

# ============================================
# Step 4: Install Skill + Start Dashboard
# ============================================
echo -e "${BLUE}[4/4] Installing AIC skill...${NC}"

REPO_URL="https://github.com/Deriest/aic-skill.git"
TEMP_DIR=$(mktemp -d)

echo "Cloning skill from GitHub..."
git clone --depth 1 "$REPO_URL" "$TEMP_DIR/aic-skill" 2>/dev/null || {
    echo -e "${YELLOW}Git clone failed. Downloading as zip...${NC}"
    curl -sL "https://github.com/Deriest/aic-skill/archive/refs/heads/main.zip" -o "$TEMP_DIR/aic-skill.zip"
    unzip -q "$TEMP_DIR/aic-skill.zip" -d "$TEMP_DIR"
    mv "$TEMP_DIR/aic-skill-main" "$TEMP_DIR/aic-skill"
}

mkdir -p "$SKILL_DIR"
cp -r "$TEMP_DIR/aic-skill/SKILL.md" "$SKILL_DIR/"
cp -r "$TEMP_DIR/aic-skill/references" "$SKILL_DIR/"
cp -r "$TEMP_DIR/aic-skill/templates" "$SKILL_DIR/"
cp -r "$TEMP_DIR/aic-skill/scripts" "$SKILL_DIR/"

rm -rf "$TEMP_DIR"

# Install dashboard deps
if [[ -f "$SKILL_DIR/dashboard/package.json" ]]; then
    echo "Installing dashboard dependencies..."
    cd "$SKILL_DIR/dashboard" && npm install --silent 2>/dev/null && cd - > /dev/null
fi

echo -e "${GREEN}✓ Skill installed to ${SKILL_DIR}${NC}"

# ============================================
# Done
# ============================================
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           ✅ Setup Complete!                 ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Installed:${NC}"
echo "  • OpenCode: $(opencode --version 2>/dev/null || echo 'check manually')"
echo "  • Skill: $SKILL_DIR"
echo ""
echo -e "${GREEN}Config:${NC}"
echo "  • opencode.jsonc: ~/.config/opencode/opencode.jsonc"
echo "  • .env:           ${SKILL_DIR}/.env"
echo ""
echo -e "${GREEN}Workers use tier aliases:${NC}"
echo "  • Thinker  = ${MODEL_HIGH_ID}  (PM, Architect)"
echo "  • Crafter  = ${MODEL_MID_ID}  (Engineers, Governor)"
echo "  • Sprinter = ${MODEL_LOW_ID}  (QA)"
echo ""
echo -e "${GREEN}Start:${NC}"
echo "  hermes              # then type: /aic"
echo "  hermes -s aic       # preload skill"
echo ""
echo -e "${YELLOW}Tip: /yolo to skip permission prompts${NC}"
echo ""
