// ============================================
// MCForge Painel - Utilitários
// ============================================

export function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function serverTypeLabel(type) {
  const labels = {
    vanilla: 'Vanilla', paper: 'Paper', purpur: 'Purpur',
    forge: 'Forge', fabric: 'Fabric', neoforge: 'NeoForge',
    bds: 'Bedrock', velocity: 'Velocity'
  }
  return labels[type] || type
}

export function serverTypeColor(type) {
  const colors = {
    vanilla: 'bg-gray-600', paper: 'bg-yellow-600', purpur: 'bg-purple-600',
    forge: 'bg-orange-600', fabric: 'bg-cyan-600', neoforge: 'bg-blue-600',
    bds: 'bg-green-700', velocity: 'bg-red-600'
  }
  return colors[type] || 'bg-gray-600'
}

export function statusColor(status) {
  const map = {
    running: 'text-green-400 bg-green-500/10',
    starting: 'text-yellow-400 bg-yellow-500/10',
    stopping: 'text-orange-400 bg-orange-500/10',
    stopped: 'text-gray-400 bg-gray-500/10',
    error: 'text-red-400 bg-red-500/10'
  }
  return map[status] || 'text-gray-400 bg-gray-500/10'
}

export function statusDot(status) {
  const map = {
    running: 'bg-green-400',
    starting: 'bg-yellow-400 animate-pulse',
    stopping: 'bg-orange-400',
    stopped: 'bg-gray-500',
    error: 'bg-red-400'
  }
  return map[status] || 'bg-gray-500'
}

export function gamemodeLabel(gm) {
  const map = { survival: 'Sobrevivência', creative: 'Criativo', adventure: 'Aventura', spectator: 'Espectador' }
  return map[gm] || gm
}

export function difficultyLabel(diff) {
  const map = { peaceful: 'Pacífica', easy: 'Fácil', normal: 'Normal', hard: 'Difícil' }
  return map[diff] || diff
}

export function formatMemory(bytes) {
  if (!bytes && bytes !== 0) return '-'
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(0)} MB`
}

export function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
  }
}

export function getServerDir(id) {
  return `servers/${id}`
}

// Parse de erro para mensagem amigável
export function parseError(err) {
  if (!err) return 'Erro desconhecido'
  if (typeof err === 'string') return err
  if (err.message) return err.message
  return 'Erro inesperado'
}

// Validação de porta
export function isValidPort(port) {
  const n = parseInt(port)
  return n >= 1 && n <= 65535
}

// Validação de quantidade de RAM (ex: 2G, 512M)
export function isValidRamAmount(ram) {
  return /^\d+[MG]$/i.test(ram)
}

// Gera cor aleatória para avatar
export function stringToColor(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 65%, 55%)`
}