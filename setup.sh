#!/usr/bin/env bash

# ==============================================================================
# ⏳ KAIROS — Complete Automated Setup & Runner Script
# Installs dependencies, sets up OpenWA WhatsApp Gateway, and launches Kairos.
# Works on Linux, macOS, and Windows (Git Bash / WSL / MSYS).
# ==============================================================================

set -e

echo "================================================================="
echo "🚀 Initializing Kairos Autonomous Operations Engine Setup..."
echo "================================================================="

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# 1. Check Node.js and npm
echo -e "\n[1/6] Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed! Please install Node.js (v18+) first."
    exit 1
fi
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed! Please install npm first."
    exit 1
fi
echo "✅ Node.js $(node -v) and npm $(npm -v) detected."

# 2. Environment Configuration
echo -e "\n[2/6] Configuring environment files..."
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    if [ -f "$PROJECT_ROOT/.env.example" ]; then
        cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
        echo "⚠️ Created .env from .env.example — please fill in your API credentials!"
    else
        touch "$PROJECT_ROOT/.env"
    fi
else
    echo "✅ Root .env already exists."
fi

# 3. Root Dependencies Installation
echo -e "\n[3/6] Installing Kairos Engine dependencies..."
npm install

# 4. OpenWA Setup
echo -e "\n[4/6] Setting up OpenWA WhatsApp Gateway..."
if [ -d "$PROJECT_ROOT/openwa" ]; then
    cd "$PROJECT_ROOT/openwa"
    
    if [ ! -f "$PROJECT_ROOT/openwa/.env" ]; then
        if [ -f "$PROJECT_ROOT/openwa/.env.example" ]; then
            cp "$PROJECT_ROOT/openwa/.env.example" "$PROJECT_ROOT/openwa/.env"
        else
            touch "$PROJECT_ROOT/openwa/.env"
        fi
    fi

    # Append necessary SSRF and anti-ban settings
    if ! grep -q "WEBHOOK_SSRF_PROTECT=false" "$PROJECT_ROOT/openwa/.env" 2>/dev/null; then
        echo -e "\nWEBHOOK_SSRF_PROTECT=false\nSSRF_ALLOWED_HOSTS=localhost,127.0.0.1" >> "$PROJECT_ROOT/openwa/.env"
    fi

    # Install OpenWA with ignore-scripts for smooth cross-platform compatibility
    npm install --ignore-scripts

    # Apply whatsapp-web.js patch if available
    if [ -f "$PROJECT_ROOT/openwa/scripts/patch-wwebjs-201832.js" ]; then
        echo "Applying whatsapp-web.js patch..."
        node "$PROJECT_ROOT/openwa/scripts/patch-wwebjs-201832.js" || true
    fi

    cd "$PROJECT_ROOT"
    echo "✅ OpenWA Gateway prepared."
else
    echo "⚠️ openwa directory not found. Please ensure OpenWA is cloned."
fi

# 5. Notion Database Check
echo -e "\n[5/6] Checking Notion database configuration..."
if grep -q "NOTION_API_KEY=ntn_" "$PROJECT_ROOT/.env" 2>/dev/null && [ ! -z "$(grep NOTION_API_KEY "$PROJECT_ROOT/.env" | cut -d= -f2)" ]; then
    echo "Running Notion database initialization..."
    npm run setup:notion || echo "ℹ️ Notion initialization skipped or already configured."
else
    echo "ℹ️ Fill NOTION_API_KEY in .env to create databases automatically with 'npm run setup:notion'."
fi

# 6. Launch Services
echo -e "\n[6/6] Launching Kairos and OpenWA Services..."
echo "================================================================="
echo "📱 OpenWA Gateway starting on:  http://localhost:2785"
echo "🖥️  OpenWA Dashboard on:         http://localhost:2785"
echo "⚡ Kairos Operations Engine on: http://localhost:3000"
echo "================================================================="

# Start OpenWA in background
if [ -d "$PROJECT_ROOT/openwa" ]; then
    (cd "$PROJECT_ROOT/openwa" && npm run start:dev) &
    OPENWA_PID=$!
    echo "🚀 OpenWA started (PID: $OPENWA_PID)"
    
    # Wait for OpenWA port to become ready
    echo "Waiting for OpenWA Gateway to bind port 2785..."
    sleep 6
fi

# Graceful cleanup on Ctrl+C
cleanup() {
    echo -e "\n🛑 Stopping all Kairos services..."
    if [ ! -z "$OPENWA_PID" ]; then
        kill "$OPENWA_PID" 2>/dev/null || true
    fi
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Start Kairos Engine in foreground
echo -e "\n⚡ Starting Kairos Engine..."
npm start
