// ============================================
// MCForge Daemon - WebSocket (console em tempo real)
// ============================================
const { WebSocketServer } = require('ws');
const { verifyToken } = require('./auth');
const { log } = require('./utils');

function setupWebSocket(server, serverManager) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    // Autenticar via token na query string
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    const decoded = token ? verifyToken(token) : null;

    if (!decoded) {
      ws.send(JSON.stringify({ type: 'error', message: 'Não autenticado' }));
      ws.close(1008, 'Não autenticado');
      return;
    }

    log('info', `WebSocket conectado: ${decoded.sub} (${decoded.role})`);

    // Enviar estado inicial
    const servers = serverManager.getAllServers();
    ws.send(JSON.stringify({ type: 'init', servers }));

    // Enviar últimos logs de todos os servidores
    for (const [id, s] of Object.entries(servers)) {
      const logs = serverManager.getLogs(id, 30);
      if (logs.length) {
        ws.send(JSON.stringify({ type: 'logs', id, logs }));
      }
    }

    // Receber comandos
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'command') {
          const result = serverManager.sendCommand(msg.serverId, msg.command);
          if (result.error) ws.send(JSON.stringify({ type: 'error', message: result.error }));
        } else if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', time: Date.now() }));
        }
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', message: 'Mensagem inválida' }));
      }
    });

    ws.on('close', () => {
      log('debug', 'WebSocket desconectado');
    });
  });

  // Broadcast de eventos do serverManager para todos os clientes
  const clients = () => Array.from(wss.clients).filter(c => c.readyState === 1);

  serverManager.on('log', ({ id, line, command, time }) => {
    for (const client of clients()) {
      client.send(JSON.stringify({ type: 'log', id, line, command, time }));
    }
  });

  serverManager.on('status', ({ id, status, code, signal }) => {
    for (const client of clients()) {
      client.send(JSON.stringify({ type: 'status', id, status, code, signal }));
    }
  });

  serverManager.on('player', ({ id, player, action }) => {
    for (const client of clients()) {
      client.send(JSON.stringify({ type: 'player', id, player, action }));
    }
  });

  serverManager.on('stats', ({ id, memory, cpu }) => {
    for (const client of clients()) {
      client.send(JSON.stringify({ type: 'stats', id, memory, cpu }));
    }
  });

  return wss;
}

module.exports = { setupWebSocket };