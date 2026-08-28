// ============================================
// MCForge Daemon - Gerenciador de Versões do Minecraft
// Baixa servidores de: Vanilla, Paper, Purpur, Forge, Fabric, NeoForge e BDS
// ============================================
const fs = require('fs');
const path = require('path');
const { log, ensureDir } = require('./utils');

const VANILLA_MANIFEST = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';
const PAPER_API = 'https://api.papermc.io/v2';
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
  try {
    const data = await fetchJson(`${PAPER_API}/projects/paper`);
    const versions = data.versions || [];
    return versions.reverse().map(v => ({ id: v, type: 'paper' }));
  } catch {
    return [
      { id: '1.21.4', type: 'paper' },
      { id: '1.21.1', type: 'paper' },
      { id: '1.20.4', type: 'paper' },
      { id: '1.20.1', type: 'paper' },
      { id: '1.19.4', type: 'paper' },
      { id: '1.18.2', type: 'paper' },
      { id: '1.16.5', type: 'paper' },
      { id: '1.12.2', type: 'paper' },
      { id: '1.8.8', type: 'paper' }
    ];
  }
}

async function listPurpurVersions() {
  const data = await fetchJson(`${PURPUR_API}/purpur`);
  const versions = data.versions || [];
  return versions.reverse().map(v => ({ id: v, type: 'purpur' }));
}

async function listForgeVersions() {
  return [
    { id: '1.21.4', type: 'forge' },
    { id: '1.21.3', type: 'forge' },
    { id: '1.21.1', type: 'forge' },
    { id: '1.21', type: 'forge' },
    { id: '1.20.6', type: 'forge' },
    { id: '1.20.4', type: 'forge' },
    { id: '1.20.2', type: 'forge' },
    { id: '1.20.1', type: 'forge' },
    { id: '1.20', type: 'forge' },
    { id: '1.19.4', type: 'forge' },
    { id: '1.19.3', type: 'forge' },
    { id: '1.19.2', type: 'forge' },
    { id: '1.19.1', type: 'forge' },
    { id: '1.19', type: 'forge' },
    { id: '1.18.2', type: 'forge' },
    { id: '1.18.1', type: 'forge' },
    { id: '1.18', type: 'forge' },
    { id: '1.17.1', type: 'forge' },
    { id: '1.16.5', type: 'forge' },
    { id: '1.16.4', type: 'forge' },
    { id: '1.16.3', type: 'forge' },
    { id: '1.16.2', type: 'forge' },
    { id: '1.16.1', type: 'forge' },
    { id: '1.15.2', type: 'forge' },
    { id: '1.14.4', type: 'forge' },
    { id: '1.13.2', type: 'forge' },
    { id: '1.12.2', type: 'forge' },
    { id: '1.12.1', type: 'forge' },
    { id: '1.12', type: 'forge' },
    { id: '1.11.2', type: 'forge' },
    { id: '1.10.2', type: 'forge' },
    { id: '1.9.4', type: 'forge' },
    { id: '1.8.9', type: 'forge' },
    { id: '1.8.8', type: 'forge' },
    { id: '1.8', type: 'forge' },
    { id: '1.7.10', type: 'forge' },
    { id: '1.7.2', type: 'forge' },
    { id: '1.6.4', type: 'forge' },
    { id: '1.5.2', type: 'forge' }
  ];
}

