// ============================================
// MCForge Panel - Cliente da API do Daemon
// ============================================

const TOKEN_KEY = 'mcforge_token'
const USER_KEY = 'mcforge_user'
const DAEMON_URL_KEY = 'mcforge_daemon_url'

// Cache em memória do túnel descoberto
let discoveredBaseUrl = null
let discoveredMinecraftIp = ''

// Detecta se estamos rodando no GitHub Pages / Netlify / Vercel
export function isHostedStaticPage() {
  const host = window.location.hostname
  return host.endsWith('github.io') || host.endsWith('netlify.app') || host.endsWith('vercel.app')
}

// Extrai usuário e repositório configurados ou do GitHub Pages / Token
export function getGitHubRepoInfo() {
  const savedRepo = localStorage.getItem('mcforge_github_repo')
  if (savedRepo && savedRepo.includes('/')) {
    const [user, repo] = savedRepo.split('/')
    return { user: user.trim(), repo: repo.trim() }
  }

  const host = window.location.hostname
  if (host.endsWith('.github.io')) {
    const user = host.replace('.github.io', '')
    const pathParts = window.location.pathname.split('/').filter(Boolean)
    const repo = pathParts[0] || 'mcforge'
    return { user, repo }
  }

  const savedUser = localStorage.getItem('mcforge_github_user')
  return { user: savedUser || 'moisesvvanti-dev', repo: 'mcforge' }
}

// Limpeza e migração automática: remove qualquer configuração localhost antiga para todos os usuários
try {
  const oldUrl = localStorage.getItem(DAEMON_URL_KEY)
  if (oldUrl && (oldUrl.includes('localhost') || oldUrl.includes('127.0.0.1') || oldUrl.startsWith('http://'))) {
    localStorage.removeItem(DAEMON_URL_KEY)
  }
} catch { }

