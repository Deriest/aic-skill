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
echo -e "${BLUE}[1/5] Checking dependencies...${NC}"

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
echo -e "${BLUE}[2/5] Installing OpenCode...${NC}"

if command -v opencode &> /dev/null; then
    CURRENT_VERSION=$(opencode --version 2>/dev/null || echo "unknown")
    echo -e "${YELLOW}OpenCode already installed (${CURRENT_VERSION})${NC}"
    read -p "Update to latest? (y/N): " UPDATE_OC
    if [[ "$UPDATE_OC" == "y" || "$UPDATE_OC" == "Y" ]]; then
        # Windows: kill if locked
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
# Step 3: Configure Provider
# ============================================
echo -e "${BLUE}[3/5] Configure your AI provider...${NC}"
echo ""
echo "Choose your provider:"
echo ""
echo -e "  ${CYAN}1)${NC} OpenAI-compatible proxy (self-hosted, custom API)"
echo -e "  ${CYAN}2)${NC} OpenRouter (multi-provider, requires API key)"
echo -e "  ${CYAN}3)${NC} Anthropic (Claude, requires API key)"
echo -e "  ${CYAN}4)${NC} OpenAI (GPT, requires API key)"
echo -e "  ${CYAN}5)${NC} OpenCode Free Models (no auth needed)"
echo -e "  ${CYAN}6)${NC} Skip — I'll configure manually"
echo ""
read -p "Choose [1-6]: " PROVIDER_CHOICE

configure_proxy() {
    echo ""
    echo -e "${CYAN}--- OpenAI-Compatible Proxy Setup ---${NC}"
    echo ""

    # Step 1: Get connection info
    read -p "Base URL (e.g. http://192.168.2.11:20128/v1): " BASE_URL
    # Strip trailing slash
    BASE_URL="${BASE_URL%/}"
    read -p "API Key: " API_KEY
    read -p "Provider ID (used in opencode config, e.g. tvd) [tvd]: " PROVIDER_ID
    PROVIDER_ID="${PROVIDER_ID:-tvd}"

    # Step 2: Fetch available models
    echo ""
    echo -e "${BLUE}Fetching available models from ${BASE_URL}/models ...${NC}"

    MODELS_RESPONSE=$(curl -sf "${BASE_URL}/models" \
        -H "Authorization: Bearer ${API_KEY}" \
        -H "Content-Type: application/json" 2>/dev/null) || {
        echo -e "${RED}Failed to fetch models from ${BASE_URL}/models${NC}"
        echo -e "${YELLOW}Check your URL and API key. Falling back to manual entry.${NC}"
        echo ""
        read -p "Select Thinker model (PM, Architect, complex reasoning): " MODEL_HIGH_ID
        read -p "Select Crafter model (Engineers, Governor, standard coding): " MODEL_MID_ID
        read -p "Select Sprinter model (QA, fast/lightweight): " MODEL_LOW_ID
        generate_config
        return
    }

    # Parse model IDs into array
    MODEL_COUNT=$(echo "$MODELS_RESPONSE" | jq -r '.data | length' 2>/dev/null) || {
        echo -e "${RED}Unexpected response format. Falling back to manual entry.${NC}"
        read -p "Select Thinker model (PM, Architect, complex reasoning): " MODEL_HIGH_ID
        read -p "Select Crafter model (Engineers, Governor, standard coding): " MODEL_MID_ID
        read -p "Select Sprinter model (QA, fast/lightweight): " MODEL_LOW_ID
        generate_config
        return
    }

    if [[ "$MODEL_COUNT" -eq 0 ]]; then
        echo -e "${RED}No models returned. Falling back to manual entry.${NC}"
        read -p "Select Thinker model (PM, Architect, complex reasoning): " MODEL_HIGH_ID
        read -p "Select Crafter model (Engineers, Governor, standard coding): " MODEL_MID_ID
        read -p "Select Sprinter model (QA, fast/lightweight): " MODEL_LOW_ID
        generate_config
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

    # Step 3: Let user pick 3 models with sensible defaults
    # Default: first = complex, second = standard, third = fast
    local DEFAULT_HIGH=1
    local DEFAULT_MID=2
    local DEFAULT_LOW=3
    [[ $MODEL_COUNT -lt 2 ]] && DEFAULT_MID=1
    [[ $MODEL_COUNT -lt 3 ]] && DEFAULT_LOW=$DEFAULT_MID

    read -p "Select Thinker model (PM, Architect, complex reasoning) [${DEFAULT_HIGH}]: " PICK_HIGH
    PICK_HIGH="${PICK_HIGH:-$DEFAULT_HIGH}"
    read -p "Select Crafter model (Engineers, Governor, standard coding) [${DEFAULT_MID}]: " PICK_MID
    PICK_MID="${PICK_MID:-$DEFAULT_MID}"
    read -p "Select Sprinter model (QA, fast/lightweight) [${DEFAULT_LOW}]: " PICK_LOW
    PICK_LOW="${PICK_LOW:-$DEFAULT_LOW}"

    # Resolve picks (support both number and raw model ID)
    MODEL_HIGH_ID=$(resolve_model_pick "$PICK_HIGH" "${MODEL_IDS[@]}")
    MODEL_MID_ID=$(resolve_model_pick "$PICK_MID" "${MODEL_IDS[@]}")
    MODEL_LOW_ID=$(resolve_model_pick "$PICK_LOW" "${MODEL_IDS[@]}")

    echo ""
    echo -e "${GREEN}Selected:${NC}"
    echo "  Thinker:   $MODEL_HIGH_ID"
    echo "  Crafter:  $MODEL_MID_ID"
    echo "  Sprinter: $MODEL_LOW_ID"

    generate_config
}

