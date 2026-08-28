// ============================================
// MCForge Daemon - Gerenciador de Servidores
// Controla processos de servidores Minecraft (start/stop/restart/console)
// ============================================
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { log, ensureDir, readJson, writeJson, stripAnsi, formatBytes, formatUptime } = require('./utils');
const { getConfig } = require('./config');
const { downloadServer, downloadFile } = require('./version-manager');

class ServerManager extends EventEmitter {
  constructor() {
    super();
    this.processes = {}; // id -> child process
    this.states = {}; // id -> { status, startedAt, players: Set, logs: [], pid, memory }
    this.autoRestartTimers = {};
    this.monitorTimers = {};
  }

  // ---------- CRUD ----------
  getAllServers() {
    const { getServers } = require('./config');
    const servers = getServers();
    const result = {};
    for (const [id, s] of Object.entries(servers)) {
      result[id] = this.attachRuntimeInfo(id, s);
    }
    return result;
  }

  getServer(id) {
    const { getServers } = require('./config');
    const servers = getServers();
    const s = servers[id];
    if (!s) return null;
    return this.attachRuntimeInfo(id, s);
  }

  attachRuntimeInfo(id, server) {
    const state = this.states[id];
    const isRunning = this.isRunning(id);
    return {
      ...server,
      id,
      status: isRunning ? 'running' : (state && state.stopping ? 'stopping' : 'stopped'),
      startedAt: state ? state.startedAt : null,
      uptime: state ? formatUptime(Date.now() - state.startedAt) : '0s',
      players: state ? Array.from(state.players) : [],
      playerCount: state ? state.players.size : 0,
      pid: state ? state.pid : null,
      memory: state ? state.memory : null,
      cpu: state ? state.cpu : null,
      lastLogs: state ? state.logs.slice(-50) : []
    };
  }

  async createServer(data) {
    const { getServers, saveServers } = require('./config');
    const servers = getServers();
    const id = `srv_${Date.now().toString(36)}`;
    const dir = path.join(getConfig().serversDir, id);

    ensureDir(dir);

    const server = {
      name: data.name || `Servidor ${Object.keys(servers).length + 1}`,
      type: data.type || 'vanilla',      // vanilla | paper | purpur | forge | fabric | neoforge | bds | velocity
      version: data.version || 'latest',
      javaArgs: data.javaArgs || `-Xms${data.minRam || '1G'} -Xmx${data.maxRam || '2G'}`,
      port: parseInt(data.port || 25565, 10),
      autoRestart: data.autoRestart !== undefined ? !!data.autoRestart : getConfig().autoRestart,
      autoStart: !!data.autoStart,
      minRam: data.minRam || '1G',
      maxRam: data.maxRam || '2G',
      status: 'stopped',
      createdAt: new Date().toISOString(),
      motd: data.motd || 'MCForge Server',
      gamemode: data.gamemode || 'survival',
      difficulty: data.difficulty || 'normal',
      pvp: data.pvp !== undefined ? !!data.pvp : true,
      onlineMode: data.onlineMode !== undefined ? !!data.onlineMode : true,
      whitelist: data.whitelist || [],
      ops: data.ops || [],
      banned: data.banned || [],
      plugins: [],       // plugins/mods instalados
      worlds: [],        // mundos disponíveis
      backupEnabled: data.backupEnabled !== undefined ? !!data.backupEnabled : true,
      backupIntervalHours: data.backupIntervalHours || 6,
      icon: data.icon || null,
      geyser: !!data.geyser,  // habilitar suporte Bedrock
      owner: data.owner || 'admin',
      properties: {
        motd: data.motd || 'MCForge Server',
        gamemode: data.gamemode || 'survival',
        difficulty: data.difficulty || 'normal',
        pvp: data.pvp !== undefined ? !!data.pvp : true,
        onlineMode: data.onlineMode !== undefined ? !!data.onlineMode : true,
        viewDistance: data.viewDistance || 10,
        maxPlayers: data.maxPlayers || 20,
        spawnProtection: data.spawnProtection || 16,
        allowNether: true,
        enableCommandBlock: data.enableCommandBlock || false,
        hardcore: !!data.hardcore,
        whiteList: !!((data.whitelist || []).length)
      }
    };

    servers[id] = server;
    saveServers(servers);

    // Criar estrutura de diretórios
    ensureDir(path.join(dir, 'plugins'));
    ensureDir(path.join(dir, 'worlds'));
    ensureDir(path.join(dir, 'backups'));
    ensureDir(path.join(dir, 'config'));

    log('success', `Servidor criado: ${server.name} (${id}) [${server.type} ${server.version}]`);
    return { id, ...this.attachRuntimeInfo(id, server) };
  }