// Descobre automaticamente a URL HTTPS do Daemon ativo no GitHub Actions
export async function autoDiscoverDaemonUrl(force = false) {
  if (discoveredBaseUrl && !force) return discoveredBaseUrl

  // Se o usuário estiver acessando diretamente pelo túnel do Cloudflare ou na mesma origem, usa relativo
  if (!isHostedStaticPage()) {
    discoveredBaseUrl = ''
    return ''
  }

  // Busca sempre o arquivo tunnel.json mais recente do GitHub Actions
  try {
    const { user, repo } = getGitHubRepoInfo()
    const rawUrl = `https://raw.githubusercontent.com/${user}/${repo}/main/tunnel.json?t=${Date.now()}`
    const res = await fetch(rawUrl, { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      if (data && data.minecraft) {
        discoveredMinecraftIp = data.minecraft
        localStorage.setItem('mcforge_minecraft_ip', data.minecraft)
      }
      if (data && data.url && data.url.startsWith('https://')) {
        discoveredBaseUrl = normalizeUrl(data.url)
        localStorage.setItem(DAEMON_URL_KEY, discoveredBaseUrl)
        return discoveredBaseUrl
      }
    }
  } catch { }

  if (force) {
    discoveredBaseUrl = null
    localStorage.removeItem(DAEMON_URL_KEY)
    return ''
  }

  // Tenta recuperar do localStorage se for HTTPS válido
  const saved = localStorage.getItem(DAEMON_URL_KEY)
  if (saved && saved.startsWith('https://')) {
    discoveredBaseUrl = normalizeUrl(saved)
    return discoveredBaseUrl
  }

  return ''
}

export function getMinecraftAddress() {
  return discoveredMinecraftIp || localStorage.getItem('mcforge_minecraft_ip') || ''
}

export function getBase() {
  if (discoveredBaseUrl !== null) return discoveredBaseUrl
  return localStorage.getItem(DAEMON_URL_KEY) || ''
}

export function normalizeUrl(url) {
  let u = String(url || '').trim().replace(/\/+$/, '')
  if (!u) return ''
  if (!/^https?:\/\//i.test(u)) {
    u = (window.location.protocol === 'https:' ? 'https://' : 'http://') + u
  }
  return u
}

export function setDaemonUrl(url) {
  const normalized = normalizeUrl(url)
  discoveredBaseUrl = normalized
  if (normalized) localStorage.setItem(DAEMON_URL_KEY, normalized)
  else localStorage.removeItem(DAEMON_URL_KEY)
}

export function getGitHubToken() {
  return localStorage.getItem('mcforge_github_token') || ''
}

export function setGitHubToken(token) {
  if (token) localStorage.setItem('mcforge_github_token', token.trim())
  else localStorage.removeItem('mcforge_github_token')
}

// Dispara o GitHub Actions em segundo plano sem sair do site
export async function triggerGitHubWorkflow(customToken, inputs = {}) {
  const token = customToken || getGitHubToken()
  if (!token) {
    throw new Error('Token do GitHub não configurado. Adicione seu token Classic para iniciar sem sair do painel.')
  }

  let { user, repo } = getGitHubRepoInfo()

  // Auto-detecta o usuário do GitHub associado ao Token Classic (se não fixado manualmente)
  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token.trim()}`
      }
    })
    if (userRes.ok) {
      const uData = await userRes.json()
      if (uData && uData.login) {
        localStorage.setItem('mcforge_github_user', uData.login)
        if (!localStorage.getItem('mcforge_github_repo')) {
          user = uData.login
        }
      }
    }
  } catch { }

  const workflowCandidates = ['minecraft-persistent.yml', 'minecraft-server.yml']
  let lastError = ''

  for (const wf of workflowCandidates) {
    try {
      // 1. Tenta com os inputs especificados
      const res = await fetch(`https://api.github.com/repos/${user}/${repo}/actions/workflows/${wf}/dispatches`, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token.trim()}`,
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            version: inputs.version || '1.8.9',
            type: inputs.type || inputs.server_type || 'paper',
            server_type: inputs.type || inputs.server_type || 'paper',
            ram: inputs.maxRam || inputs.ram || '4G'
          }
        })
      })

      if (res.ok || res.status === 204) {
        return true
      }

      const data = await res.json().catch(() => ({}))
      lastError = data.message || `Erro ${res.status}`

      // 2. Se falhar por "Unexpected inputs", tenta sem inputs (usa os defaults do workflow)
      if (lastError && lastError.includes('Unexpected inputs')) {
        const fallbackRes = await fetch(`https://api.github.com/repos/${user}/${repo}/actions/workflows/${wf}/dispatches`, {
          method: 'POST',
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${token.trim()}`,
            'X-GitHub-Api-Version': '2022-11-28'
          },
          body: JSON.stringify({ ref: 'main' })
        })

        if (fallbackRes.ok || fallbackRes.status === 204) {
          return true
        }

        const fallbackData = await fallbackRes.json().catch(() => ({}))
        lastError = fallbackData.message || lastError
      }
    } catch (e) {
      lastError = e.message
    }
  }

  if (lastError.includes('workflow_dispatch')) {
    throw new Error(`O repositório ${user}/${repo} no GitHub ainda não recebeu os arquivos. Execute "git push" no terminal!`)
  }

  throw new Error(lastError || `Falha ao iniciar no repositório ${user}/${repo}.`)
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }
}

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  else localStorage.removeItem(USER_KEY)
}

export function isAuthenticated() {
  return !!getToken()
}

// Inicia auto-descoberta em segundo plano imediatamente
autoDiscoverDaemonUrl().catch(() => {})

// ---------- API helper com suporte HTTPS completo ----------
async function request(path, options = {}) {
  let base = getBase()
  if (isHostedStaticPage() && !base) {
    base = await autoDiscoverDaemonUrl()
  }

  // Se estiver no GitHub Pages sem túnel ativo, não faz requisição relativa (evita Erro 404 estático)
  if (isHostedStaticPage() && !base) {
    throw new Error(
      'O servidor na nuvem do GitHub Actions está desligado. Inicie a Action "MCForge All-in-One" no GitHub para conectar!'
    )
  }

  const url = (base ? base.replace(/\/+$/, '') : '') + path
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res
  try {
    res = await fetch(url, { ...options, headers })
  } catch (err) {
    discoveredBaseUrl = null
    localStorage.removeItem(DAEMON_URL_KEY)

    // Se o túnel antigo expirou (Failed to fetch), força a busca do novo túnel ativo no GitHub
    if (isHostedStaticPage()) {
      const freshBase = await autoDiscoverDaemonUrl(true)
      if (freshBase && freshBase !== base) {
        const retryUrl = freshBase.replace(/\/+$/, '') + path
        try {
          res = await fetch(retryUrl, { ...options, headers })
        } catch { }
      }
    }
    if (!res) {
      throw new Error(
        'O servidor na nuvem ainda não está online ou está iniciando. Aguarde alguns segundos enquanto o túnel conecta.'
      )
    }
  }

  if (res.status === 401) {
    setToken(null)
    if (!window.location.pathname.includes('/login') && !window.location.hash.includes('/login')) {
      window.location.hash = '#/login'
    }
    let errData = null
    try {
      const t = await res.text()
      errData = t ? JSON.parse(t) : null
    } catch { }
    throw new Error((errData && errData.error) || 'Sessão expirada ou credenciais inválidas.')
  }

  if (res.status === 404 && isHostedStaticPage() && !base) {
    throw new Error(
      'O servidor na nuvem do GitHub Actions está desligado. Inicie a Action no GitHub para conectar!'
    )
  }

  let data = null
  const text = await res.text()
  try { data = text ? JSON.parse(text) : null } catch { data = text }

  if (!res.ok) {
    const msg = (data && data.error) || `Erro ${res.status}`
    throw new Error(msg)
  }
  return data
}

export const api = {
  // Auth
  login: (username, password) => request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  }),
  register: (username, password, name) => request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, name })
  }),
  authStatus: () => request('/api/auth/status'),
  health: () => request('/api/health'),
  publicInfo: () => request('/api/public-info'),

  // Sistema
  dashboard: () => request('/api/dashboard'),
  system: () => request('/api/system'),
  publicIp: () => request('/api/system/public-ip'),
  updateConfig: (patch) => request('/api/system/config', {
    method: 'PUT', body: JSON.stringify(patch)
  }),

  // Servidores
  servers: () => request('/api/servers'),
  server: (id) => request(`/api/servers/${id}`),
  createServer: (data) => request('/api/servers', {
    method: 'POST', body: JSON.stringify(data)
  }),
  updateServer: (id, patch) => request(`/api/servers/${id}`, {
    method: 'PUT', body: JSON.stringify(patch)
  }),
  deleteServer: (id) => request(`/api/servers/${id}`, { method: 'DELETE' }),
  startServer: (id) => request(`/api/servers/${id}/start`, { method: 'POST' }),
  stopServer: (id) => request(`/api/servers/${id}/stop`, { method: 'POST' }),
  restartServer: (id) => request(`/api/servers/${id}/restart`, { method: 'POST' }),
  command: (id, command) => request(`/api/servers/${id}/command`, {
    method: 'POST', body: JSON.stringify({ command })
  }),
  logs: (id, limit = 100) => request(`/api/servers/${id}/logs?limit=${limit}`),
  acceptEula: (id) => request(`/api/servers/${id}/eula`, { method: 'POST' }),
  players: (id, kind, player, action) => request(`/api/servers/${id}/players/${kind}`, {
    method: 'POST', body: JSON.stringify({ player, action })
  }),

  // Plugins / Mods
  plugins: (id) => request(`/api/servers/${id}/plugins`),
  searchPlugins: (params) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/plugins/search?${qs}`)
  },
  installModrinth: (id, projectId, opts = {}) => request(`/api/servers/${id}/plugins/modrinth`, {
    method: 'POST', body: JSON.stringify({ projectId, ...opts })
  }),
  installHangar: (id, slug) => request(`/api/servers/${id}/plugins/hangar`, {
    method: 'POST', body: JSON.stringify({ slug })
  }),
  uploadPlugin: (id, file) => uploadFile(`/api/servers/${id}/plugins/upload`, file),
  removePlugin: (id, filename) => request(`/api/servers/${id}/plugins/${encodeURIComponent(filename)}`, { method: 'DELETE' }),

  // Versões
  versions: (type) => request(`/api/versions/${type}`),

  // Mundos
  worlds: (id) => request(`/api/servers/${id}/worlds`),
  importWorld: (id, file, name) => uploadFile(`/api/servers/${id}/worlds/import?name=${encodeURIComponent(name || 'world')}`, file),
  exportWorld: (id, worldName) => request(`/api/servers/${id}/worlds/export/${encodeURIComponent(worldName)}`, { method: 'POST' }),

  // Backups
  createBackup: (id) => request(`/api/servers/${id}/backup`, { method: 'POST' }),
  backups: (id) => request(`/api/servers/${id}/backups`),

  // Arquivos
  files: (id, path = '') => request(`/api/servers/${id}/files?path=${encodeURIComponent(path)}`),
  fileContent: (id, path) => request(`/api/servers/${id}/files/content?path=${encodeURIComponent(path)}`),
  saveFile: (id, path, content) => request(`/api/servers/${id}/files/content`, {
    method: 'PUT', body: JSON.stringify({ path, content })
  }),
  uploadFileTo: (id, file, path = '') => uploadFile(`/api/servers/${id}/files/upload?path=${encodeURIComponent(path)}`, file),
  deleteFile: (id, path) => request(`/api/servers/${id}/files?path=${encodeURIComponent(path)}`, { method: 'DELETE' }),

  // Usuários
  users: () => request('/api/auth/users'),
  addUser: (data) => request('/api/auth/users', {
    method: 'POST', body: JSON.stringify(data)
  }),
  removeUser: (username) => request(`/api/auth/users/${encodeURIComponent(username)}`, { method: 'DELETE' }),

  // Tunnel
  tunnelStatus: () => request('/api/tunnel/status'),
  tunnelCreate: (name) => request('/api/tunnel/create', {
    method: 'POST', body: JSON.stringify({ name })
  }),
  tunnelGenerate: (ports) => request('/api/tunnel/generate', {
    method: 'POST', body: JSON.stringify({ ports })
  }),
  tunnelStart: (name) => request('/api/tunnel/start', {
    method: 'POST', body: JSON.stringify({ name })
  }),
  tunnelStop: () => request('/api/tunnel/stop', { method: 'POST' }),
  tunnelDns: (domain) => request(`/api/tunnel/dns/${encodeURIComponent(domain)}`)
}

// Upload de arquivos (multipart)
async function uploadFile(path, file) {
  const base = getBase()
  const url = (base ? base.replace(/\/+$/, '') : '') + path
  const formData = new FormData()
  formData.append('file', file)

  const headers = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url, { method: 'POST', headers, body: formData })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) {
    throw new Error((data && data.error) || `Erro ${res.status}`)
  }
  return data
}

// ---------- WebSocket Seguro (WSS / WS) ----------
export function getWsUrl() {
  const base = getBase()
  let host, proto
  if (base) {
    const parsed = new URL(base)
    host = parsed.host
    proto = parsed.protocol === 'https:' ? 'wss' : 'ws'
  } else {
    host = window.location.host
    proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  }
  return `${proto}://${host}/ws?token=${encodeURIComponent(getToken() || '')}`
}

// ---------- Helpers ----------
export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '-'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function timeAgo(iso) {
  if (!iso) return '-'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  const days = Math.floor(hours / 24)
  return `${days}d atrás`
}