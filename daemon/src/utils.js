// ============================================
// MCForge Daemon - Utilitários
// ============================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function log(level, message) {
  const time = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const colors = {
    info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m', success: '\x1b[32m', debug: '\x1b[90m'
  };
  const reset = '\x1b[0m';
  console.log(`${colors[level] || ''}[${time}] [${level.toUpperCase()}]${reset} ${message}`);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback = {}) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    log('warn', `Falha ao ler JSON ${file}: ${e.message}`);
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function generateId(prefix = 'srv') {
  return `${prefix}_${crypto.randomBytes(4).toString('hex')}`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9_\-.]/g, '_');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Ansi escape codes remover
function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return String(str).replace(/\x1b\[[0-9;]*m/g, '');
}

// Parse de output do servidor para extrair jogadores conectados (linhas como: )
function parsePlayerActivity(line) {
  // Ex: "Player123 joined the game" ou "Player123 left the game"
  const joinMatch = line.match(/(\w+)\s+joined the game/);
  const leaveMatch = line.match(/(\w+)\s+left the game/);
  if (joinMatch) return { type: 'join', player: joinMatch[1] };
  if (leaveMatch) return { type: 'leave', player: leaveMatch[1] };
  return null;
}

// Aguardar um tempo (promise)
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Calcular hash de um arquivo
function fileHash(filePath) {
  return new Promise((resolve) => {
    try {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', d => hash.update(d));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

// Formatar tempo uptime
function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

// Obter arquivos de um diretório com tamanho
function listFilesRecursive(dir, base = dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full).split(path.sep).join('/');
    if (entry.isDirectory()) {
      results.push({ name: entry.name, path: rel, type: 'dir', size: null, children: listFilesRecursive(full, base) });
    } else {
      let size = 0;
      try { size = fs.statSync(full).size; } catch {}
      results.push({ name: entry.name, path: rel, type: 'file', size, children: null });
    }
  }
  return results;
}

module.exports = {
  log, ensureDir, readJson, writeJson, generateId, formatBytes,
  sanitizeFilename, escapeHtml, stripAnsi, parsePlayerActivity,
  sleep, fileHash, formatUptime, listFilesRecursive
};