  async deleteServer(id) {
    const { getServers, saveServers } = require('./config');
    await this.stopServer(id);
    const servers = getServers();
    if (!servers[id]) return false;
    delete servers[id];
    saveServers(servers);
    log('info', `Servidor ${id} removido (arquivos mantidos em disco)`);
    return true;
  }

  async updateServer(id, patch) {
    const { getServers, saveServers } = require('./config');
    const servers = getServers();
    if (!servers[id]) return null;
    const allowed = ['name', 'javaArgs', 'port', 'autoRestart', 'autoStart', 'minRam', 'maxRam',
      'motd', 'gamemode', 'difficulty', 'pvp', 'onlineMode', 'maxPlayers', 'viewDistance',
      'spawnProtection', 'allowNether', 'enableCommandBlock', 'hardcore', 'icon',
      'backupEnabled', 'backupIntervalHours', 'geyser'];
    for (const key of Object.keys(patch)) {
      if (allowed.includes(key)) servers[id][key] = patch[key];
    }
    // Reconstruir javaArgs quando minRam/maxRam mudam
    if (patch.minRam || patch.maxRam) {
      servers[id].javaArgs = `-Xms${servers[id].minRam || '1G'} -Xmx${servers[id].maxRam || '2G'}`;
    }
    // Propriedades do server.properties
    if (servers[id].properties) {
      const propMap = { motd: 'motd', gamemode: 'gamemode', difficulty: 'difficulty', pvp: 'pvp',
        onlineMode: 'online-mode', viewDistance: 'view-distance', maxPlayers: 'max-players',
        spawnProtection: 'spawn-protection', allowNether: 'allow-nether',
        enableCommandBlock: 'enable-command-block', hardcore: 'hardcore', whiteList: 'white-list' };
      for (const [key, prop] of Object.entries(propMap)) {
        if (patch[key] !== undefined) servers[id].properties[key] = patch[key];
      }
    }
    saveServers(servers);
    this.writeServerProperties(id, servers[id]);
    log('info', `Servidor ${id} atualizado`);
    return servers[id];
  }

  getServerDir(id) {
    return path.join(getConfig().serversDir, id);
  }

  isRunning(id) {
    const proc = this.processes[id];
    return !!(proc && proc.exitCode === null && !proc.killed);
  }

