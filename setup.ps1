# ==============================================================================
# ⏳ KAIROS — Windows PowerShell Setup & Runner Script
# Installs dependencies, sets up OpenWA WhatsApp Gateway, and launches Kairos.
# ==============================================================================

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "🚀 Initializing Kairos Autonomous Operations Engine Setup (Windows)..." -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# 1. Check Node.js and npm
Write-Host "`n[1/6] Checking prerequisites..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is not installed! Please install Node.js (v18+) first." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js $(node -v) and npm $(npm -v) detected." -ForegroundColor Green

# 2. Environment Configuration
Write-Host "`n[2/6] Configuring environment files..." -ForegroundColor Yellow
if (-not (Test-Path "$ScriptDir\.env")) {
    if (Test-Path "$ScriptDir\.env.example") {
        Copy-Item "$ScriptDir\.env.example" "$ScriptDir\.env"
        Write-Host "⚠️ Created .env from .env.example — please fill in your API credentials!" -ForegroundColor Yellow
    }
} else {
    Write-Host "✅ Root .env already exists." -ForegroundColor Green
}

# 3. Root Dependencies Installation
Write-Host "`n[3/6] Installing Kairos Engine dependencies..." -ForegroundColor Yellow
npm install

# 4. OpenWA Setup
Write-Host "`n[4/6] Setting up OpenWA WhatsApp Gateway..." -ForegroundColor Yellow
if (Test-Path "$ScriptDir\openwa") {
    Set-Location "$ScriptDir\openwa"
    
    if (-not (Test-Path "$ScriptDir\openwa\.env")) {
        if (Test-Path "$ScriptDir\openwa\.env.example") {
            Copy-Item "$ScriptDir\openwa\.env.example" "$ScriptDir\openwa\.env"
        }
    }

    # Append necessary SSRF and anti-ban settings if missing
    $openwaEnv = Get-Content "$ScriptDir\openwa\.env" -Raw -ErrorAction SilentlyContinue
    if ($openwaEnv -notmatch "WEBHOOK_SSRF_PROTECT=false") {
        Add-Content "$ScriptDir\openwa\.env" "`nWEBHOOK_SSRF_PROTECT=false`nSSRF_ALLOWED_HOSTS=localhost,127.0.0.1"
    }

    # Install OpenWA with ignore-scripts for smooth cross-platform compatibility
    npm install --ignore-scripts

    # Apply whatsapp-web.js patch if present
    if (Test-Path "$ScriptDir\openwa\scripts\patch-wwebjs-201832.js") {
        Write-Host "Applying whatsapp-web.js patch..." -ForegroundColor Yellow
        node "$ScriptDir\openwa\scripts\patch-wwebjs-201832.js"
    }

    Set-Location $ScriptDir
    Write-Host "✅ OpenWA Gateway prepared." -ForegroundColor Green
}

# 5. Notion Database Check
Write-Host "`n[5/6] Checking Notion database configuration..." -ForegroundColor Yellow
$rootEnv = Get-Content "$ScriptDir\.env" -Raw -ErrorAction SilentlyContinue
if ($rootEnv -match "NOTION_API_KEY=ntn_") {
    Write-Host "Running Notion database initialization..." -ForegroundColor Yellow
    npm run setup:notion
} else {
    Write-Host "ℹ️ Fill NOTION_API_KEY in .env to create databases automatically with 'npm run setup:notion'." -ForegroundColor Cyan
}

# 6. Launch Services
Write-Host "`n[6/6] Launching Kairos and OpenWA Services..." -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "📱 OpenWA Gateway starting on:  http://localhost:2785" -ForegroundColor Green
Write-Host "🖥️  OpenWA Dashboard on:         http://localhost:2785" -ForegroundColor Green
Write-Host "⚡ Kairos Operations Engine on: http://localhost:3000" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan

# Start OpenWA in a background process
$OpenWAProcess = $null
if (Test-Path "$ScriptDir\openwa") {
    $OpenWAProcess = Start-Process -FilePath "npm.cmd" -ArgumentList "run start:dev" -WorkingDirectory "$ScriptDir\openwa" -PassThru
    Write-Host "🚀 OpenWA started (PID: $($OpenWAProcess.Id))" -ForegroundColor Green
    Start-Sleep -Seconds 6
}

try {
    # Start Kairos Engine in foreground
    npm start
} finally {
    Write-Host "`n🛑 Stopping OpenWA background process..." -ForegroundColor Yellow
    if ($OpenWAProcess -and -not $OpenWAProcess.HasExited) {
        Stop-Process -Id $OpenWAProcess.Id -Force -ErrorAction SilentlyContinue
    }
}