async function listFabricVersions() {
  return [
    { id: '1.21.4', type: 'fabric' },
    { id: '1.21.3', type: 'fabric' },
    { id: '1.21.2', type: 'fabric' },
    { id: '1.21.1', type: 'fabric' },
    { id: '1.21', type: 'fabric' },
    { id: '1.20.6', type: 'fabric' },
    { id: '1.20.5', type: 'fabric' },
    { id: '1.20.4', type: 'fabric' },
    { id: '1.20.3', type: 'fabric' },
    { id: '1.20.2', type: 'fabric' },
    { id: '1.20.1', type: 'fabric' },
    { id: '1.20', type: 'fabric' },
    { id: '1.19.4', type: 'fabric' },
    { id: '1.19.3', type: 'fabric' },
    { id: '1.19.2', type: 'fabric' },
    { id: '1.19.1', type: 'fabric' },
    { id: '1.19', type: 'fabric' },
    { id: '1.18.2', type: 'fabric' },
    { id: '1.18.1', type: 'fabric' },
    { id: '1.18', type: 'fabric' },
    { id: '1.17.1', type: 'fabric' },
    { id: '1.17', type: 'fabric' },
    { id: '1.16.5', type: 'fabric' },
    { id: '1.16.4', type: 'fabric' },
    { id: '1.16.3', type: 'fabric' },
    { id: '1.16.2', type: 'fabric' },
    { id: '1.16.1', type: 'fabric' },
    { id: '1.15.2', type: 'fabric' },
    { id: '1.14.4', type: 'fabric' },
    { id: '1.8.9', type: 'fabric' }
  ];
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
  const list = data.builds || [];
  const latest = list[list.length - 1];
  if (!latest) throw new Error(`Nenhum build encontrado para Paper ${version}`);
  const fileName = latest.downloads?.application?.name;
  if (!fileName) throw new Error('Download do Paper não disponível');
  const url = `${PAPER_API}/projects/paper/versions/${version}/builds/${latest.build}/downloads/${fileName}`;
  return { url, fileName, build: latest.build };
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
      try {
        const { url: pUrl, fileName: pName } = await getPaperBuild(version);
        url = pUrl;
        fileName = pName;
      } catch {
        const manifest = await fetchJson(VANILLA_MANIFEST);
        const target = manifest.versions.find(v => v.id === version);
        if (target) {
          const vData = await fetchJson(target.url);
          url = vData.downloads.server.url;
          fileName = `server-${version}.jar`;
        } else {
          throw new Error(`Versão Paper ${version} não disponível`);
        }
      }
      break;
    }
    case 'purpur': {
      url = `${PURPUR_API}/purpur/${version}/latest/download`;
      fileName = `purpur-${version}.jar`;
      break;
    }
    case 'forge': {
      const forgeMap = {
        '1.21.4': '1.21.4-54.0.0',
        '1.21.3': '1.21.3-53.0.0',
        '1.21.1': '1.21.1-52.0.0',
        '1.21': '1.21-51.0.0',
        '1.20.6': '1.20.6-50.1.0',
        '1.20.4': '1.20.4-49.0.38',
        '1.20.2': '1.20.2-48.1.0',
        '1.20.1': '1.20.1-47.3.0',
        '1.20': '1.20-46.0.14',
        '1.19.4': '1.19.4-45.2.0',
        '1.19.3': '1.19.3-44.1.0',
        '1.19.2': '1.19.2-43.3.0',
        '1.19.1': '1.19.1-42.0.9',
        '1.19': '1.19-41.1.0',
        '1.18.2': '1.18.2-40.2.14',
        '1.18.1': '1.18.1-39.1.0',
        '1.18': '1.18-38.0.17',
        '1.17.1': '1.17.1-37.1.1',
        '1.16.5': '1.16.5-36.2.39',
        '1.16.4': '1.16.4-35.1.37',
        '1.16.3': '1.16.3-34.1.42',
        '1.16.2': '1.16.2-33.0.61',
        '1.16.1': '1.16.1-32.0.108',
        '1.15.2': '1.15.2-31.2.57',
        '1.14.4': '1.14.4-28.2.26',
        '1.13.2': '1.13.2-25.0.223',
        '1.12.2': '1.12.2-14.23.5.2860',
        '1.12.1': '1.12.1-14.22.1.2485',
        '1.12': '1.12-14.21.1.2443',
        '1.11.2': '1.11.2-13.20.1.2588',
        '1.10.2': '1.10.2-12.18.3.2511',
        '1.9.4': '1.9.4-12.17.0.2051',
        '1.8.9': '1.8.9-11.15.1.2318-1.8.9',
        '1.8.8': '1.8.8-11.14.4.1563',
        '1.8': '1.8-11.14.4.1563',
        '1.7.10': '1.7.10-10.13.4.1614-1.7.10',
        '1.7.2': '1.7.2-10.12.2.1147',
        '1.6.4': '1.6.4-9.11.1.1345',
        '1.5.2': '1.5.2-7.8.1.737'
      };
      const forgeVer = forgeMap[version] || version;
      url = `https://maven.minecraftforge.net/net/minecraftforge/forge/${forgeVer}/forge-${forgeVer}-installer.jar`;
      fileName = `forge-${forgeVer}-installer.jar`;
      break;
    }
    case 'fabric': {
      try {
        const loaderData = await fetchJson(`${FABRIC_META}/versions/loader/${version}`);
        if (loaderData && loaderData[0]) {
          const loader = loaderData[0].loader.version;
          const installer = loaderData[0].installer.version;
          url = `https://meta.fabricmc.net/v2/versions/loader/${version}/${loader}/${installer}/server/jar`;
          fileName = `fabric-server-mc.${version}-loader.${loader}.jar`;
        } else {
          throw new Error('Loader não encontrado');
        }
      } catch {
        const manifest = await fetchJson(VANILLA_MANIFEST);
        const target = manifest.versions.find(v => v.id === version);
        if (target) {
          const vData = await fetchJson(target.url);
          url = vData.downloads.server.url;
          fileName = `server-${version}.jar`;
        } else {
          throw new Error(`Versão Fabric ${version} não suportada`);
        }
      }
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