  // ---------- Start / Stop ----------
  async startServer(id) {
    if (this.isRunning(id)) return { error: 'Servidor já está em execução' };

    const server = this.getServer(id);
    if (!server) return { error: 'Servidor não encontrado' };

    const dir = this.getServerDir(id);
    ensureDir(dir);

    // Instalar servidor se não existir
    const jarFiles = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.jar')) : [];
    if (jarFiles.length === 0) {
      log('info', `Baixando software do servidor ${server.type} ${server.version}...`);
      try {
        const dl = await downloadServer(server.type, server.version, dir);
        if (dl.fileName.endsWith('.zip')) {
          // BDS: extrair zip
          await this.extractZip(path.join(dir, dl.fileName), dir);
        }
      } catch (e) {
        log('error', `Falha ao baixar servidor: ${e.message}`);
        return { error: `Falha ao baixar o servidor: ${e.message}` };
      }
    }

    // Forge/NeoForge: precisa rodar installer primeiro
    if (server.type === 'forge' || server.type === 'neoforge') {
      const installer = fs.readdirSync(dir).find(f => f.includes('installer'));
      if (installer) {
        log('info', 'Executando instalador Forge/NeoForge...');
        try {
          execSync(`"${this.getJavaBin()}" -jar "${path.join(dir, installer)}" --installServer`, {
            cwd: dir, stdio: 'ignore', timeout: 300000
          });
        } catch (e) {
          log('warn', `Instalador Forge retornou com aviso (normal): ${e.message}`);
        }
      }
    }

    // BDS (Bedrock): executar bedrock_server.exe
    const isBedrock = server.type === 'bds';
    let cmd, args;
    if (isBedrock) {
      const exe = fs.existsSync(path.join(dir, 'bedrock_server.exe')) ? 'bedrock_server.exe' : null;
      if (!exe) return { error: 'Executável bedrock_server.exe não encontrado' };
      cmd = path.join(dir, exe);
      args = [];
    } else {
      // Encontrar o jar principal
      let mainJar = jarFiles.find(f => f.startsWith('paper-')) ||
        jarFiles.find(f => f.startsWith('purpur-')) ||
        jarFiles.find(f => f.startsWith('fabric-server')) ||
        jarFiles.find(f => f.startsWith('forge-') && !f.includes('installer')) ||
        jarFiles.find(f => f.startsWith('neoforge-') && !f.includes('installer')) ||
        jarFiles.find(f => f.startsWith('server-')) ||
        jarFiles.find(f => f.endsWith('.jar'));
      if (!mainJar) {
        // Re-checar após instalação
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.jar'));
        mainJar = files.find(f => !f.includes('installer'));
      }
      if (!mainJar) return { error: 'Nenhum jar de servidor encontrado' };
      cmd = this.getJavaBin();
      args = [...server.javaArgs.split(/\s+/).filter(Boolean), '-jar', mainJar, 'nogui'];
    }

    // Aceitar EULA automaticamente para o servidor nunca parar
    try {
      fs.writeFileSync(path.join(dir, 'eula.txt'), 'eula=true\n');
      this.writeServerProperties(id, server);
    } catch (e) {
      log('warn', `Erro ao gravar eula/properties: ${e.message}`);
    }

    log('info', `Iniciando servidor ${server.name} (${id})...`);
    const child = spawn(cmd, args, { cwd: dir, shell: false });
    this.processes[id] = child;

    const state = {
      status: 'running',
      startedAt: Date.now(),
      pid: child.pid,
      players: new Set(),
      logs: [],
      memory: null,
      cpu: null,
      stopping: false
    };
    this.states[id] = state;

    child.stdout.on('data', (chunk) => this.handleOutput(id, chunk.toString()));
    child.stderr.on('data', (chunk) => this.handleOutput(id, chunk.toString()));
    child.on('exit', (code, signal) => this.handleExit(id, code, signal));

    this.startMonitor(id);
    this.emit('status', { id, status: 'running' });
    return { success: true, pid: child.pid };
  }

  async stopServer(id) {
    const child = this.processes[id];
    if (!child || child.exitCode !== null) {
      this.cleanupState(id);
      return { success: true, alreadyStopped: true };
    }

    log('info', `Parando servidor ${id}...`);
    if (this.states[id]) this.states[id].stopping = true;

    return new Promise((resolve) => {
      // Enviar comando stop ao servidor primeiro
      try {
        child.stdin.write('stop\n');
      } catch {}

      const forceTimer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch {}
      }, 30000); // Força encerramento após 30s

      child.on('exit', (code, signal) => {
        clearTimeout(forceTimer);
        resolve({ success: true, code, signal });
      });
    });
  }

  async restartServer(id) {
    await this.stopServer(id);
    // Aguardar processo encerrar
    await new Promise(r => setTimeout(r, 1500));
    return this.startServer(id);
  }

  // ---------- Console ----------
  sendCommand(id, command) {
    const child = this.processes[id];
    if (!child || child.exitCode !== null) {
      return { error: 'Servidor não está em execução' };
    }
    try {
      child.stdin.write(command + '\n');
      this.addLog(id, `> ${command}`, true);
      return { success: true };
    } catch (e) {
      return { error: e.message };
    }
  }

  getLogs(id, limit = 100) {
    const state = this.states[id];
    if (!state) return [];
    return state.logs.slice(-limit);
  }

  addLog(id, line, isCommand = false) {
    const state = this.states[id];
    if (!state) return;
    const clean = stripAnsi(line);
    if (!clean.trim()) return;
    state.logs.push({ time: new Date().toISOString(), text: clean, command: isCommand });
    if (state.logs.length > 5000) state.logs.splice(0, state.logs.length - 5000);
    this.emit('log', { id, line: clean, command: isCommand, time: state.logs[state.logs.length - 1].time });
  }

  handleOutput(id, chunk) {
    const lines = chunk.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      this.addLog(id, line);
      // Detectar jogadores
      const join = line.match(/^\[.*\] (\w+) joined the game/);
      const leave = line.match(/^\[.*\] (\w+) left the game/);
      const state = this.states[id];
      if (!state) continue;
      if (join) {
        state.players.add(join[1]);
        this.emit('player', { id, player: join[1], action: 'join' });
      }
      if (leave) {
        state.players.delete(leave[1]);
        this.emit('player', { id, player: leave[1], action: 'leave' });
      }
    }
  }

  handleExit(id, code, signal) {
    const state = this.states[id];
    log('warn', `Servidor ${id} encerrou (code=${code}, signal=${signal})`);
    this.addLog(id, `[SERVIDOR ENCERRADO] code=${code}`);
    if (state) state.status = 'stopped';
    this.stopMonitor(id);
    this.processes[id] = null;
    this.emit('status', { id, status: 'stopped', code, signal });

    // Auto-restart (exceto se foi parada manual)
    const server = this.getServer(id);
    if (server && server.autoRestart && !(state && state.stopping) && code !== 0) {
      log('info', `Auto-restart do servidor ${id} em 5s...`);
      setTimeout(() => this.startServer(id), 5000);
    }
  }

  cleanupState(id) {
    this.stopMonitor(id);
    this.processes[id] = null;
  }

  // ---------- Monitoramento de recursos ----------
  startMonitor(id) {
    this.stopMonitor(id);
    this.monitorTimers[id] = setInterval(() => {
      const child = this.processes[id];
      if (!child || child.exitCode !== null) return;
      try {
        // Leitura de memória (Windows via wmic/powershell, Linux via /proc)
        let memory = null, cpu = null;
        if (process.platform === 'win32') {
          const out = execSync(`powershell -NoProfile -Command "Get-Process -Id ${child.pid} | Select-Object -ExpandProperty WorkingSet64"`, { timeout: 5000 }).toString().trim();
          memory = parseInt(out, 10);
        } else if (process.platform === 'linux') {
          const out = execSync(`ps -o rss= -p ${child.pid}`, { timeout: 5000 }).toString().trim();
          memory = parseInt(out, 10) * 1024;
        }
        const state = this.states[id];
        if (state) { state.memory = memory; state.cpu = cpu; }
        this.emit('stats', { id, memory, cpu });
      } catch {
        // Processo pode ter morrido
      }
    }, 10000);
  }

  stopMonitor(id) {
    if (this.monitorTimers[id]) {
      clearInterval(this.monitorTimers[id]);
      delete this.monitorTimers[id];
    }
  }

  getJavaBin() {
    const { getConfig } = require('./config');
    const cfg = getConfig();
    if (cfg.javaPath) return cfg.javaPath;
    return 'java';
  }

  // ---------- server.properties ----------
  writeServerProperties(id, server) {
    const dir = this.getServerDir(id);
    ensureDir(dir);
    const props = server.properties || {};
    const lines = [
      'motd=' + (props.motd || server.motd || 'MCForge Server'),
      'gamemode=' + (props.gamemode || 'survival'),
      'difficulty=' + (props.difficulty || 'normal'),
      'pvp=' + (props.pvp !== undefined ? props.pvp : true),
      'online-mode=' + (props.onlineMode !== undefined ? props.onlineMode : true),
      'max-players=' + (props.maxPlayers || 20),
      'view-distance=' + (props.viewDistance || 10),
      'spawn-protection=' + (props.spawnProtection || 16),
      'allow-nether=' + (props.allowNether !== undefined ? props.allowNether : true),
      'enable-command-block=' + (props.enableCommandBlock || false),
      'hardcore=' + (props.hardcore || false),
      'white-list=' + (props.whiteList || false),
      'server-port=' + (server.port || 25565),
      'level-name=' + (server.levelName || 'world'),
      'enable-query=false',
      'enable-rcon=false',
      'enforce-secure-profile=false'
    ];
    fs.writeFileSync(path.join(dir, 'server.properties'), lines.join('\n'));
  }

  // ---------- eula.txt ----------
  acceptEula(id) {
    const dir = this.getServerDir(id);
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, 'eula.txt'), 'eula=true\n');
    return { success: true };
  }

  // ---------- Whitelist / Ops / Ban ----------
  updatePlayerList(id, kind, player, action) {
    const { getServers, saveServers } = require('./config');
    const servers = getServers();
    const server = servers[id];
    if (!server) return { error: 'Servidor não encontrado' };

    const validKinds = ['whitelist', 'ops', 'banned'];
    if (!validKinds.includes(kind)) return { error: 'Tipo inválido' };

    if (action === 'add') {
      if (!server[kind].includes(player)) server[kind].push(player);
    } else if (action === 'remove') {
      server[kind] = server[kind].filter(p => p !== player);
    }
    saveServers(servers);

    // Aplicar comandos no servidor se estiver rodando
    const cmds = { whitelist: ['whitelist add', 'whitelist remove'], ops: ['op', 'deop'], banned: ['ban', 'pardon'] };
    const [addCmd, removeCmd] = cmds[kind];
    if (this.isRunning(id)) {
      this.sendCommand(id, action === 'add' ? `${addCmd} ${player}` : `${removeCmd} ${player}`);
    }
    return { success: true, list: server[kind] };
  }

  // ---------- Backup ----------
  async createBackup(id) {
    const server = this.getServer(id);
    if (!server) return { error: 'Servidor não encontrado' };
    const dir = this.getServerDir(id);
    const backupsDir = path.join(getConfig().backupsDir, id);
    ensureDir(backupsDir);

    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const fileName = `backup-${server.name.replace(/[^a-zA-Z0-9-_]/g, '_')}-${stamp}.zip`;
    const dest = path.join(backupsDir, fileName);

    log('info', `Criando backup de ${server.name}...`);
    const archiver = require('archiver');
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(dest);
      const archive = archiver('zip', { zlib: { level: 9 } });
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(dir, false);
      archive.finalize();
    });

    // Lista backups
    const backups = this.listBackups(id);
    log('success', `Backup criado: ${fileName}`);
    return { success: true, file: fileName, size: fs.statSync(dest).size, backups };
  }

  listBackups(id) {
    const backupsDir = path.join(getConfig().backupsDir, id);
    if (!fs.existsSync(backupsDir)) return [];
    return fs.readdirSync(backupsDir)
      .filter(f => f.endsWith('.zip'))
      .map(f => {
        const st = fs.statSync(path.join(backupsDir, f));
        return { name: f, size: st.size, sizeHuman: formatBytes(st.size), createdAt: st.mtime.toISOString() };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // ---------- Extração de zip (BDS) ----------
  async extractZip(zipPath, destDir) {
    const { execSync } = require('child_process');
    if (process.platform === 'win32') {
      execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, { timeout: 120000 });
    } else {
      execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { timeout: 120000 });
    }
    fs.unlinkSync(zipPath);
  }
}

module.exports = new ServerManager();