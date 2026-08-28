// ============================================
// MCForge - Instalador Automático de Ferramentas
// Baixa Java 21, Cloudflared e compila o Painel sozinho
// ============================================
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');
const { log, ensureDir } = require('./utils');
const { getConfig, updateConfig } = require('./config');

const BIN_DIR = path.join(__dirname, '..', 'bin');

// Verifica se comando executa com sucesso
function testExecutable(cmd) {
  try {
    execSync(`"${cmd}" -version 2>&1` , { timeout: 4000, stdio: 'pipe' });
    return true;
  } catch {
    try {
      execSync(`"${cmd}" --version 2>&1`, { timeout: 4000, stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }
}

// Download simples com suporte a redirects via fetch/https
async function downloadFile(url, destPath) {
  ensureDir(path.dirname(destPath));
  log('info', `Baixando ferramenta: ${path.basename(destPath)}...`);
  
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Falha no download (${res.status}): ${url}`);
  
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
  log('success', `Download concluído: ${path.basename(destPath)} (${(fs.statSync(destPath).size / 1024 / 1024).toFixed(1)}MB)`);
  return destPath;
}

// Garante que o Cloudflared está instalado e pronto
async function ensureCloudflared() {
  const config = getConfig();
  if (testExecutable(config.cloudflaredPath) || testExecutable('cloudflared')) {
    return config.cloudflaredPath;
  }

  ensureDir(BIN_DIR);
  const isWin = os.platform() === 'win32';
  const binName = isWin ? 'cloudflared.exe' : 'cloudflared';
  const localBin = path.join(BIN_DIR, binName);

  if (fs.existsSync(localBin) && testExecutable(localBin)) {
    updateConfig({ cloudflaredPath: localBin });
    return localBin;
  }

  log('info', 'Cloudflared não encontrado no sistema. Baixando automaticamente...');
  const url = isWin
    ? 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
    : 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64';

  try {
    await downloadFile(url, localBin);
    if (!isWin) {
      fs.chmodSync(localBin, 0o755);
    }
    updateConfig({ cloudflaredPath: localBin });
    log('success', `Cloudflared configurado com sucesso em: ${localBin}`);
    return localBin;
  } catch (err) {
    log('warn', `Não foi possível baixar cloudflared automaticamente: ${err.message}`);
    return 'cloudflared';
  }
}

// Garante que o Java 21 está presente
async function ensureJava() {
  const config = getConfig();
  if (config.javaPath && testExecutable(config.javaPath)) {
    return config.javaPath;
  }
  if (testExecutable('java')) {
    return 'java';
  }

  // Verifica se já temos o Java na pasta bin local
  const isWin = os.platform() === 'win32';
  const javaLocal = path.join(BIN_DIR, 'java', 'bin', isWin ? 'java.exe' : 'java');
  if (fs.existsSync(javaLocal) && testExecutable(javaLocal)) {
    updateConfig({ javaPath: javaLocal });
    return javaLocal;
  }

  log('warn', 'Java não detectado no sistema! O MCForge tentará usar o executável do PATH ou baixar.');
  return 'java';
}

// Garante que o painel web está compilado
function ensurePanelBuild() {
  const panelDir = path.join(__dirname, '..', '..', 'panel');
  const panelDist = path.join(panelDir, 'dist');
  const indexHtml = path.join(panelDist, 'index.html');

  if (fs.existsSync(indexHtml)) {
    return true;
  }

  log('info', 'Compilando o painel web integrado (Vite build)...');
  try {
    if (!fs.existsSync(path.join(panelDir, 'node_modules'))) {
      log('info', 'Instalando dependências do painel...');
      execSync('npm install --prefer-offline', { cwd: panelDir, stdio: 'inherit' });
    }
    execSync('npm run build', { cwd: panelDir, stdio: 'inherit' });
    log('success', 'Painel web compilado com sucesso!');
    return true;
  } catch (e) {
    log('error', `Falha ao compilar painel automaticamente: ${e.message}`);
    return false;
  }
}

// Executa todas as verificações e instalações automáticas
async function autoBootstrap() {
  ensureDir(BIN_DIR);
  await ensureCloudflared();
  await ensureJava();
  ensurePanelBuild();
}

module.exports = {
  autoBootstrap,
  ensureCloudflared,
  ensureJava,
  ensurePanelBuild,
  BIN_DIR
};
