// ============================================
// MCForge Daemon - Gerenciador de Mundos (Maps)
// Lista, importa, exporta e faz backup de mundos
// ============================================
const fs = require('fs');
const path = require('path');
const { log, ensureDir, formatBytes } = require('./utils');
const { getConfig } = require('./config');
const { downloadFile } = require('./version-manager');

const MODRINTH_API = 'https://api.modrinth.com/v2';
const PLANETMC = 'https://www.planetminecraft.com';

// ---------- Listar mundos de um servidor ----------
function listWorlds(serverId) {
  const { getServers } = require('./config');
  const servers = getServers();
  const server = servers[serverId];
  if (!server) return { error: 'Servidor não encontrado' };

  const dir = path.join(getConfig().serversDir, serverId);
  if (!fs.existsSync(dir)) return [];

  // Diretórios de mundo (contêm level.dat)
  const worlds = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const worldDir = path.join(dir, entry.name);
    const levelDat = path.join(worldDir, 'level.dat');
    if (fs.existsSync(levelDat)) {
      const st = fs.statSync(worldDir);
      const size = dirSize(worldDir);
      worlds.push({
        name: entry.name,
        size,
        sizeHuman: formatBytes(size),
        modified: st.mtime.toISOString(),
        players: server.players || [],
        isDefault: entry.name === (server.levelName || 'world'),
        regionFiles: countFiles(worldDir, /\.(mca|mcc)$/)
      });
    }
  }
  return worlds;
}

function dirSize(dir) {
  let size = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) size += dirSize(full);
      else if (e.isFile()) size += fs.statSync(full).size;
    }
  } catch {}
  return size;
}

function countFiles(dir, pattern) {
  let count = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) count += countFiles(full, pattern);
      else if (e.isFile() && pattern.test(e.name)) count++;
    }
  } catch {}
  return count;
}

// ---------- Importar mundo de um zip ----------
async function importWorldFromZip(serverId, zipPath, worldName) {
  const { getServers, saveServers } = require('./config');
  const servers = getServers();
  const server = servers[serverId];
  if (!server) return { error: 'Servidor não encontrado' };

  const destDir = path.join(getConfig().serversDir, serverId);
  ensureDir(destDir);
  const targetName = worldName || 'world';

  const { execSync } = require('child_process');
  const tempDir = path.join(destDir, '.import_tmp');
  ensureDir(tempDir);

  if (process.platform === 'win32') {
    execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempDir}' -Force"`, { timeout: 300000 });
  } else {
    execSync(`unzip -o "${zipPath}" -d "${tempDir}"`, { timeout: 300000 });
  }

  // Encontrar o nível (pasta com level.dat)
  let levelDir = null;
  function findLevel(dir) {
    if (fs.existsSync(path.join(dir, 'level.dat'))) return dir;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) {
        const found = findLevel(path.join(dir, e.name));
        if (found) return found;
      }
    }
    return null;
  }

  levelDir = findLevel(tempDir);
  if (!levelDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    return { error: 'Nenhum mundo válido encontrado no arquivo (level.dat não encontrado)' };
  }

  // Mover para o destino
  const finalPath = path.join(destDir, targetName);
  if (fs.existsSync(finalPath)) fs.rmSync(finalPath, { recursive: true, force: true });
  fs.renameSync(levelDir, finalPath);
  fs.rmSync(tempDir, { recursive: true, force: true });

  log('success', `Mundo "${targetName}" importado no servidor ${serverId}`);
  return { success: true, world: targetName };
}

// ---------- Download de mapas do Modrinth ----------
async function searchWorlds(query, options = {}) {
  const params = new URLSearchParams({
    query,
    limit: String(options.limit || 20),
    index: options.index || 'downloads'
  });
  params.set('facets', JSON.stringify([['project_type:modpack'], ['categories:world']]));

  const res = await fetch(`${MODRINTH_API}/search?${params}`, {
    headers: { 'User-Agent': 'MCForge-Daemon/1.0' }
  });
  if (!res.ok) throw new Error(`Erro ao buscar mundos: HTTP ${res.status}`);
  const data = await res.json();
  return data.hits.map(h => ({
    source: 'modrinth',
    id: h.project_id,
    slug: h.slug,
    title: h.title,
    description: h.description,
    author: h.author,
    downloads: h.downloads,
    icon: h.icon_url,
    gameVersions: h.game_versions,
    url: `https://modrinth.com/modpack/${h.slug}`
  }));
}

async function downloadWorldFromModrinth(serverId, projectId, worldName) {
  const res = await fetch(`${MODRINTH_API}/project/${projectId}/version`, {
    headers: { 'User-Agent': 'MCForge-Daemon/1.0' }
  });
  if (!res.ok) throw new Error('Projeto não encontrado');
  const versions = await res.json();
  const version = versions[0];
  const file = version.files.find(f => f.primary) || version.files[0];
  if (!file) return { error: 'Nenhum arquivo disponível' };

  const tmp = path.join(getConfig().serversDir, serverId, `.world_${Date.now()}.zip`);
  log('info', `Baixando mundo "${version.name}"...`);
  await downloadFile(file.url, tmp);
  const result = await importWorldFromZip(serverId, tmp, worldName || version.name);
  fs.unlinkSync(tmp);
  return result;
}

// ---------- Exportar / Backup de mundo ----------
function exportWorld(serverId, worldName) {
  const destDir = path.join(getConfig().backupsDir, serverId);
  ensureDir(destDir);

  const srcDir = path.join(getConfig().serversDir, serverId, worldName);
  if (!fs.existsSync(srcDir)) return { error: `Mundo ${worldName} não encontrado` };

  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const fileName = `world-${worldName}-${stamp}.zip`;
  const dest = path.join(destDir, fileName);

  const archiver = require('archiver');
  return new Promise((resolve) => {
    const output = fs.createWriteStream(dest);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve({ success: true, file: fileName, size: fs.statSync(dest).size }));
    archive.on('error', (e) => resolve({ error: e.message }));
    archive.pipe(output);
    archive.directory(srcDir, worldName);
    archive.finalize();
  });
}

// ---------- Backup automático programado ----------
function scheduleBackups(serverId, intervalHours) {
  const { getServers, saveServers } = require('./config');
  const servers = getServers();
  if (servers[serverId]) {
    servers[serverId].backupIntervalHours = intervalHours || servers[serverId].backupIntervalHours || 6;
    servers[serverId].lastBackupAt = new Date().toISOString();
    saveServers(servers);
  }
  log('info', `Backup automático do servidor ${serverId} configurado (a cada ${intervalHours}h)`);
  return { success: true };
}

module.exports = {
  listWorlds, importWorldFromZip, searchWorlds, downloadWorldFromModrinth,
  exportWorld, scheduleBackups, dirSize
};