resolve_model_pick() {
    local pick="$1"
    shift
    local models=("$@")
    # If pick is a number, use as index
    if [[ "$pick" =~ ^[0-9]+$ ]] && [[ "$pick" -ge 1 ]] && [[ "$pick" -le ${#models[@]} ]]; then
        echo "${models[$((pick - 1))]}"
    else
        # Treat as raw model ID
        echo "$pick"
    fi
}

generate_config() {
    # Generate opencode.jsonc
    mkdir -p ~/.config/opencode
    cat > ~/.config/opencode/opencode.jsonc << EOCONFIG
{
  "\$schema": "https://opencode.ai/config.json",
  "provider": {
    "${PROVIDER_ID}": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "${PROVIDER_ID} Proxy",
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

    echo -e "${GREEN}✓ OpenCode config written to ~/.config/opencode/opencode.jsonc${NC}"

    # Generate .env for Dispatcher use
    cat > "${SKILL_DIR}/.env" << EOENV
# AI Engineering Company — Auto-generated by setup.sh
PROVIDER_ID=${PROVIDER_ID}
MODEL_THINKER=Thinker
MODEL_CRAFTER=Crafter
MODEL_SPRINTER=Sprinter
EOENV

    echo -e "${GREEN}✓ .env written to ${SKILL_DIR}/.env${NC}"
}

configure_openrouter() {
    echo ""
    echo -e "${CYAN}--- OpenRouter Setup ---${NC}"
    read -p "API Key: " API_KEY

    mkdir -p ~/.config/opencode
    cat > ~/.config/opencode/opencode.jsonc << EOCONFIG
{
  "\$schema": "https://opencode.ai/config.json",
  "provider": {
    "openrouter": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "OpenRouter",
      "options": {
        "baseURL": "https://openrouter.ai/api/v1",
        "apiKey": "${API_KEY}"
      },
      "models": {
        "Thinker": { "name": "anthropic/claude-opus-4" },
        "Crafter": { "name": "anthropic/claude-sonnet-4" },
        "Sprinter": { "name": "anthropic/claude-haiku-3.5" }
      }
    }
  }
}
EOCONFIG

    cat > "${SKILL_DIR}/.env" << EOENV
# AI Engineering Company — Auto-generated by setup.sh
PROVIDER_ID=openrouter
MODEL_THINKER=Thinker
MODEL_CRAFTER=Crafter
MODEL_SPRINTER=Sprinter
EOENV

    PROVIDER_PREFIX="openrouter"
    MODEL_HIGH="Thinker"
    MODEL_MID="Crafter"
    MODEL_LOW="Sprinter"
}

configure_anthropic() {
    echo ""
    echo -e "${CYAN}--- Anthropic Setup ---${NC}"
    read -p "API Key: " API_KEY

    mkdir -p ~/.config/opencode
    cat > ~/.config/opencode/opencode.jsonc << EOCONFIG
{
  "\$schema": "https://opencode.ai/config.json",
  "provider": {
    "anthropic": {
      "npm": "@ai-sdk/anthropic",
      "name": "Anthropic",
      "options": {
        "apiKey": "${API_KEY}"
      },
      "models": {
        "Thinker": { "name": "claude-opus-4-20250514" },
        "Crafter": { "name": "claude-sonnet-4-20250514" },
        "Sprinter": { "name": "claude-haiku-3.5-20250514" }
      }
    }
  }
}
EOCONFIG

    cat > "${SKILL_DIR}/.env" << EOENV
# AI Engineering Company — Auto-generated by setup.sh
PROVIDER_ID=anthropic
MODEL_THINKER=Thinker
MODEL_CRAFTER=Crafter
MODEL_SPRINTER=Sprinter
EOENV

    PROVIDER_PREFIX="anthropic"
    MODEL_HIGH="Thinker"
    MODEL_MID="Crafter"
    MODEL_LOW="Sprinter"
}

configure_openai() {
    echo ""
    echo -e "${CYAN}--- OpenAI Setup ---${NC}"
    read -p "API Key: " API_KEY

    mkdir -p ~/.config/opencode
    cat > ~/.config/opencode/opencode.jsonc << EOCONFIG
{
  "\$schema": "https://opencode.ai/config.json",
  "provider": {
    "openai": {
      "npm": "@ai-sdk/openai",
      "name": "OpenAI",
      "options": {
        "apiKey": "${API_KEY}"
      },
      "models": {
        "Thinker": { "name": "gpt-4o" },
        "Crafter": { "name": "gpt-4o-mini" },
        "Sprinter": { "name": "gpt-4o-mini" }
      }
    }
  }
}
EOCONFIG

    cat > "${SKILL_DIR}/.env" << EOENV
# AI Engineering Company — Auto-generated by setup.sh
PROVIDER_ID=openai
MODEL_THINKER=Thinker
MODEL_CRAFTER=Crafter
MODEL_SPRINTER=Sprinter
EOENV

    PROVIDER_PREFIX="openai"
    MODEL_HIGH="Thinker"
    MODEL_MID="Crafter"
    MODEL_LOW="Sprinter"
}

configure_free() {
    echo ""
    echo -e "${CYAN}--- Free Models (No Auth) ---${NC}"
    echo "Using opencode/deepseek-v4-flash-free for all workers."
    echo "Note: Free models may have rate limits."
    echo ""

    PROVIDER_PREFIX="opencode"
    MODEL_HIGH="deepseek-v4-flash-free"
    MODEL_MID="deepseek-v4-flash-free"
    MODEL_LOW="deepseek-v4-flash-free"
}

configure_skip() {
    echo ""
    echo -e "${YELLOW}Skipping provider config. You'll need to configure manually.${NC}"
    echo "See references/opencode-custom-provider.md for guidance."
    echo ""

    PROVIDER_PREFIX="YOUR_PROVIDER"
    MODEL_HIGH="YOUR_OPUS_MODEL"
    MODEL_MID="YOUR_SONNET_MODEL"
    MODEL_LOW="YOUR_HAIKU_MODEL"
}

# Initialize vars for proxy path (which uses generate_config instead)
PROVIDER_PREFIX=""
MODEL_HIGH="Thinker"
MODEL_MID="Crafter"
MODEL_LOW="Sprinter"

case $PROVIDER_CHOICE in
    1) configure_proxy ;;
    2) configure_openrouter ;;
    3) configure_anthropic ;;
    4) configure_openai ;;
    5) configure_free ;;
    6) configure_skip ;;
    *) echo -e "${RED}Invalid choice${NC}"; exit 1 ;;
