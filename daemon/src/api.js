// ============================================
// MCForge Daemon - API REST (Express)
// ============================================
const express = require('express');
const multer = require('multer');
const path = require('path');
const rateLimit = require('express-rate-limit');
const fs = require('fs');

const { log, readJson, writeJson, formatBytes } = require('./utils');
const { getConfig, updateConfig, getSystemInfo, ensureDataDirs, getPublicIp, CONFIG_FILE } = require('./config');
const { authenticateToken, optionalAuth, adminOnly, login, register, listUsers, addUser, removeUser } = require('./auth');
const serverManager = require('./server-manager');
const pluginManager = require('./plugin-manager');
const worldManager = require('./world-manager');
const versionManager = require('./version-manager');
const tunnel = require('./tunnel');

function createApi(wss) {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // CORS para o painel (Netlify)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // ---------- Proteção Anti-DDoS / Anti-DoS & Bad Bots Nativa via Código Puro ----------
  const ipRequestTracker = new Map();
  const bannedIps = new Set();

  app.use((req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    
    // 1. Bloqueio de IP banido por excesso de requisições
    if (bannedIps.has(ip)) {
      return res.status(429).json({ error: 'Acesso bloqueado temporariamente por atividade suspeita (Anti-DDoS).' });
    }

    // 2. Filtro contra Bad Bots e Scrapers maliciosos
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    const badBots = ['sqlmap', 'nikto', 'nmap', 'masscan', 'gobuster', 'dirbuster', 'zgrab', 'censys'];
    if (badBots.some(bot => ua.includes(bot))) {
      log('warn', `[Anti-Bot Shield] Bloqueado bot malicioso (${ua}) do IP: ${ip}`);
      return res.status(403).json({ error: 'Acesso negado por proteção Anti-Bot nativa.' });
    }

    // 3. Sliding Window Rate Limiter por segundo (Anti-Flood / DoS)
    const now = Date.now();
    const tracker = ipRequestTracker.get(ip) || { count: 0, resetAt: now + 1000 };
    if (now > tracker.resetAt) {
      tracker.count = 1;
      tracker.resetAt = now + 1000;
    } else {
      tracker.count++;
      if (tracker.count > 60) {
        log('warn', `[Anti-DDoS Shield] Detectado flood de ${ip} (${tracker.count} req/s). Bloqueando.`);
        bannedIps.add(ip);
        setTimeout(() => bannedIps.delete(ip), 30000);
        return res.status(429).json({ error: 'Taxa de requisições excedida. IP temporariamente bloqueado por proteção Anti-DoS.' });
      }
    }
    ipRequestTracker.set(ip, tracker);

    next();
  });

  // Rate limit global
  app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    message: { error: 'Muitas requisições. Tente novamente em 1 minuto.' }
  }));

  // Multer para uploads
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

  // ---------- Health check (público) ----------
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // ---------- Autenticação ----------
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!password) return res.status(400).json({ error: 'Senha é obrigatória' });
    const result = login(username ? username.trim() : 'admin', password);
    if (!result) return res.status(401).json({ error: 'Credenciais inválidas' });
    if (result.error) return res.status(401).json({ error: result.error });
    res.json(result);
  });

  app.post('/api/auth/register', (req, res) => {
    const { username, password, name } = req.body || {};
    if (!username || !username.trim()) return res.status(400).json({ error: 'Nome de usuário é obrigatório' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
    const result = register(username.trim(), password, name ? name.trim() : '');
    if (result.error) return res.status(400).json({ error: result.error });
    res.status(201).json(result);
  });

  app.get('/api/auth/status', (req, res) => {
    const { hasPassword } = require('./config');
    res.json({ initialized: hasPassword() });
  });

  app.post('/api/auth/users', authenticateToken, adminOnly, (req, res) => {
    const { username, name, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    if (password.length < 6) return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
    const result = addUser(username, name, password, role || 'user');
    if (result.error) return res.status(400).json(result);
    res.json(result);
  });

  app.get('/api/auth/users', authenticateToken, adminOnly, (req, res) => {
    res.json({ users: listUsers() });
  });

  app.delete('/api/auth/users/:username', authenticateToken, adminOnly, (req, res) => {
    const result = removeUser(req.params.username);
    if (result.error) return res.status(404).json(result);
    res.json(result);
  });

  // ---------- Sistema ----------
  app.get('/api/public-info', (req, res) => {
    const { hasPassword } = require('./config');
    res.json({
      status: 'ok',
      initialized: hasPassword(),
      types: ['paper', 'purpur', 'vanilla', 'fabric', 'forge'],
      system: {
        javaAvailable: getSystemInfo().javaAvailable,
        platform: getSystemInfo().platform
      },
      time: new Date().toISOString()
    });
  });

  app.get('/api/system', authenticateToken, (req, res) => {
    res.json({ config: getConfig(), system: getSystemInfo() });
  });

  // IP público da máquina (para port forwarding / configuração)
  app.get('/api/system/public-ip', authenticateToken, async (req, res) => {
    try {
      const ip = await getPublicIp(req.query.force === 'true');
      res.json({ ip });
    } catch (e) {
      res.status(502).json({ error: 'Não foi possível detectar o IP público: ' + e.message });
    }
  });

  app.put('/api/system/config', authenticateToken, adminOnly, (req, res) => {
    const updated = updateConfig(req.body);
    res.json({ success: true, config: updated });
  });

  // ---------- Servidores ----------
  app.get('/api/servers', authenticateToken, (req, res) => {
    const servers = serverManager.getAllServers();
    res.json({ servers });
  });

  app.post('/api/servers', authenticateToken, adminOnly, async (req, res) => {
    try {
      const server = await serverManager.createServer(req.body);
      // Aceitar EULA automaticamente
      serverManager.acceptEula(server.id);
      serverManager.writeServerProperties(server.id, server);
      res.status(201).json({ server });
    } catch (e) {
      log('error', `Erro ao criar servidor: ${e.message}`);
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/servers/:id', optionalAuth, (req, res) => {
    const server = serverManager.getServer(req.params.id);
    if (!server) return res.status(404).json({ error: 'Servidor não encontrado' });
    res.json({ server });
  });

  app.put('/api/servers/:id', authenticateToken, async (req, res) => {
    const server = await serverManager.updateServer(req.params.id, req.body);
    if (!server) return res.status(404).json({ error: 'Servidor não encontrado' });
    res.json({ server });
  });

  app.delete('/api/servers/:id', authenticateToken, adminOnly, async (req, res) => {
    const ok = await serverManager.deleteServer(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Servidor não encontrado' });
    res.json({ success: true });
  });

  // ---------- Ações do servidor ----------
  app.post('/api/servers/:id/start', authenticateToken, async (req, res) => {
    const result = await serverManager.startServer(req.params.id);
    if (result.error) return res.status(400).json(result);
    res.json({ success: true, ...result });
  });

  app.post('/api/servers/:id/stop', authenticateToken, async (req, res) => {
    const result = await serverManager.stopServer(req.params.id);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  });

  app.post('/api/servers/:id/restart', authenticateToken, async (req, res) => {
    const result = await serverManager.restartServer(req.params.id);
    if (result.error) return res.status(400).json(result);
    res.json({ success: true });
  });

  app.post('/api/servers/:id/command', authenticateToken, (req, res) => {
    const { command } = req.body;
    if (!command) return res.status(400).json({ error: 'Comando é obrigatório' });
    const result = serverManager.sendCommand(req.params.id, command);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  });

  app.get('/api/servers/:id/logs', optionalAuth, (req, res) => {
    const limit = parseInt(req.query.limit || '200', 10);
    res.json({ logs: serverManager.getLogs(req.params.id, limit) });
  });

  app.post('/api/servers/:id/eula', authenticateToken, adminOnly, (req, res) => {
    serverManager.acceptEula(req.params.id);
    res.json({ success: true });
  });

  // ---------- Whitelist / Ops / Ban ----------
  app.post('/api/servers/:id/players/:kind', authenticateToken, (req, res) => {
    const { player, action } = req.body;
    if (!player || !['add', 'remove'].includes(action)) {
      return res.status(400).json({ error: 'player e action (add|remove) são obrigatórios' });
    }
    const result = serverManager.updatePlayerList(req.params.id, req.params.kind, player, action);
    if (result.error) return res.status(404).json(result);
    res.json(result);
  });

  // ---------- Plugins / Mods ----------
  app.get('/api/servers/:id/plugins', authenticateToken, (req, res) => {
    res.json({ plugins: pluginManager.listInstalled(req.params.id) });
  });

  app.get('/api/plugins/search', authenticateToken, async (req, res) => {
    const { q, type, gameVersion, loader } = req.query;
    if (!q) return res.status(400).json({ error: 'Query é obrigatória' });
    try {
      const results = [];
      if (type !== 'mod') {
        try { results.push(...await pluginManager.searchHangar(q, { limit: 5 })); } catch {}
      }
      results.push(...await pluginManager.searchModrinth(q, { type, gameVersion, loader, limit: 20 }));
      res.json({ results });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/servers/:id/plugins/modrinth', authenticateToken, async (req, res) => {
    const { projectId, gameVersion, loader } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId é obrigatório' });
    try {
      const result = await pluginManager.installFromModrinth(req.params.id, projectId, { gameVersion, loader });
      if (result.error) return res.status(400).json(result);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/servers/:id/plugins/hangar', authenticateToken, async (req, res) => {
    const { slug } = req.body;
    if (!slug) return res.status(400).json({ error: 'slug é obrigatório' });
    try {
      const result = await pluginManager.installFromHangar(req.params.id, slug);
      if (result.error) return res.status(400).json(result);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/servers/:id/plugins/upload', authenticateToken, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Arquivo é obrigatório' });
    const result = await pluginManager.uploadPluginFile(req.params.id, req.file);
    res.json(result);
  });

  app.delete('/api/servers/:id/plugins/:filename', authenticateToken, (req, res) => {
    const result = pluginManager.removePlugin(req.params.id, req.params.filename);
    res.json(result);
  });

  // ---------- Versões (público / sem necessidade de login prévio) ----------
  app.get('/api/versions/:type', optionalAuth, async (req, res) => {
    const type = req.params.type;
    try {
      let versions = [];
      switch (type) {
        case 'vanilla': versions = await versionManager.listVanillaVersions(); break;
        case 'paper': versions = await versionManager.listPaperVersions(); break;
        case 'purpur': versions = await versionManager.listPurpurVersions(); break;
        case 'forge': versions = await versionManager.listForgeVersions(); break;
        case 'fabric': versions = await versionManager.listFabricVersions(); break;
        case 'bds': versions = await versionManager.listBDSVersions(); break;
        default: return res.status(400).json({ error: 'Tipo inválido' });
      }
      res.json({ versions });
    } catch (e) {
      res.status(502).json({ error: `Falha ao buscar versões: ${e.message}` });
    }
  });

  // ---------- Mundos ----------
  app.get('/api/servers/:id/worlds', authenticateToken, (req, res) => {
    const worlds = worldManager.listWorlds(req.params.id);
    if (worlds.error) return res.status(404).json(worlds);
    res.json({ worlds });
  });

  app.post('/api/servers/:id/worlds/import', authenticateToken, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Arquivo .zip é obrigatório' });
    const worldName = req.body.name || 'world';
    const tmpFile = path.join(getConfig().serversDir, req.params.id, `.import_${Date.now()}.zip`);
    fs.writeFileSync(tmpFile, req.file.buffer);
    try {
      const result = await worldManager.importWorldFromZip(req.params.id, tmpFile, worldName);
      res.json(result);
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });

  app.post('/api/servers/:id/worlds/export/:worldName', authenticateToken, async (req, res) => {
    const result = await worldManager.exportWorld(req.params.id, req.params.worldName);
    if (result.error) return res.status(404).json(result);
    res.json(result);
  });

  // ---------- Backups ----------
  app.post('/api/servers/:id/backup', authenticateToken, async (req, res) => {
    const result = await serverManager.createBackup(req.params.id);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  });

  app.get('/api/servers/:id/backups', authenticateToken, (req, res) => {
    res.json({ backups: serverManager.listBackups(req.params.id) });
  });

  app.get('/api/servers/:id/backups/:name/download', authenticateToken, (req, res) => {
    const file = path.join(getConfig().backupsDir, req.params.id, req.params.name);
    // Proteção contra path traversal
    const resolved = path.resolve(file);
    if (!resolved.startsWith(path.resolve(getConfig().backupsDir))) {
      return res.status(400).json({ error: 'Caminho inválido' });
    }
    if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'Backup não encontrado' });
    res.download(resolved);
  });

  // ---------- Tunnel ----------
  app.get('/api/tunnel/status', authenticateToken, (req, res) => {
    res.json(tunnel.getStatus());
  });

  app.post('/api/tunnel/create', authenticateToken, adminOnly, async (req, res) => {
    const result = await tunnel.createTunnel(req.body.name || 'minecraft');
    if (result.error) return res.status(400).json(result);
    res.json(result);
  });

  app.post('/api/tunnel/generate', authenticateToken, adminOnly, (req, res) => {
    const ports = req.body.ports || [25565];
    const result = tunnel.generateConfig(ports, req.body.name);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  });

  app.post('/api/tunnel/start', authenticateToken, adminOnly, async (req, res) => {
    const result = await tunnel.startTunnel(req.body.name);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  });

  app.post('/api/tunnel/stop', authenticateToken, adminOnly, async (req, res) => {
    const result = await tunnel.stopTunnel();
    res.json(result);
  });

  app.get('/api/tunnel/dns/:domain', authenticateToken, (req, res) => {
    const instructions = tunnel.getDnsInstructions(req.params.domain);
    res.json(instructions);
  });

  // ---------- Status agregado (dashboard) ----------
  app.get('/api/dashboard', authenticateToken, (req, res) => {
    const servers = serverManager.getAllServers();
    const counts = {
      total: Object.keys(servers).length,
      running: Object.values(servers).filter(s => s.status === 'running').length,
      stopped: Object.values(servers).filter(s => s.status === 'stopped').length,
      players: Object.values(servers).reduce((acc, s) => acc + s.playerCount, 0)
    };
    res.json({
      counts,
      servers,
      system: getSystemInfo(),
      tunnel: tunnel.getStatus(),
      backupsCount: Object.values(servers).reduce((acc, s) => acc + (serverManager.listBackups(s.id) || []).length, 0)
    });
  });

  // ---------- Arquivos ----------
  app.get('/api/servers/:id/files', authenticateToken, (req, res) => {
    const dir = path.join(getConfig().serversDir, req.params.id);
    const sub = req.query.path || '';
    const target = path.resolve(path.join(dir, sub));
    if (!target.startsWith(path.resolve(dir))) {
      return res.status(400).json({ error: 'Caminho inválido' });
    }
    if (!fs.existsSync(target)) return res.status(404).json({ error: 'Diretório não encontrado' });
    const entries = fs.readdirSync(target, { withFileTypes: true }).map(e => {
      const full = path.join(target, e.name);
      let size = 0;
      if (e.isFile()) size = fs.statSync(full).size;
      return {
        name: e.name,
        type: e.isDirectory() ? 'dir' : 'file',
        size,
        sizeHuman: formatBytes(size),
        modified: fs.statSync(full).mtime.toISOString()
      };
    });
    res.json({ path: sub, files: entries });
  });

  app.get('/api/servers/:id/files/content', authenticateToken, (req, res) => {
    const dir = path.join(getConfig().serversDir, req.params.id);
    const target = path.resolve(path.join(dir, req.query.path || ''));
    if (!target.startsWith(path.resolve(dir))) return res.status(400).json({ error: 'Caminho inválido' });
    if (!fs.existsSync(target)) return res.status(404).json({ error: 'Arquivo não encontrado' });
    const size = fs.statSync(target).size;
    if (size > 1024 * 1024) return res.status(400).json({ error: 'Arquivo muito grande para visualizar' });
    res.json({ content: fs.readFileSync(target, 'utf8') });
  });

  app.put('/api/servers/:id/files/content', authenticateToken, (req, res) => {
    const dir = path.join(getConfig().serversDir, req.params.id);
    const target = path.resolve(path.join(dir, req.body.path || ''));
    if (!target.startsWith(path.resolve(dir))) return res.status(400).json({ error: 'Caminho inválido' });
    fs.writeFileSync(target, req.body.content);
    res.json({ success: true });
  });

  app.post('/api/servers/:id/files/upload', authenticateToken, upload.single('file'), (req, res) => {
    const dir = path.join(getConfig().serversDir, req.params.id);
    const sub = req.body.path || '';
    const targetDir = path.resolve(path.join(dir, sub));
    if (!targetDir.startsWith(path.resolve(dir))) return res.status(400).json({ error: 'Caminho inválido' });
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    const dest = path.join(targetDir, req.file.originalname);
    fs.writeFileSync(dest, req.file.buffer);
    res.json({ success: true, name: req.file.originalname, size: req.file.size });
  });

  app.delete('/api/servers/:id/files', authenticateToken, (req, res) => {
    const dir = path.join(getConfig().serversDir, req.params.id);
    const target = path.resolve(path.join(dir, req.query.path || ''));
    if (!target.startsWith(path.resolve(dir))) return res.status(400).json({ error: 'Caminho inválido' });
    if (target === path.resolve(dir)) return res.status(400).json({ error: 'Não é possível apagar a raiz' });
    fs.rmSync(target, { recursive: true, force: true });
    res.json({ success: true });
  });

  return app;
}

module.exports = { createApi };