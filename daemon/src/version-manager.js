// ============================================
// MCForge Daemon - Gerenciador de Versões do Minecraft
// Baixa servidores de: Vanilla, Paper, Purpur, Forge, Fabric, NeoForge e BDS
// ============================================
const fs = require('fs');
const path = require('path');
const { log, ensureDir } = require('./utils');

const VANILLA_MANIFEST = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';
const PAPER_API = 'https://fill.papermc.io/v3';
const PURPUR_API = 'https://api.purpurmc.org/v2';
const FORGE_MANIFEST = 'https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json';
const FABRIC_META = 'https://meta.fabricmc.net/v2';
const NEOFORGE_MANIFEST = 'https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.json';
const BDS_MANIFEST = 'https://raw.githubusercontent.com/Bedrock-OSS/BDS-Versions/main/versions.json';
const GEOZERO_BDS = 'https://github.com/Bedrock-OSS/bedrock-server-versions/raw/main/versions.json';

async function fetchJson(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'MCForge-Daemon/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} para ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Lista de versões por tipo ----------
async function listVanillaVersions() {
  const manifest = await fetchJson(VANILLA_MANIFEST);
  return manifest.versions
    .filter(v => v.type === 'release')
    .map(v => ({ id: v.id, type: 'vanilla', releaseTime: v.releaseTime }));
}

async function listPaperVersions() {
  const data = await fetchJson(`${PAPER_API}/projects/paper`);
  // v3: versions é um objeto { grupo: [versões] }
  const versions = Object.values(data.versions || {}).flat();
  return versions.map(v => ({ id: v, type: 'paper' }));
}

async function listPurpurVersions() {
  const data = await fetchJson(`${PURPUR_API}/minecraft`);
  const versions = data.versions || [];
  return versions.map(v => ({ id: v, type: 'purpur' }));
}

async function listForgeVersions() {
  const data = await fetchJson(FORGE_MANIFEST);
  const versions = data.reduce((acc, g) => {
    for (const v of g.versions || []) acc.push(v);
    return acc;
  }, []);
  return versions
    .map(v => ({ id: v.id, type: 'forge' }))
    .filter(v => !v.id.includes('-pre') && !v.id.includes('-rc'));
}

async function listFabricVersions() {
  const data = await fetchJson(`${FABRIC_META}/versions/loader`);
  const loaders = data.map(l => l.loader.version);
  // Game versions suportadas
  const gameData = await fetchJson(`${FABRIC_META}/versions/game`);
  const games = gameData.filter(g => !g.stable === false).map(g => g.version);
  return loaders.map(v => ({ id: v, type: 'fabric', games }));
}

async function listBDSVersions() {
  let data;
  try {
    data = await fetchJson(BDS_MANIFEST);
  } catch {
    data = await fetchJson(GEOZERO_BDS);
  }
  const versions = data.versions || [];
  return versions.map(v => ({ id: v.version, type: 'bds', windowsUrl: v.windows_url }));
}

// ---------- Download de servidor ----------
async function getPaperBuild(version) {
  const data = await fetchJson(`${PAPER_API}/projects/paper/versions/${version}/builds`);
  // v3 retorna array direto OU { builds: [...] } dependendo do endpoint
  const list = Array.isArray(data) ? data : (data.builds || []);
  const latest = list[list.length - 1];
  if (!latest) throw new Error(`Nenhum build encontrado para Paper ${version}`);
  const dl = (latest.downloads && (latest.downloads['server:default'] || latest.downloads.application));
  if (!dl) throw new Error('Download do Paper não disponível');
  return { url: dl.url, fileName: dl.name, build: latest.build };
}

async function downloadServer(type, version, destDir) {
  ensureDir(destDir);
  let url, fileName;

  switch (type) {
    case 'vanilla': {
      const manifest = await fetchJson(VANILLA_MANIFEST);
      const target = manifest.versions.find(v => v.id === version && v.type === 'release');
      if (!target) throw new Error(`Versão Vanilla ${version} não encontrada`);
      const vData = await fetchJson(target.url);
      url = vData.downloads.server.url;
      fileName = `server-${version}.jar`;
      break;
    }
    case 'paper': {
      const { url: pUrl, fileName: pName } = await getPaperBuild(version);
      url = pUrl;
      fileName = pName;
      break;
    }
    case 'purpur': {
      url = `${PURPUR_API}/purpur/${version}/latest/download`;
      fileName = `purpur-${version}.jar`;
      break;
    }
    case 'forge': {
      // URL padrão de download do Forge
      url = `https://maven.minecraftforge.net/net/minecraftforge/forge/${version}/forge-${version}-installer.jar`;
      fileName = `forge-${version}-installer.jar`;
      break;
    }
    case 'fabric': {
      // Fabric requer loader + intermediary
      const loaderData = await fetchJson(`${FABRIC_META}/versions/loader/${version}`);
      const loader = loaderData[0].loader.version;
      const installer = loaderData[0].installer.version;
      // Server jar via installer
      url = `https://meta.fabricmc.net/v2/versions/loader/${version}/${loader}/${installer}/server/jar`;
      fileName = `fabric-server-mc.${version}-loader.${loader}.jar`;
      break;
    }
    case 'neoforge': {
      url = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${version}/neoforge-${version}-installer.jar`;
      fileName = `neoforge-${version}-installer.jar`;
      break;
    }
    case 'bds': {
      let data;
      try { data = await fetchJson(BDS_MANIFEST); } catch { data = await fetchJson(GEOZERO_BDS); }
      const target = (data.versions || []).find(v => v.version === version);
      if (!target) throw new Error(`Versão BDS ${version} não encontrada`);
      url = target.windows_url;
      fileName = `bedrock-server-${version}.zip`;
      break;
    }
    default:
      throw new Error(`Tipo de servidor desconhecido: ${type}`);
  }

  log('info', `Baixando ${type} ${version} de ${url}...`);
  const destFile = path.join(destDir, fileName);
  await downloadFile(url, destFile);
  log('success', `Servidor baixado: ${fileName}`);
  return { url, fileName, path: destFile };
}

async function downloadFile(url, destFile) {
  const res = await fetch(url, { headers: { 'User-Agent': 'MCForge-Daemon/1.0' } });
  if (!res.ok) throw new Error(`Falha no download: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destFile, buffer);
}

async function checkModrinthServerType(type) {
  // Tipos de servidor suportados pelo Modrinth para mods/plugins
  const map = {
    fabric: 'fabric', forge: 'forge', neoforge: 'neoforge',
    paper: 'paper', purpur: 'paper', spigot: 'spigot', vanilla: 'vanilla', bds: 'bedrock'
  };
  return map[type] || null;
}

module.exports = {
  listVanillaVersions, listPaperVersions, listPurpurVersions,
  listForgeVersions, listFabricVersions, listBDSVersions,
  downloadServer, downloadFile, checkModrinthServerType
};