esac

# For non-proxy providers, PROVIDER_PREFIX/MODEL_* are set in their functions
# For proxy, generate_config already handled everything
if [[ -n "$PROVIDER_PREFIX" ]]; then
    echo -e "${GREEN}✓ Provider configured: ${PROVIDER_PREFIX}${NC}"
else
    echo -e "${GREEN}✓ Provider configured (see opencode.jsonc)${NC}"
fi

# ============================================
# Step 4: Install Skill
# ============================================
echo -e "${BLUE}[4/5] Installing AIC skill...${NC}"

# Detect OS for repo clone
REPO_URL="https://github.com/Deriest/aic-skill.git"
TEMP_DIR=$(mktemp -d)

echo "Cloning skill from GitHub..."
git clone --depth 1 "$REPO_URL" "$TEMP_DIR/aic-skill" 2>/dev/null || {
    echo -e "${YELLOW}Git clone failed. Downloading as zip...${NC}"
    curl -sL "https://github.com/Deriest/aic-skill/archive/refs/heads/main.zip" -o "$TEMP_DIR/aic-skill.zip"
    unzip -q "$TEMP_DIR/aic-skill.zip" -d "$TEMP_DIR"
    mv "$TEMP_DIR/aic-skill-main" "$TEMP_DIR/aic-skill"
}

