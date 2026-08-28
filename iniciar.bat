@echo off
chcp 65001 >nul
title MCForge All-in-One - Painel e Servidor Minecraft
color 0A

echo ===================================================
echo     MCForge All-in-One - Hospedagem de Minecraft
echo ===================================================
echo.
echo [1/3] Verificando dependencias e instalando...

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [AVISO] Node.js nao encontrado. Baixando e instalando...
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
)

where java >nul 2>nul
if %errorlevel% neq 0 (
    echo [AVISO] Java 21 nao encontrado. Instalando automaticamente...
    winget install EclipseAdoptium.Temurin.21.JRE --accept-package-agreements --accept-source-agreements --silent
)

echo [2/3] Instalando dependencias do painel e daemon...
if not exist "daemon\node_modules" (
    cd daemon
    call npm install
    cd ..
)

if not exist "panel\dist\index.html" (
    echo Compilando Painel Web...
    cd panel
    if not exist "node_modules" call npm install
    call npm run build
    cd ..
)

echo [3/3] Iniciando MCForge All-in-One em http://localhost:3000...
echo.
echo Abra seu navegador em: http://localhost:3000
echo.

start http://localhost:3000
cd daemon
call npm start
pause
