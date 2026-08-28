import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, formatBytes, timeAgo, triggerGitHubWorkflow, getGitHubToken, setGitHubToken, autoDiscoverDaemonUrl, getGitHubRepoInfo, setDaemonUrl } from '../lib/api'
import { useApi } from '../hooks/useApi'
import StatusBadge from '../components/StatusBadge'
import ServerCard from '../components/ServerCard'
import Spinner from '../components/Spinner'
import Modal from '../components/Modal'

export default function Dashboard({ ws }) {
  const { data: dash, loading, error, execute } = useApi(() => api.dashboard(), [])
  const [busy, setBusy] = useState(null)
  const [cloudStarting, setCloudStarting] = useState(false)
  const [cloudStatusText, setCloudStatusText] = useState('')
  const [showTokenModal, setShowTokenModal] = useState(false)
  const [ghTokenInput, setGhTokenInput] = useState(getGitHubToken())
  const [customTunnelInput, setCustomTunnelInput] = useState('')
  const [tokenError, setTokenError] = useState('')

  const handleAction = async (id, action) => {
    setBusy(id)
    try {
      if (action === 'start') await api.startServer(id)
      if (action === 'stop') await api.stopServer(id)
      if (action === 'restart') await api.restartServer(id)
      setTimeout(() => execute().catch(() => {}), 500)
    } catch (e) {
      alert(e.message)
    } finally {
      setBusy(null)
    }
  }

  const handleStartCloud = async (tokenToUse = null) => {
    const token = tokenToUse || getGitHubToken()
    if (!token) {
      setShowTokenModal(true)
      return
    }

    setCloudStarting(true)
    setCloudStatusText('Disparando servidor na nuvem do GitHub Actions...')
    setTokenError('')

    try {
      await triggerGitHubWorkflow(token)
      setCloudStatusText('Aguardando máquina na nuvem (~20s)...')

      const { user, repo } = getGitHubRepoInfo()
      let attempts = 0
      const pollInterval = setInterval(async () => {
        attempts++

        // Consulta o status real da execução no GitHub Actions
        try {
          const runRes = await fetch(`https://api.github.com/repos/${user}/${repo}/actions/runs?per_page=1`, {
            headers: {
              'Accept': 'application/vnd.github+json',
              'Authorization': `Bearer ${token.trim()}`
            }
          })
          if (runRes.ok) {
            const rData = await runRes.json()
            const latestRun = rData.workflow_runs?.[0]
            if (latestRun) {
              if (latestRun.status === 'queued') {
                setCloudStatusText('⏳ Alocando máquina no GitHub...')
              } else if (latestRun.status === 'in_progress') {
                setCloudStatusText('⚙️ Inicializando Java 21 e subindo túnel...')
              }
            }
          }
        } catch { }

        try {
          const url = await autoDiscoverDaemonUrl(true)
          if (url) {
            await execute()
            setCloudStatusText('🟢 Conectado com sucesso!')
            clearInterval(pollInterval)
            setTimeout(() => {
              setCloudStarting(false)
              setCloudStatusText('')
            }, 1500)
            return
          }
        } catch { }

        if (attempts > 50) {
          clearInterval(pollInterval)
          setCloudStarting(false)
          setCloudStatusText('')
        }
      }, 3000)
    } catch (err) {
      setCloudStarting(false)
      setCloudStatusText('')
      setTokenError(err.message)
      setShowTokenModal(true)
    }
  }

  // Atualizar quando eventos do WebSocket chegarem
  useEffect(() => {
    if (!ws) return
    const handler = () => execute().catch(() => {})
    ws.on('status', handler)
    ws.on('player', handler)
    return () => {
      ws.off('status')
      ws.off('player')
    }
  }, [ws, execute])

  const isOffline = !!error || !dash
  const localServers = JSON.parse(localStorage.getItem('mcforge_local_servers') || '{}')
  const allServersMap = { ...localServers, ...(dash?.servers || {}) }
  const servers = Object.values(allServersMap)
  const runningServers = servers.filter(s => s.status === 'running')
  const totalCount = servers.length
  const runningCount = runningServers.length
  const totalPlayers = servers.reduce((acc, s) => acc + (s.playerCount || 0), 0)

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja deletar este servidor?')) return
    try {
      await api.deleteServer(id)
    } catch { }
    const existing = JSON.parse(localStorage.getItem('mcforge_local_servers') || '{}')
    delete existing[id]
    localStorage.setItem('mcforge_local_servers', JSON.stringify(existing))
    execute().catch(() => {})
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Visão geral dos seus servidores Minecraft
          </p>
        </div>
        <Link to="/servers/new" className="btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Criar Servidor
        </Link>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-black text-white">{totalCount}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Servidores</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-black text-green-400">{runningCount}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Online</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-green-600/15 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-black text-cyan-400">{totalPlayers}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Jogadores</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-cyan-600/15 flex items-center justify-center">
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-black text-yellow-400">
                {dash?.system ? `${(dash.system.usedMemory / (1024 ** 3)).toFixed(1)}` : '0'}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">GB usados</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-yellow-600/15 flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Estado do sistema */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
            Meus Servidores
          </h2>
          {servers.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-5xl mb-3">⛏️</div>
              <p className="text-gray-400 mb-4">Você ainda não tem servidores.</p>
              <Link to="/servers/new" className="btn-primary">Criar o primeiro servidor</Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {servers.map(s => (
                <ServerCard
                  key={s.id}
                  server={s}
                  busy={busy === s.id}
                  onStart={(id) => handleAction(id, 'start')}
                  onStop={(id) => handleAction(id, 'stop')}
                  onRestart={(id) => handleAction(id, 'restart')}
                  onDelete={(id) => handleDelete(id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Jogadores online */}
          <div className="card p-5">
            <h2 className="font-semibold text-white mb-3">Jogadores Online</h2>
            {runningServers.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum servidor online.</p>
            ) : (
              <div className="space-y-3">
                {runningServers.map(s => (
                  <div key={s.id}>
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                      <span className="font-medium text-gray-300">{s.name}</span>
                      <span className="text-green-400">{s.playerCount} jogadores</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {s.players && s.players.length > 0 ? (
                        s.players.map(p => (
                          <span key={p} className="px-2 py-0.5 bg-gray-800 rounded-full text-xs text-gray-300">
                            {p}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-600">Sem jogadores</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sistema */}
          <div className="card p-5">
            <h2 className="font-semibold text-white mb-3">Sistema</h2>
            {dash?.system && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Máquina</span>
                  <span className="text-gray-300">{dash.system.hostname}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">CPU</span>
                  <span className="text-gray-300">{dash.system.cpuCores} núcleos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">RAM total</span>
                  <span className="text-gray-300">{(dash.system.totalMemory / (1024 ** 3)).toFixed(1)} GB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Java</span>
                  <span className="text-gray-300">{dash.system.javaAvailable || 'não instalado'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tunnel</span>
                  <span className={dash.tunnel?.status === 'running' ? 'text-green-400' : 'text-gray-500'}>
                    {dash.tunnel?.status === 'running' ? 'ativo' : 'inativo'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Backups recentes */}
          <div className="card p-5">
            <h2 className="font-semibold text-white mb-3">Backups</h2>
            <p className="text-sm text-gray-500">
              Total de backups: <span className="text-gray-300">{dash?.backupsCount || 0}</span>
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Backups automáticos são configurados em cada servidor.
            </p>
          </div>
        </div>
      </div>

      {/* Modal para Iniciar na Nuvem Automaticamente via Token */}
      <Modal open={showTokenModal} onClose={() => setShowTokenModal(false)} title="🔑 Ativação Automática no GitHub (1 Clique)">
        <div className="space-y-4">
          <p className="text-xs text-gray-300 leading-relaxed">
            Para iniciar os servidores na nuvem <strong>sem precisar abrir o GitHub</strong>, informe seu Token de Acesso Pessoal (PAT) do GitHub:
          </p>

          <div>
            <label className="label">GitHub Personal Access Token (PAT)</label>
            <input
              type="password"
              value={ghTokenInput}
              onChange={e => setGhTokenInput(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="input text-xs font-mono"
            />
            <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
              <span>Permissão necessária: <code className="text-green-400">actions:write</code> ou <code className="text-green-400">repo</code></span>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=MCForge+Cloud+Trigger"
                target="_blank"
                rel="noreferrer"
                className="text-green-400 hover:underline"
              >
                Gerar Token Rápido ↗
              </a>
            </div>
          </div>

          {tokenError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
              {tokenError}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-gray-800">
            <a
              href="https://github.com/moisesvvanti-dev/mcforge/actions"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-gray-400 hover:text-white"
            >
              Ou iniciar manualmente no GitHub ↗
            </a>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button onClick={() => setShowTokenModal(false)} className="btn-secondary text-xs">
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!ghTokenInput.trim()) return
                  setGitHubToken(ghTokenInput.trim())
                  setShowTokenModal(false)
                  handleStartCloud(ghTokenInput.trim())
                }}
                disabled={!ghTokenInput.trim()}
                className="btn-primary text-xs font-bold"
              >
                Salvar & Ligar Servidor 🚀
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}