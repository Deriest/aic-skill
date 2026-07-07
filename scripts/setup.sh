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

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js not found. Installing...${NC}"
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
        echo -e "${RED}Please install Node.js from https://nodejs.org/${NC}"
        exit 1
    elif command -v brew &> /dev/null; then
        brew install node
    elif command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y nodejs npm
    elif command -v yum &> /dev/null; then
        sudo yum install -y nodejs npm
    else
        echo -e "${RED}Please install Node.js from https://nodejs.org/${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm not found. Please install npm.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm $(npm --version)${NC}"

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
    read -p "Provider ID (e.g. myproxy): " PROVIDER_ID
    read -p "Display Name (e.g. My Proxy): " PROVIDER_NAME
    read -p "Base URL (e.g. https://my-api.com/v1): " BASE_URL
    read -p "API Key: " API_KEY
    echo ""
    echo "Now define your models."
    echo "These will be used for workers (Opus=complex, Sonnet=standard, Haiku=fast)."
    echo "Enter model IDs as they appear in your API's /v1/models endpoint."
    echo ""
    read -p "Complex reasoning model (e.g. claude-3-opus, gpt-4) [opus]: " MODEL_OPUS
    MODEL_OPUS=${MODEL_OPUS:-opus}
    read -p "Standard model (e.g. claude-3-sonnet, gpt-4-turbo) [sonnet]: " MODEL_SONNET
    MODEL_SONNET=${MODEL_SONNET:-sonnet}
    read -p "Fast/cheap model (e.g. claude-3-haiku, gpt-3.5-turbo) [haiku]: " MODEL_HAIKU
    MODEL_HAIKU=${MODEL_HAIKU:-haiku}

    # Write opencode config
    mkdir -p ~/.config/opencode
    cat > ~/.config/opencode/opencode.jsonc << EOCONFIG
{
  "\$schema": "https://opencode.ai/config.json",
  "provider": {
    "${PROVIDER_ID}": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "${PROVIDER_NAME}",
      "options": {
        "baseURL": "${BASE_URL}",
        "apiKey": "${API_KEY}"
      },
      "models": {
        "${MODEL_OPUS}": { "name": "${MODEL_OPUS}" },
        "${MODEL_SONNET}": { "name": "${MODEL_SONNET}" },
        "${MODEL_HAIKU}": { "name": "${MODEL_HAIKU}" }
      }
    }
  }
}
EOCONFIG

    PROVIDER_PREFIX="${PROVIDER_ID}"
    MODEL_HIGH="${MODEL_OPUS}"
    MODEL_MID="${MODEL_SONNET}"
    MODEL_LOW="${MODEL_HAIKU}"
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
        "anthropic/claude-3-opus": { "name": "Claude 3 Opus" },
        "anthropic/claude-3-sonnet": { "name": "Claude 3 Sonnet" },
        "anthropic/claude-3-haiku": { "name": "Claude 3 Haiku" }
      }
    }
  }
}
EOCONFIG

    PROVIDER_PREFIX="openrouter"
    MODEL_HIGH="anthropic/claude-3-opus"
    MODEL_MID="anthropic/claude-3-sonnet"
    MODEL_LOW="anthropic/claude-3-haiku"
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
        "claude-3-opus-20240229": { "name": "Claude 3 Opus" },
        "claude-3-sonnet-20240229": { "name": "Claude 3 Sonnet" },
        "claude-3-haiku-20240307": { "name": "Claude 3 Haiku" }
      }
    }
  }
}
EOCONFIG

    PROVIDER_PREFIX="anthropic"
    MODEL_HIGH="claude-3-opus-20240229"
    MODEL_MID="claude-3-sonnet-20240229"
    MODEL_LOW="claude-3-haiku-20240307"
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
        "gpt-4o": { "name": "GPT-4o" },
        "gpt-4o-mini": { "name": "GPT-4o Mini" },
        "gpt-4-turbo": { "name": "GPT-4 Turbo" }
      }
    }
  }
}
EOCONFIG

    PROVIDER_PREFIX="openai"
    MODEL_HIGH="gpt-4o"
    MODEL_MID="gpt-4o-mini"
    MODEL_LOW="gpt-4o-mini"
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

case $PROVIDER_CHOICE in
    1) configure_proxy ;;
    2) configure_openrouter ;;
    3) configure_anthropic ;;
    4) configure_openai ;;
    5) configure_free ;;
    6) configure_skip ;;
    *) echo -e "${RED}Invalid choice${NC}"; exit 1 ;;
esac

echo -e "${GREEN}✓ Provider configured: ${PROVIDER_PREFIX}${NC}"

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

if [[ "$PROVIDER_PREFIX" != "YOUR_PROVIDER" ]]; then
    # Replace model references in SKILL.md
    # Handle provider/model format (e.g. "openrouter/anthropic/claude-3-opus")
    if [[ "$PROVIDER_PREFIX" == "opencode" ]]; then
        # Free models: just use the model name with opencode prefix
        sed -i "s|tvdproxy/Opus|opencode/${MODEL_HIGH}|g" "$SKILL_DIR/SKILL.md"
        sed -i "s|tvdproxy/Sonnet|opencode/${MODEL_MID}|g" "$SKILL_DIR/SKILL.md"
        sed -i "s|tvdproxy/Haiku|opencode/${MODEL_LOW}|g" "$SKILL_DIR/SKILL.md"
    else
        sed -i "s|tvdproxy/Opus|${PROVIDER_PREFIX}/${MODEL_HIGH}|g" "$SKILL_DIR/SKILL.md"
        sed -i "s|tvdproxy/Sonnet|${PROVIDER_PREFIX}/${MODEL_MID}|g" "$SKILL_DIR/SKILL.md"
        sed -i "s|tvdproxy/Haiku|${PROVIDER_PREFIX}/${MODEL_LOW}|g" "$SKILL_DIR/SKILL.md"
    fi
    echo -e "${GREEN}✓ Models updated in SKILL.md${NC}"
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
echo "  • Provider: $PROVIDER_PREFIX"
echo ""
echo -e "${GREEN}Model Assignment:${NC}"
echo "  • Opus (complex):  ${PROVIDER_PREFIX}/${MODEL_HIGH}"
echo "  • Sonnet (standard): ${PROVIDER_PREFIX}/${MODEL_MID}"
echo "  • Haiku (fast):    ${PROVIDER_PREFIX}/${MODEL_LOW}"
echo ""
echo -e "${GREEN}Usage:${NC}"
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
