#!/usr/bin/env bash
# ============================================
# MCForge All-in-One - Launcher Linux/macOS
# ============================================
set -e

echo "==================================================="
echo "    MCForge All-in-One - Hospedagem de Minecraft"
echo "==================================================="
echo ""

echo "[1/3] Verificando dependências..."
if ! command -v node &> /dev/null; then
    echo "Node.js não encontrado. Por favor, instale o Node.js 18+ ou execute via GitHub Actions."
fi

echo "[2/3] Instalando dependências e compilando painel..."
if [ ! -d "daemon/node_modules" ]; then
    cd daemon && npm install && cd ..
fi

if [ ! -f "panel/dist/index.html" ]; then
    echo "Compilando Painel Web..."
    cd panel && npm install && npm run build && cd ..
fi

echo "[3/3] Iniciando MCForge All-in-One em http://localhost:3000..."
echo "Acesse: http://localhost:3000"
echo ""

cd daemon
npm start
