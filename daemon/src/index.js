// ============================================
// MCForge Daemon - Ponto de Entrada
// Sistema de hospedagem de Minecraft gratuito
// ============================================
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');
const { log, ensureDir } = require('./utils');
const { getConfig, ensureDataDirs, getSystemInfo } = require('./config');
const { createApi } = require('./api');
const { setupWebSocket } = require('./websocket');
const { autoBootstrap } = require('./installer');
const serverManager = require('./server-manager');

const BANNER = `
  __  __  ____  _____                 _            
 |  \\/  |/ ___||  ___| __ ___  _ __ | |_ ___ _ __ 
 | |\\/| | |    | |_ | '__/ _ \\| '_ \\| __/ _ \\ '__|
 | |  | | |___ |  _|| | | (_) | | | | ||  __/ |   
 |_|  |_|\\____||_|  |_|  \\___/|_| |_|\\__\\___|_|   
                                                   
  MCForge All-in-One - Painel e Servidor Integrados
`;

async function main() {
  console.log(BANNER);
  ensureDataDirs();

  // Instala e garante ferramentas automaticamente (Cloudflared, Java, Build do Painel)
  try {
    await autoBootstrap();
  } catch (err) {
    log('warn', `Aviso durante bootstrap automático: ${err.message}`);
  }

  const config = getConfig();
  log('info', `Sistema: ${os.platform()} ${os.arch()} | CPU: ${os.cpus().length} núcleos | RAM: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)}GB`);
  log('info', `Java: ${getSystemInfo().javaAvailable || 'Verificando/Detectado'}`);
  log('info', `cloudflared: ${getSystemInfo().cloudflaredAvailable ? 'Pronto' : 'Disponível via auto-download'}`);

  const app = createApi();

  // Servir o painel React compilado em um único site (Single-Site Architecture)
  const panelDist = path.join(__dirname, '..', '..', 'panel', 'dist');
  if (fs.existsSync(panelDist)) {
    app.use(express.static(panelDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
      const indexPath = path.join(panelDist, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        next();
      }
    });
    log('info', `Painel web integrado servido em: http://localhost:${config.port}`);
  } else {
    log('warn', 'Painel React não encontrado em panel/dist. O autoBootstrap tentará compilar.');
  }

  const server = http.createServer(app);
  setupWebSocket(server, serverManager);

  server.listen(config.port, '0.0.0.0', () => {
    log('success', `Daemon rodando em http://localhost:${config.port}`);
    log('info', `Painel web: abra http://localhost:${config.port} no navegador`);
    if (!require('./config').hasPassword()) {
      log('warn', 'Nenhuma senha definida. Faça login no painel para definir a senha mestre!');
    }

    // Auto-start de servidores configurados
    const servers = serverManager.getAllServers();
    for (const [id, s] of Object.entries(servers)) {
      if (s.autoStart && s.status === 'stopped') {
        log('info', `Auto-start do servidor ${s.name}...`);
        setTimeout(() => serverManager.startServer(id), 3000);
      }
    }

    // Verificação periódica de backups automáticos
    setInterval(() => {
      const now = Date.now();
      for (const [id, s] of Object.entries(serverManager.getAllServers())) {
        if (s.backupEnabled && s.status === 'running') {
          const interval = (s.backupIntervalHours || 6) * 3600 * 1000;
          const last = s.lastBackupAt ? new Date(s.lastBackupAt).getTime() : 0;
          if (now - last > interval) {
            log('info', `Backup automático do servidor ${s.name}...`);
            serverManager.createBackup(id).then((r) => {
              if (r.success) {
                const { getServers, saveServers } = require('./config');
                const servers2 = getServers();
                if (servers2[id]) {
                  servers2[id].lastBackupAt = new Date().toISOString();
                  saveServers(servers2);
                }
              }
            });
          }
        }
      }
    }, 60 * 1000);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      log('error', `Porta ${config.port} já está em uso! Mude DAEMON_PORT no arquivo .env`);
      process.exit(1);
    }
    log('error', `Erro no servidor: ${err.message}`);
  });

  // Shutdown limpo
  process.on('SIGINT', async () => {
    log('warn', 'Encerrando daemon...');
    const servers = serverManager.getAllServers();
    for (const [id, s] of Object.entries(servers)) {
      if (s.status === 'running') {
        log('info', `Parando ${s.name}...`);
        await serverManager.stopServer(id);
      }
    }
    process.exit(0);
  });
}

main().catch((e) => {
  log('error', `Erro fatal: ${e.stack || e.message}`);
  process.exit(1);
});