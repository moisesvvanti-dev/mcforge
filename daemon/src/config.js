// ============================================
// MCForge Daemon - Gerenciamento de Configuração
// ============================================
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { log, ensureDir, readJson, writeJson } = require('./utils');

const DAEMON_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(DAEMON_DIR, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'daemon.json');
const SERVERS_FILE = path.join(DATA_DIR, 'servers.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DEFAULT_SERVERS_DIR = path.join(DAEMON_DIR, 'servers');
const DEFAULT_BACKUPS_DIR = path.join(DAEMON_DIR, '..', 'backups');

// Carregar .env simples (sem dependência)
function loadEnv() {
  const envFile = path.join(DAEMON_DIR, '.env');
  const env = {};
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      env[key] = val;
    }
  }
  return env;
}

const env = loadEnv();

const defaultConfig = {
  version: 1,
  port: parseInt(env.DAEMON_PORT || '3000', 10),
  passwordHash: null, // será definido no primeiro uso
  jwtSecret: env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
  serversDir: path.resolve(DAEMON_DIR, env.SERVERS_DIR || 'servers'),
  backupsDir: env.BACKUPS_DIR
    ? path.resolve(DAEMON_DIR, env.BACKUPS_DIR)
    : path.resolve(DAEMON_DIR, '..', 'backups'),
  autoRestart: env.AUTO_RESTART === 'true',
  heartbeatInterval: parseInt(env.HEARTBEAT_INTERVAL || '30', 10),
  cloudflaredPath: env.CLOUDFLARED_PATH || 'cloudflared',
  tunnelDomain: env.TUNNEL_DOMAIN || '',
  javaPath: env.JAVA_PATH || '',
  debug: env.DEBUG === 'true',
  theme: 'dark',
  createdAt: new Date().toISOString(),
  netlifyPanelUrl: '' // URL do painel no Netlify (opcional)
};

let config = { ...defaultConfig, ...readJson(CONFIG_FILE) };

function saveConfig() {
  writeJson(CONFIG_FILE, config);
}

function getConfig() {
  return config;
}

function updateConfig(patch) {
  const allowed = ['port', 'autoRestart', 'heartbeatInterval', 'cloudflaredPath',
    'tunnelDomain', 'javaPath', 'debug', 'theme', 'netlifyPanelUrl', 'serversDir', 'backupsDir'];
  for (const key of Object.keys(patch)) {
    if (allowed.includes(key)) {
      config[key] = patch[key];
    }
  }
  saveConfig();
  return config;
}

function setPassword(plainPassword) {
  const bcrypt = require('bcryptjs');
  config.passwordHash = bcrypt.hashSync(plainPassword, 10);
  saveConfig();
}

function verifyPassword(plainPassword) {
  const bcrypt = require('bcryptjs');
  if (!config.passwordHash) return false;
  return bcrypt.compareSync(plainPassword, config.passwordHash);
}

function hasPassword() {
  return !!config.passwordHash;
}

// ---------- Servidores registrados ----------
function getServers() {
  return readJson(SERVERS_FILE, {});
}

function saveServers(servers) {
  writeJson(SERVERS_FILE, servers);
}

// ---------- Usuários (compartilhar com amigos) ----------
function getUsers() {
  return readJson(USERS_FILE, {});
}

function saveUsers(users) {
  writeJson(USERS_FILE, users);
}

function ensureDataDirs() {
  ensureDir(DATA_DIR);
  ensureDir(config.serversDir);
  ensureDir(config.backupsDir);
}

function getSystemInfo() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const loadAvg = os.loadavg ? os.loadavg()[0] : 0;
  return {
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    cpuCores: os.cpus().length,
    totalMemory: totalMem,
    freeMemory: freeMem,
    usedMemory: totalMem - freeMem,
    loadAvg,
    uptime: os.uptime(),
    nodeVersion: process.version,
    javaAvailable: checkJava(),
    cloudflaredAvailable: checkCloudflared(),
    localIPs: getLocalIPs()
  };
}

// IPs locais da máquina (rede local)
function getLocalIPs() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push({ name, address: net.address });
      }
    }
  }
  return ips;
}

// Cache do IP público (evita chamadas repetidas ao serviço externo)
let publicIpCache = { ip: null, at: 0 };

async function getPublicIp(force = false) {
  const now = Date.now();
  if (!force && publicIpCache.ip && now - publicIpCache.at < 60000) {
    return publicIpCache.ip;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json();
    if (data.ip) {
      publicIpCache = { ip: data.ip, at: now };
      return data.ip;
    }
  } catch {
    // Serviço indisponível; tentar alternativa
    try {
      const controller2 = new AbortController();
      const timer2 = setTimeout(() => controller2.abort(), 6000);
      const res2 = await fetch('https://api.seeip.org/jsonip', { signal: controller2.signal });
      clearTimeout(timer2);
      const data2 = await res2.json();
      if (data2.ip) {
        publicIpCache = { ip: data2.ip, at: now };
        return data2.ip;
      }
    } catch {
      // Sem internet ou bloqueado
    }
  }
  return null;
}

function checkJava() {
  try {
    const { execSync } = require('child_process');
    const out = execSync('java -version 2>&1', { timeout: 5000 }).toString();
    const m = out.match(/version "([^"]+)"/);
    return m ? m[1] : 'detectado';
  } catch {
    return null;
  }
}

function checkCloudflared() {
  try {
    const { execSync } = require('child_process');
    execSync(`${config.cloudflaredPath} --version`, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  getConfig, updateConfig, setPassword, verifyPassword, hasPassword,
  getServers, saveServers, getUsers, saveUsers, ensureDataDirs, getSystemInfo, getPublicIp,
  CONFIG_FILE, SERVERS_FILE, USERS_FILE, DATA_DIR, DAEMON_DIR, env
};
