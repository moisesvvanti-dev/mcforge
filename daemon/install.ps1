# ============================================
# MCForge Daemon - Instalador (Windows)
# Instala Node.js, Java, cloudflared e o daemon
# ============================================
param(
    [switch]$SkipJava,
    [switch]$SkipNode,
    [switch]$SkipCloudflared
)

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "MCForge Daemon - Instalador"

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  MCForge Daemon - Instalador v1.0" -ForegroundColor Cyan
Write-Host "  Sistema de hospedagem de Minecraft" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

function Test-Command($cmd) {
    try { Get-Command $cmd -ErrorAction Stop | Out-Null; return $true } catch { return $false }
}

# ---------- 1. Node.js ----------
if (-not $SkipNode) {
    if (Test-Command node) {
        $nodeVer = node --version
        Write-Host "[OK] Node.js $nodeVer já instalado" -ForegroundColor Green
    } else {
        Write-Host "[..] Instalando Node.js (via winget)..." -ForegroundColor Yellow
        try {
            winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
            Write-Host "[OK] Node.js instalado. Reabra o terminal se necessário." -ForegroundColor Green
        } catch {
            Write-Host "[!] Não foi possível instalar Node.js automaticamente." -ForegroundColor Red
            Write-Host "    Baixe manualmente: https://nodejs.org (versão LTS)" -ForegroundColor Yellow
        }
    }
}

# ---------- 2. Java ----------
if (-not $SkipJava) {
    $javaOk = $false
    try { java -version 2>&1 | Out-Null; $javaOk = $true } catch {}
    if ($javaOk) {
        $javaVer = (java -version 2>&1 | Select-Object -First 1)
        Write-Host "[OK] Java detectado: $javaVer" -ForegroundColor Green
    } else {
        Write-Host "[..] Instalando Java 21 (Temurin)..." -ForegroundColor Yellow
        try {
            winget install EclipseAdoptium.Temurin.21.JRE --accept-package-agreements --accept-source-agreements --silent
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
            Write-Host "[OK] Java 21 instalado." -ForegroundColor Green
        } catch {
            Write-Host "[!] Falha ao instalar Java automaticamente." -ForegroundColor Red
            Write-Host "    Baixe manualmente: https://adoptium.net (Temurin 21)" -ForegroundColor Yellow
        }
    }
}

# ---------- 3. cloudflared ----------
if (-not $SkipCloudflared) {
    if (Test-Command cloudflared) {
        Write-Host "[OK] cloudflared já instalado" -ForegroundColor Green
    } else {
        Write-Host "[..] Baixando cloudflared..." -ForegroundColor Yellow
        $url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
        $dest = "$env:LOCALAPPDATA\cloudflared\cloudflared.exe"
        New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
        try {
            Invoke-WebRequest -Uri $url -OutFile $dest
            # Adicionar ao PATH do usuário
            $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
            $binDir = Split-Path $dest
            if ($userPath -notlike "*$binDir*") {
                [System.Environment]::SetEnvironmentVariable("Path", "$userPath;$binDir", "User")
            }
            Write-Host "[OK] cloudflared instalado em $dest" -ForegroundColor Green
        } catch {
            Write-Host "[!] Falha ao baixar cloudflared. Baixe manualmente:" -ForegroundColor Red
            Write-Host "    https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" -ForegroundColor Yellow
        }
    }
}

# ---------- 4. Dependências do daemon ----------
Write-Host ""
Write-Host "[..] Instalando dependências do daemon (npm)..." -ForegroundColor Yellow
Push-Location (Join-Path $PSScriptRoot "..")
try {
    npm install --no-fund --no-audit
    Write-Host "[OK] Dependências instaladas." -ForegroundColor Green
} catch {
    Write-Host "[!] Falha no npm install: $_" -ForegroundColor Red
}
Pop-Location

# ---------- 5. Configuração inicial ----------
$envFile = Join-Path $PSScriptRoot "..\.env"
if (-not (Test-Path $envFile)) {
    Copy-Item (Join-Path $PSScriptRoot "..\.env.example") $envFile
    Write-Host "[OK] Arquivo .env criado. Edite com suas senhas!" -ForegroundColor Green
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Instalação concluída!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor White
Write-Host "  1. Edite o arquivo .env (senha e porta)" -ForegroundColor Yellow
Write-Host "  2. Inicie o daemon:  npm start" -ForegroundColor Yellow
Write-Host "  3. Abra http://localhost:3000 no navegador" -ForegroundColor Yellow
Write-Host "  4. Para o painel no Netlify, veja o README.md" -ForegroundColor Yellow
Write-Host ""
