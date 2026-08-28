// ============================================
// MCForge Daemon - Gerenciador de Plugins / Mods
// Instala plugins/mods de Modrinth, Hangar e Spigot
// ============================================
const fs = require('fs');
const path = require('path');
const { log, ensureDir, readJson, writeJson } = require('./utils');
const { getConfig } = require('./config');
const { downloadFile } = require('./version-manager');

const MODRINTH_API = 'https://api.modrinth.com/v2';
const HANGAR_API = 'https://hangar.papermc.io/api/v1';

// ---------- Busca em Modrinth ----------
async function searchModrinth(query, options = {}) {
  const { type = 'mod', gameVersion, loader } = options;
  const facets = [];
  if (type) facets.push([`project_type:${type}`]);
  if (gameVersion) facets.push([`versions:${gameVersion}`]);
  if (loader) facets.push([`categories:${loader}`]);

  const params = new URLSearchParams({
    query,
    limit: String(options.limit || 20),
    index: options.index || 'relevance'
  });
  if (facets.length) params.set('facets', JSON.stringify(facets));

  const res = await fetch(`${MODRINTH_API}/search?${params}`, {
    headers: { 'User-Agent': 'MCForge-Daemon/1.0' }
  });
  if (!res.ok) throw new Error(`Erro Modrinth: HTTP ${res.status}`);
  const data = await res.json();
  return data.hits.map(h => ({
    source: 'modrinth',
    id: h.project_id,
    slug: h.slug,
    title: h.title,
    description: h.description,
    author: h.author,
    type: h.project_type,
    downloads: h.downloads,
    versions: h.versions,
    icon: h.icon_url,
    gameVersions: h.game_versions,
    loaders: h.categories,
    url: `https://modrinth.com/${h.project_type}/${h.slug}`
  }));
}

async function getModrinthProject(idOrSlug) {
  const res = await fetch(`${MODRINTH_API}/project/${idOrSlug}`, {
    headers: { 'User-Agent': 'MCForge-Daemon/1.0' }
  });
  if (!res.ok) throw new Error(`Projeto não encontrado`);
  return res.json();
}

async function getModrinthVersions(projectId, { gameVersion, loader }) {
  const params = new URLSearchParams();
  if (gameVersion) params.set('game_versions', JSON.stringify([gameVersion]));
  if (loader) params.set('loaders', JSON.stringify([loader]));
  const res = await fetch(`${MODRINTH_API}/project/${projectId}/version?${params}`, {
    headers: { 'User-Agent': 'MCForge-Daemon/1.0' }
  });
  if (!res.ok) throw new Error('Erro ao listar versões do projeto');
  const data = await res.json();
  return data.map(v => ({
    id: v.id,
    name: v.name,
    versionNumber: v.version_number,
    gameVersions: v.game_versions,
    loaders: v.loaders,
    files: v.files.map(f => ({ url: f.url, filename: f.filename, size: f.size, primary: f.primary })),
    published: v.date_published
  }));
}

// ---------- Busca em Hangar (Paper plugins) ----------
async function searchHangar(query, options = {}) {
  const params = new URLSearchParams({ q: query, limit: String(options.limit || 20) });
  const res = await fetch(`${HANGAR_API}/projects?${params}`, {
    headers: { 'User-Agent': 'MCForge-Daemon/1.0', 'Accept': 'application/json' }
  });
  if (!res.ok) throw new Error(`Erro Hangar: HTTP ${res.status}`);
  const data = await res.json();
  return (data.result || []).map(p => ({
    source: 'hangar',
    id: p.namespace.slug,
    slug: p.namespace.slug,
    title: p.name,
    description: p.description,
    author: p.namespace.owner,
    type: 'plugin',
    downloads: p.stats.downloads,
    versions: [],
    icon: p.logoUrl || null,
    url: `https://hangar.papermc.io/${p.namespace.owner}/${p.namespace.slug}`
  }));
}

