# ============================================
# MCForge - Setup Completo (Windows)
# Instala e configura tudo que você precisa
# ============================================
param(
    [switch]$SkipPanel,
    [switch]$SkipDaemon,
    [switch]$Help
)

if ($Help) {
    Write-Host @"
MCForge - Instalador Completo
=============================
Parâmetros:
  -SkipPanel    Pula a instalação/compilação do painel web
  -SkipDaemon   Pula a instalação das dependências do daemon
  -Help         Mostra esta ajuda

O instalador vai:
  1. Verificar/instalar Node.js
  2. Verificar/instalar Java 21
  3. Instalar cloudflared
  4. Instalar dependências do daemon
  5. Instalar/compilar o painel web
  6. Configurar o ambiente
"@
    return
}

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "MCForge - Setup"
$rootDir = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "     MCForge - Setup Completo v1.0" -ForegroundColor Cyan
Write-Host "  Sistema de Hospedagem de Minecraft" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

function Test-Command($cmd) {
    try { Get-Command $cmd -ErrorAction Stop | Out-Null; return $true } catch { return $false }
}

# ---------- 1. Node.js ----------
if (-not (Test-Command node)) {
    Write-Host "[..] Instalando Node.js..." -ForegroundColor Yellow
    try {
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        Write-Host "[OK] Node.js instalado" -ForegroundColor Green
    } catch {
        Write-Host "[!] Baixe o Node.js em: https://nodejs.org" -ForegroundColor Red
        Write-Host "    Escolha a versão LTS e instale manualmente." -ForegroundColor Yellow
    }
} else {
    Write-Host "[OK] Node.js $(node --version)" -ForegroundColor Green
}

# ---------- 2. Java ----------
$javaOk = $false
try { java -version 2>&1 | Out-Null; $javaOk = $true } catch {}
if (-not $javaOk) {
    Write-Host "[..] Instalando Java 21..." -ForegroundColor Yellow
    try {
        winget install EclipseAdoptium.Temurin.21.JRE --accept-package-agreements --accept-source-agreements --silent
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        Write-Host "[OK] Java 21 instalado" -ForegroundColor Green
    } catch {
        Write-Host "[!] Baixe o Java 21 em: https://adoptium.net" -ForegroundColor Red
        Write-Host "    Escolha a versão 21 (LTS) para Windows x64 e instale." -ForegroundColor Yellow
    }
} else {
    $javaVer = (java -version 2>&1 | Select-Object -First 1).Trim()
    Write-Host "[OK] $javaVer" -ForegroundColor Green
}

# ---------- 3. cloudflared ----------
if (-not (Test-Command cloudflared)) {
    Write-Host "[..] Baixando cloudflared..." -ForegroundColor Yellow
    $url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    $dest = "$env:LOCALAPPDATA\cloudflared\cloudflared.exe"
    New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
    try {
        Invoke-WebRequest -Uri $url -OutFile $dest
        $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
        $binDir = Split-Path $dest
        if ($userPath -notlike "*$binDir*") {
            [System.Environment]::SetEnvironmentVariable("Path", "$userPath;$binDir", "User")
        }
        Write-Host "[OK] cloudflared instalado" -ForegroundColor Green
    } catch {
        Write-Host "[!] Baixe o cloudflared manualmente:" -ForegroundColor Red
        Write-Host "    https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" -ForegroundColor Yellow
    }
} else {
    Write-Host "[OK] cloudflared $(cloudflared --version 2>&1 | Select-Object -First 1)" -ForegroundColor Green
}

# ---------- 4. Dependências do daemon ----------
if (-not $SkipDaemon) {
    Write-Host "[..] Instalando dependências do daemon..." -ForegroundColor Yellow
    Push-Location (Join-Path $rootDir "daemon")
    try {
        npm install --no-fund --no-audit
        Write-Host "[OK] Daemon pronto" -ForegroundColor Green
    } catch {
        Write-Host "[!] npm install no daemon: $_" -ForegroundColor Red
    }
    Pop-Location
}

# ---------- 5. Config do daemon ----------
$envFile = Join-Path $rootDir "daemon\.env"
if (-not (Test-Path $envFile)) {
    Copy-Item (Join-Path $rootDir "daemon\.env.example") $envFile
    Write-Host "[OK] .env criado. Edite a senha!" -ForegroundColor Green
}

# ---------- 6. Painel React ----------
if (-not $SkipPanel) {
    if (Test-Path (Join-Path $rootDir "panel\package.json")) {
        Write-Host "[..] Instalando dependências do painel..." -ForegroundColor Yellow
        Push-Location (Join-Path $rootDir "panel")
        try {
            npm install --no-fund --no-audit
            Write-Host "[OK] Dependências do painel instaladas" -ForegroundColor Green
            Write-Host "[..] Compilando painel..." -ForegroundColor Yellow
            npm run build
            Write-Host "[OK] Painel compilado em panel/dist" -ForegroundColor Green
        } catch {
            Write-Host "[!] Falha no painel: $_" -ForegroundColor Red
        }
        Pop-Location
    }
}

# ---------- 7. Pronto ----------
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  ✅ INSTALAÇÃO CONCLUÍDA!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 PRÓXIMOS PASSOS:" -ForegroundColor White
Write-Host ""
Write-Host "  1️⃣  Edite a senha e porta no arquivo:" -ForegroundColor Yellow
Write-Host "     daemon\.env"
Write-Host ""
Write-Host "  2️⃣  Inicie o daemon:" -ForegroundColor Yellow
Write-Host "     cd daemon"
Write-Host "     npm start"
Write-Host ""
Write-Host "  3️⃣  Abra o painel no navegador:" -ForegroundColor Yellow
Write-Host "     http://localhost:3000"
Write-Host ""
Write-Host "  4️⃣  (Opcional) Deploy do painel no Netlify:" -ForegroundColor Yellow
Write-Host "     cd panel"
Write-Host "     npm run build"
Write-Host "     arraste a pasta dist/ para o Netlify"
Write-Host "     ou configure o deploy via Git"
Write-Host ""
Write-Host "  5️⃣  Configurar Tunnel Cloudflare (DDoS + domínio):" -ForegroundColor Yellow
Write-Host "     cloudflared tunnel login"
Write-Host "     Depois use o painel em Rede & Tunnel"
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Divirta-se! 🎮" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan