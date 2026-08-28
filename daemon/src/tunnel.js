// ============================================
// MCForge Daemon - Cloudflare Tunnel
// Proteção DDoS, domínio personalizado e TLS via Cloudflare (grátis)
// ============================================
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { log, ensureDir, readJson, writeJson } = require('./utils');
const { getConfig } = require('./config');

class TunnelManager {
  constructor() {
    this.process = null;
    this.status = 'stopped';
    this.tunnelName = null;
    this.tunnelUrl = null;
    this.startTimer = null;
  }

  getStatus() {
    return {
      status: this.status,
      tunnelName: this.tunnelName,
      tunnelUrl: this.tunnelUrl,
      installed: this.isInstalled()
    };
  }

  isInstalled() {
    try {
      const { execSync } = require('child_process');
      execSync(`"${getConfig().cloudflaredPath}" --version`, { timeout: 5000, stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  // Verifica se já está logado no Cloudflare
  isLoggedIn() {
    try {
      const { execSync } = require('child_process');
      const out = execSync(`"${getConfig().cloudflaredPath}" tunnel list`, { timeout: 15000 }).toString();
      return !out.includes('Unauthorized') && !out.toLowerCase().includes('login required');
    } catch {
      return false;
    }
  }

  // Gera o comando de login para o usuário executar
  getLoginCommand() {
    return `"${getConfig().cloudflaredPath}" tunnel login`;
  }

  // Cria o tunnel (com nome) e retorna credenciais
  async createTunnel(name) {
    if (!this.isInstalled()) {
      return { error: 'cloudflared não está instalado. Execute o script de setup primeiro.' };
    }
    if (!this.isLoggedIn()) {
      return { error: `Cloudflared não está logado. Execute: ${this.getLoginCommand()}` };
    }

    const { execSync } = require('child_process');
    try {
      execSync(`"${getConfig().cloudflaredPath}" tunnel create ${name}`, { timeout: 30000, stdio: 'pipe' });
      this.tunnelName = name;
      log('success', `Tunnel Cloudflare "${name}" criado!`);
      return { success: true, name };
    } catch (e) {
      // Tunnel já existe?
      if (e.message && e.message.includes('already exists')) {
        this.tunnelName = name;
        return { success: true, name, exists: true };
      }
      return { error: `Falha ao criar tunnel: ${e.message}` };
    }
  }

  // Gera arquivo de config do tunnel apontando para o daemon
  generateConfig(serverPorts = [25565], tunnelName) {
    const config = getConfig();
    const name = tunnelName || this.tunnelName || 'minecraft';
    const userDir = process.env.USERPROFILE || process.env.HOME;
    const cfDir = path.join(userDir, '.cloudflared');

    // Cloudflared salva credenciais como <tunnel-id>.json (não pelo nome).
    // Procuramos o arquivo de credenciais mais recente.
    let credsPath = path.join(cfDir, `${name}.json`);
    if (!fs.existsSync(credsPath) && fs.existsSync(cfDir)) {
      const candidates = fs.readdirSync(cfDir)
        .filter(f => f.endsWith('.json') && f !== 'cert.pem')
        .map(f => path.join(cfDir, f))
        .filter(p => fs.statSync(p).isFile());
      // Escolher o mais recente
      candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
      if (candidates.length) credsPath = candidates[0];
    }
    if (!fs.existsSync(credsPath)) {
      return { error: `Credenciais do tunnel não encontradas em ${cfDir}. Execute o login e crie o tunnel.` };
    }

    const creds = readJson(credsPath);
    const configDir = path.join(__dirname, '..', 'config');
    ensureDir(configDir);
    const configFile = path.join(configDir, 'tunnel.yml');

    // Cada porta do servidor vira um ingress TCP
    const ingress = serverPorts.map(port => ({
      service: `tcp://localhost:${port}`
    }));
    ingress.push({ service: 'http_status:404' });

    const yaml = `tunnel: ${name}
credentials-file: ${credsPath.replace(/\\/g, '/')}

ingress:
${ingress.map(i => `  - service: ${i.service}`).join('\n')}
`;
    fs.writeFileSync(configFile, yaml);
    log('success', `Config do tunnel gerado em ${configFile}`);
    return { success: true, configFile };
  }

  // Inicia o tunnel (processo cloudflared)
  async startTunnel(name) {
    if (this.process) {
      return { error: 'Tunnel já está em execução' };
    }

    const config = getConfig();
    const tunnelName = name || this.tunnelName;
    if (!tunnelName) {
      return { error: 'Nenhum tunnel configurado. Crie um tunnel primeiro.' };
    }

    const configFile = path.join(__dirname, '..', 'config', 'tunnel.yml');
    if (!fs.existsSync(configFile)) {
      return { error: 'Config do tunnel não encontrado. Gere a config primeiro.' };
    }

    log('info', `Iniciando Cloudflare Tunnel "${tunnelName}"...`);
    const child = spawn(`"${config.cloudflaredPath}"`, ['tunnel', '--config', configFile, 'run', tunnelName], {
      shell: true,
      windowsHide: true
    });

    this.process = child;
    this.status = 'starting';

    child.stdout.on('data', (d) => {
      const text = d.toString();
      const urlMatch = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (urlMatch) this.tunnelUrl = urlMatch[0];
      log('debug', `[tunnel] ${text.trim().slice(0, 200)}`);
    });
    child.stderr.on('data', (d) => {
      const text = d.toString();
      log('debug', `[tunnel] ${text.trim().slice(0, 200)}`);
    });
    child.on('exit', (code) => {
      log('warn', `Tunnel encerrado (code=${code})`);
      this.status = 'stopped';
      this.process = null;
    });

    // Após 8s, verificar se está rodando
    await new Promise(r => setTimeout(r, 8000));
    if (this.process && this.process.exitCode === null) {
      this.status = 'running';
      log('success', `Tunnel rodando!`);
      return { success: true, status: 'running' };
    }
    this.status = 'stopped';
    return { error: 'Tunnel falhou ao iniciar' };
  }

  async stopTunnel() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.status = 'stopped';
    log('info', 'Tunnel parado');
    return { success: true };
  }

  // Roteiro de DNS: instruções para o domínio personalizado
  getDnsInstructions(domain, port = 25565) {
    return {
      cname: {
        type: 'CNAME',
        name: domain,
        target: `${this.tunnelName || 'minecraft'}.cfargotunnel.com`,
        proxied: true
      },
      srv: {
        // Para Minecraft: apontar SRV para o domínio (via Cloudflare proxy)
        type: 'SRV',
        name: `_minecraft._tcp.${domain}`,
        content: `0 5 ${port} ${domain}`
      },
      notes: [
        '1. Adicione o domínio no Cloudflare (plano Free)',
        '2. Crie o registro CNAME apontando para o tunnel',
        '3. Os jogadores conectam usando: ' + domain,
        '4. A proteção DDoS e TLS ficam por conta do Cloudflare',
        '5. Para Bedrock (porta 19132), use um registro SRV separado'
      ]
    };
  }
}

module.exports = new TunnelManager();