// ---------- Instalação ----------
async function installFromModrinth(serverId, projectId, { gameVersion, loader } = {}) {
  const server = require('./server-manager').getServer(serverId);
  if (!server) return { error: 'Servidor não encontrado' };

  const project = await getModrinthProject(projectId);
  const gv = gameVersion || server.version;
  const ld = loader || mapLoader(server.type);

  // Se não especificar versão, pega a mais recente compatível
  let versions = await getModrinthVersions(projectId, { gameVersion: gv, loader: ld });
  if (versions.length === 0) versions = await getModrinthVersions(projectId, { loader: ld });
  if (versions.length === 0) versions = await getModrinthVersions(projectId);
  if (versions.length === 0) return { error: 'Nenhuma versão compatível encontrada' };

  const version = versions[0];
  const file = version.files.find(f => f.primary) || version.files[0];
  if (!file) return { error: 'Arquivo não disponível' };

  const dir = server.type === 'bds' ? path.join(getConfig().serversDir, serverId, 'plugins') : path.join(getConfig().serversDir, serverId, 'plugins');
  ensureDir(dir);

  const destFile = path.join(dir, file.filename);
  log('info', `Instalando ${project.title} (${version.version_number}) no servidor ${serverId}...`);
  await downloadFile(file.url, destFile);

  // Registrar no servidor
  const { getServers, saveServers } = require('./config');
  const servers = getServers();
  const s = servers[serverId];
  if (s) {
    const existing = (s.plugins || []).findIndex(p => p.projectId === projectId);
    const entry = {
      projectId, slug: project.slug, title: project.title, author: project.author,
      version: version.version_number, filename: file.filename, size: file.size,
      installedAt: new Date().toISOString()
    };
    if (existing >= 0) s.plugins[existing] = entry;
    else s.plugins.push(entry);
    saveServers(servers);
  }

  log('success', `Plugin/Mod ${project.title} instalado!`);
  return { success: true, project: { ...entry, needsRestart: true } };
}

async function installFromHangar(serverId, slug) {
  const server = require('./server-manager').getServer(serverId);
  if (!server) return { error: 'Servidor não encontrado' };

  // Pegar a versão mais recente via API do Hangar
  const res = await fetch(`${HANGAR_API}/projects/${slug}/versions`, {
    headers: { 'Accept': 'application/json' }
  });
  if (!res.ok) throw new Error('Erro ao buscar versões do plugin');

  const data = await res.json();
  const latest = data.result && data.result[0];
  if (!latest) return { error: 'Nenhuma versão encontrada' };

  const downloadUrl = latest.downloads.find(d => d.platform === 'PAPER') || latest.downloads[0];
  if (!downloadUrl) return { error: 'Download não disponível' };

  const dir = path.join(getConfig().serversDir, serverId, 'plugins');
  ensureDir(dir);
  const filename = `${slug}-${latest.name.replace(/[^a-zA-Z0-9._-]/g, '_')}.jar`;
  await downloadFile(downloadUrl.externalUrl || downloadUrl.downloadUrl, path.join(dir, filename));

  const { getServers, saveServers } = require('./config');
  const servers = getServers();
  if (servers[serverId]) {
    servers[serverId].plugins.push({
      projectId: slug, slug, title: slug, author: 'Hangar', version: latest.name,
      filename, size: 0, installedAt: new Date().toISOString(), source: 'hangar'
    });
    saveServers(servers);
  }
  return { success: true, needsRestart: true };
}

// Upload manual de um arquivo de plugin
async function uploadPluginFile(serverId, file) {
  const server = require('./server-manager').getServer(serverId);
  if (!server) return { error: 'Servidor não encontrado' };
  const dir = path.join(getConfig().serversDir, serverId, 'plugins');
  ensureDir(dir);
  const filename = path.basename(file.originalname);
  const dest = path.join(dir, filename);
  fs.writeFileSync(dest, file.buffer);
  log('success', `Plugin enviado: ${filename}`);
  return { success: true, filename };
}

function listInstalled(serverId) {
  const { getServers } = require('./config');
  const servers = getServers();
  const s = servers[serverId];
  if (!s) return [];
  const dir = path.join(getConfig().serversDir, serverId, 'plugins');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.jar') || f.endsWith('.zip')) : [];
  const installed = (s.plugins || []).map(p => ({
    ...p,
    fileExists: files.includes(p.filename),
    needsRestart: true
  }));
  return installed;
}

function removePlugin(serverId, filename) {
  const dir = path.join(getConfig().serversDir, serverId, 'plugins');
  const file = path.join(dir, filename);
  if (fs.existsSync(file)) fs.unlinkSync(file);

  const { getServers, saveServers } = require('./config');
  const servers = getServers();
  if (servers[serverId]) {
    servers[serverId].plugins = (servers[serverId].plugins || []).filter(p => p.filename !== filename);
    saveServers(servers);
  }
  return { success: true };
}

function mapLoader(type) {
  const map = {
    fabric: 'fabric', forge: 'forge', neoforge: 'neoforge',
    paper: 'paper', purpur: 'paper', spigot: 'spigot',
    vanilla: 'vanilla', bds: 'bedrock'
  };
  return map[type] || 'paper';
}

module.exports = {
  searchModrinth, searchHangar, getModrinthProject, getModrinthVersions,
  installFromModrinth, installFromHangar, uploadPluginFile,
  listInstalled, removePlugin, mapLoader
};