# Copy to skill directory
mkdir -p "$SKILL_DIR"
cp -r "$TEMP_DIR/aic-skill/SKILL.md" "$SKILL_DIR/"
cp -r "$TEMP_DIR/aic-skill/references" "$SKILL_DIR/"
cp -r "$TEMP_DIR/aic-skill/templates" "$SKILL_DIR/"

# Cleanup
rm -rf "$TEMP_DIR"

echo -e "${GREEN}✓ Skill installed to ${SKILL_DIR}${NC}"

# ============================================
# Step 5: Update Models in SKILL.md
# ============================================
echo -e "${BLUE}[5/5] Updating model assignments...${NC}"

if [[ -n "$PROVIDER_PREFIX" && "$PROVIDER_PREFIX" != "YOUR_PROVIDER" ]]; then
    # Replace model references in SKILL.md
    sed -i "s|{provider}/Thinker|${PROVIDER_PREFIX}/${MODEL_HIGH}|g" "$SKILL_DIR/SKILL.md"
    sed -i "s|{provider}/Crafter|${PROVIDER_PREFIX}/${MODEL_MID}|g" "$SKILL_DIR/SKILL.md"
    sed -i "s|{provider}/Sprinter|${PROVIDER_PREFIX}/${MODEL_LOW}|g" "$SKILL_DIR/SKILL.md"
    echo -e "${GREEN}✓ Models updated in SKILL.md${NC}"
elif [[ "$PROVIDER_CHOICE" == "1" ]]; then
    echo -e "${GREEN}✓ Proxy config complete — SKILL.md uses model aliases${NC}"
else
    echo -e "${YELLOW}⚠ Manual model update needed in SKILL.md${NC}"
fi

# ============================================
# Verify
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
echo -e "${GREEN}Usage:${NC}"
echo "  opencode run --model ${PROVIDER_ID:-YOUR_PROVIDER}/Thinker  # complex tasks"
echo "  opencode run --model ${PROVIDER_ID:-YOUR_PROVIDER}/Crafter  # standard tasks"
echo "  opencode run --model ${PROVIDER_ID:-YOUR_PROVIDER}/Sprinter # fast tasks"
echo ""
echo -e "${GREEN}Or in Hermes:${NC}"
echo "  1. Start Hermes:  hermes"
echo "  2. Load skill:    /aic"
echo "  3. Give task:     build a REST API for user auth"
echo ""
echo -e "${CYAN}Or preload the skill:${NC}"
echo "  hermes -s aic"
echo ""
echo -e "${YELLOW}Tip: Enable yolo mode for no permission prompts:${NC}"
echo "  /yolo"
echo ""
