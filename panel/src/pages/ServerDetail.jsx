import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, getBase, getMinecraftAddress } from '../lib/api'
import { useApi } from '../hooks/useApi'
import Spinner from '../components/Spinner'
import StatusBadge from '../components/StatusBadge'
import Console from '../components/Console'
import Modal from '../components/Modal'
import { serverTypeLabel, serverTypeColor, gamemodeLabel, difficultyLabel, copyToClipboard, formatMemory } from '../lib/utils'

const tabs = [
  { id: 'console', label: 'Console', icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: 'plugins', label: 'Plugins & Mods', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
  { id: 'worlds', label: 'Mundos', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064' },
  { id: 'files', label: 'Arquivos', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { id: 'players', label: 'Jogadores', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'settings', label: 'Configurações', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }
]

export default function ServerDetail({ ws }) {
  const { id } = useParams()
  const [tab, setTab] = useState('console')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data, loading, error, execute, setData } = useApi(() => api.server(id), [id])

  // Atualizar via WebSocket
  useEffect(() => {
    if (!ws) return
    const handler = (msg) => {
      if (msg.id === id) {
        execute().catch(() => {})
      }
    }
    ws.on('status', handler)
    ws.on('player', handler)
    ws.on('stats', handler)
    return () => {
      ws.off('status')
      ws.off('player')
      ws.off('stats')
    }
  }, [ws, id, execute])

  const server = data?.server

  const handleAction = async (action) => {
    setBusy(true)
    try {
      if (action === 'start') await api.startServer(id)
      if (action === 'stop') await api.stopServer(id)
      if (action === 'restart') await api.restartServer(id)
      setTimeout(() => execute().catch(() => {}), 600)
    } catch (e) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    try {
      await api.deleteServer(id)
      window.location.hash = '#/servers'
    } catch (e) {
      alert(e.message)
    }
  }

  if (loading && !server) {
    return <div className="flex justify-center py-24"><Spinner size="lg" /></div>
  }
  if (error && !server) {
    return (
      <div className="card p-8 text-center">
        <p className="text-red-400">{error}</p>
        <Link to="/servers" className="btn-secondary mt-4 inline-flex">← Voltar</Link>
      </div>
    )
  }

  const isRunning = server.status === 'running'

  const mcPublic = getMinecraftAddress()
  let serverAddress = mcPublic || `localhost:${server.port}`
  if (server.publicAddress) {
    serverAddress = server.publicAddress
  } else if (server.playitAddress) {
    serverAddress = server.playitAddress
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Banner com Endereço Direto para o Jogo */}
      <div className="bg-gradient-to-r from-emerald-950/70 via-gray-900 to-gray-900 border border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
            </svg>
          </div>
          <div>
            <div className="text-xs text-gray-400">Endereço de Conexão no Minecraft (Copiar e Colar no Jogo):</div>
            <div className="text-sm sm:text-base font-mono font-bold text-emerald-300 select-all mt-0.5">
              {serverAddress}
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            copyToClipboard(serverAddress)
            alert('Endereço copiado! Cole na Conexão Direta do Minecraft.')
          }}
          className="btn-primary !py-2 !px-4 text-xs font-bold shrink-0 w-full sm:w-auto flex items-center justify-center gap-1.5 shadow-lg shadow-green-900/30"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copiar IP do Jogo
        </button>
      </div>

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/servers" className="btn-ghost !px-2 !py-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl ${serverTypeColor(server.type)}`}>
            {server.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">{server.name}</h1>
              <StatusBadge status={server.status} />
            </div>
            <div className="text-xs text-gray-500">
              {serverTypeLabel(server.type)} {server.version} • porta {server.port} • {server.uptime}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <>
              <button onClick={() => handleAction('restart')} disabled={busy} className="btn-secondary">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reiniciar
              </button>
              <button onClick={() => handleAction('stop')} disabled={busy} className="btn-danger">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
                Parar
              </button>
            </>
          ) : (
            <button onClick={() => handleAction('start')} disabled={busy} className="btn-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Iniciar Servidor
            </button>
          )}
          <button onClick={() => setConfirmDelete(true)} className="btn-ghost !text-red-400 hover:!bg-red-500/10">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Informações rápidas */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <QuickInfo label="Endereço" value={serverAddress} copy />
        <QuickInfo label="Versão" value={`${serverTypeLabel(server.type)} ${server.version}`} />
        <QuickInfo label="Modo" value={gamemodeLabel(server.gamemode)} />
        <QuickInfo label="Dificuldade" value={difficultyLabel(server.difficulty)} />
        <QuickInfo label="Jogadores" value={`${server.playerCount} / ${server.maxPlayers}`} />
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b border-gray-800 overflow-x-auto pb-px">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id
                ? 'border-green-500 text-green-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
            </svg>
            {t.label}
          </button>
        ))}
      </div>

      {/* Conteúdo das abas */}
      <div className="min-h-[400px]">
        {tab === 'console' && <ConsoleTab server={server} ws={ws} />}
        {tab === 'plugins' && <PluginsTab server={server} ws={ws} />}
        {tab === 'worlds' && <WorldsTab server={server} />}
        {tab === 'files' && <FilesTab server={server} />}
        {tab === 'players' && <PlayersTab server={server} />}
        {tab === 'settings' && <SettingsTab server={server} ws={ws} execute={execute} />}
      </div>

      {/* Modal de exclusão */}
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Excluir servidor">
        <p className="text-gray-300 text-sm">
          Tem certeza que deseja excluir o servidor <strong className="text-white">{server.name}</strong>?
          Os arquivos permanecerão no disco, mas o servidor será removido do painel.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setConfirmDelete(false)} className="btn-secondary">Cancelar</button>
          <button onClick={handleDelete} className="btn-danger">Excluir</button>
        </div>
      </Modal>
    </div>
  )
}

function QuickInfo({ label, value, copy }) {
  const [copied, setCopied] = useState(false)
  const onClick = () => {
    if (copy) {
      copyToClipboard(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }
  return (
    <div className={`card px-4 py-3 ${copy ? 'cursor-pointer hover:border-gray-600 transition-colors' : ''}`} onClick={onClick}>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</div>
      <div className="text-sm text-gray-200 font-medium mt-0.5 flex items-center gap-1.5">
        {value}
        {copy && (copied
          ? <span className="text-green-400 text-xs">✓</span>
          : <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        )}
      </div>
    </div>
  )
}

// ===================== CONSOLE =====================
function ConsoleTab({ server, ws }) {
  const [initialLogs, setInitialLogs] = useState([])
  useEffect(() => {
    api.logs(server.id, 100).then(res => setInitialLogs(res.logs || [])).catch(() => {})
  }, [server.id])

  return (
    <div className="h-[500px]">
      <Console serverId={server.id} ws={ws} initialLogs={initialLogs} />
    </div>
  )
}

// ===================== PLUGINS / MODS =====================
function PluginsTab({ server }) {
  const [plugins, setPlugins] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchModal, setSearchModal] = useState(false)
  const [installing, setInstalling] = useState(null)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await api.plugins(server.id)
      setPlugins(res.plugins || [])
    } catch (e) {
      setMessage(e.message)
    } finally {
      setLoading(false)
    }
  }, [server.id])

  useEffect(() => { load() }, [load])

  const doSearch = async () => {
    if (!search.trim()) return
    setSearching(true)
    try {
      const res = await api.searchPlugins({ q: search, type: server.type === 'bds' ? 'mod' : 'plugin', gameVersion: server.version === 'latest' ? '' : server.version, loader: server.type })
      setResults(res.results || [])
    } catch (e) {
      setMessage(e.message)
    } finally {
      setSearching(false)
    }
  }

  const install = async (r) => {
    setInstalling(r.id)
    try {
      if (r.source === 'hangar') {
        await api.installHangar(server.id, r.slug)
      } else {
        await api.installModrinth(server.id, r.id, {
          gameVersion: server.version === 'latest' ? '' : server.version,
          loader: server.type
        })
      }
      setMessage(`"${r.title}" instalado! Reinicie o servidor para ativar.`)
      setSearchModal(false)
      load()
    } catch (e) {
      setMessage(`Erro: ${e.message}`)
    } finally {
      setInstalling(null)
    }
  }

  const remove = async (filename) => {
    if (!confirm(`Remover ${filename}?`)) return
    try {
      await api.removePlugin(server.id, filename)
      load()
    } catch (e) {
      setMessage(e.message)
    }
  }

  const upload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      await api.uploadPlugin(server.id, file)
      setMessage('Plugin enviado! Reinicie o servidor.')
      load()
    } catch (err) {
      setMessage(err.message)
    }
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm flex justify-between items-center">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-gray-500 hover:text-white">✕</button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={() => setSearchModal(true)} className="btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Buscar Plugins/Mods
        </button>
        <label className="btn-secondary cursor-pointer">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Enviar .jar
          <input type="file" accept=".jar,.zip" className="hidden" onChange={upload} />
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : plugins.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">🧩</div>
          <p className="text-gray-400">Nenhum plugin ou mod instalado.</p>
          <p className="text-sm text-gray-600 mt-1">Busque na Modrinth/Hangar ou envie um .jar manualmente.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="table-header">Plugin / Mod</th>
                <th className="table-header">Versão</th>
                <th className="table-header">Tamanho</th>
                <th className="table-header">Instalado</th>
                <th className="table-header text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {plugins.map((p, i) => (
                <tr key={i} className="hover:bg-gray-800/40">
                  <td className="table-cell">
                    <div className="font-medium text-white">{p.title || p.filename}</div>
                    <div className="text-xs text-gray-500">{p.author}</div>
                  </td>
                  <td className="table-cell">{p.version || '-'}</td>
                  <td className="table-cell">{formatMemory(p.size)}</td>
                  <td className="table-cell">{new Date(p.installedAt).toLocaleDateString('pt-BR')}</td>
                  <td className="table-cell text-right">
                    <button onClick={() => remove(p.filename)} className="text-red-400 hover:text-red-300 text-xs font-medium">Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de busca */}
      <Modal open={searchModal} onClose={() => setSearchModal(false)} title="Buscar Plugins & Mods" size="lg">
        <div className="flex gap-2 mb-4">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="Ex: essentialsx, luckyblocks, minigames..."
            className="input"
            autoFocus
          />
          <button onClick={doSearch} disabled={searching} className="btn-primary whitespace-nowrap">
            {searching ? <Spinner size="sm" /> : 'Buscar'}
          </button>
        </div>

        {results.length > 0 && (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {results.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 bg-gray-950 rounded-xl border border-gray-800 hover:border-gray-600 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center overflow-hidden shrink-0">
                  {r.icon
                    ? <img src={r.icon} alt="" className="w-full h-full object-cover" onError={e => e.target.style.display = 'none'} />
                    : <span className="text-lg">🧩</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white text-sm truncate">{r.title}</div>
                  <div className="text-xs text-gray-500 truncate">{r.description}</div>
                  <div className="text-[11px] text-gray-600 mt-0.5">
                    {r.author} • {r.downloads?.toLocaleString()} downloads
                  </div>
                </div>
                <button
                  onClick={() => install(r)}
                  disabled={installing === r.id}
                  className="btn-primary !py-1.5 !px-3 text-xs whitespace-nowrap"
                >
                  {installing === r.id ? <Spinner size="sm" /> : 'Instalar'}
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}

// ===================== MUNDOS =====================
function WorldsTab({ server }) {
  const [worlds, setWorlds] = useState([])
  const [loading, setLoading] = useState(true)
  const [backupBusy, setBackupBusy] = useState(null)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState('')
  const [backups, setBackups] = useState([])

  const load = useCallback(async () => {
    try {
      const [w, b] = await Promise.all([api.worlds(server.id), api.backups(server.id)])
      setWorlds(w.worlds || [])
      setBackups(b.backups || [])
    } catch (e) {
      setMessage(e.message)
    } finally {
      setLoading(false)
    }
  }, [server.id])

  useEffect(() => { load() }, [load])

  const createBackup = async () => {
    setBackupBusy(true)
    try {
      const res = await api.createBackup(server.id)
      setMessage(`Backup "${res.file}" criado!`)
      load()
    } catch (e) {
      setMessage(e.message)
    } finally {
      setBackupBusy(false)
    }
  }

  const exportWorld = async (name) => {
    try {
      const res = await api.exportWorld(server.id, name)
      setMessage(`Mundo "${name}" exportado: ${res.file}`)
      load()
    } catch (e) {
      setMessage(e.message)
    }
  }

  const importWorld = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    try {
      const name = prompt('Nome do mundo (pasta):', 'world')
      if (!name) return
      await api.importWorld(server.id, file, name)
      setMessage('Mundo importado com sucesso!')
      load()
    } catch (err) {
      setMessage(`Erro: ${err.message}`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm flex justify-between items-center">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-gray-500 hover:text-white">✕</button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={createBackup} disabled={backupBusy} className="btn-primary">
          {backupBusy ? <Spinner size="sm" /> : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
          )}
          Backup agora
        </button>
        <label className="btn-secondary cursor-pointer">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Importar mundo (.zip)
          <input type="file" accept=".zip" className="hidden" onChange={importWorld} />
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : worlds.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">🌍</div>
          <p className="text-gray-400">Nenhum mundo encontrado.</p>
          <p className="text-sm text-gray-600 mt-1">Inicie o servidor para gerar o mundo padrão, ou importe um .zip.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {worlds.map(w => (
            <div key={w.name} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🗺️</span>
                  <span className="font-semibold text-white">{w.name}</span>
                  {w.isDefault && <span className="badge bg-green-500/10 text-green-400 text-[10px]">padrão</span>}
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <div>Tamanho: <span className="text-gray-300">{w.sizeHuman}</span></div>
                <div>Regiões: <span className="text-gray-300">{w.regionFiles}</span></div>
                <div>Modificado: <span className="text-gray-300">{new Date(w.modified).toLocaleDateString('pt-BR')}</span></div>
              </div>
              <button onClick={() => exportWorld(w.name)} className="btn-ghost !py-1 text-xs mt-3 w-full">
                Exportar backup
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Backups */}
      {backups.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 bg-gray-900 border-b border-gray-800">
            <h3 className="font-semibold text-white text-sm">Backups ({backups.length})</h3>
          </div>
          <table className="w-full">
            <thead className="bg-gray-900/50">
              <tr>
                <th className="table-header">Arquivo</th>
                <th className="table-header">Tamanho</th>
                <th className="table-header">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {backups.map(b => (
                <tr key={b.name} className="hover:bg-gray-800/40">
                  <td className="table-cell font-mono text-xs">{b.name}</td>
                  <td className="table-cell">{b.sizeHuman}</td>
                  <td className="table-cell">{new Date(b.createdAt).toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ===================== ARQUIVOS =====================
function FilesTab({ server }) {
  const [path, setPath] = useState('')
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [editor, setEditor] = useState(null) // { path, content }
  const [message, setMessage] = useState('')

  const load = useCallback(async (p = '') => {
    setLoading(true)
    try {
      const res = await api.files(server.id, p)
      setFiles(res.files || [])
      setPath(res.path || '')
    } catch (e) {
      setMessage(e.message)
    } finally {
      setLoading(false)
    }
  }, [server.id])

  useEffect(() => { load('') }, [load])

  const openFile = async (f) => {
    if (f.type === 'dir') { load(path ? `${path}/${f.name}` : f.name); return }
    try {
      const res = await api.fileContent(server.id, path ? `${path}/${f.name}` : f.name)
      setEditor({ path: path ? `${path}/${f.name}` : f.name, content: res.content })
    } catch (e) {
      setMessage(e.message)
    }
  }

  const saveEditor = async () => {
    try {
      await api.saveFile(server.id, editor.path, editor.content)
      setMessage('Arquivo salvo!')
      setEditor(null)
    } catch (e) {
      setMessage(e.message)
    }
  }

  const deleteFile = async (f) => {
    if (!confirm(`Apagar ${f.name}?`)) return
    try {
      await api.deleteFile(server.id, path ? `${path}/${f.name}` : f.name)
      load(path)
    } catch (e) {
      setMessage(e.message)
    }
  }

  const upload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      await api.uploadFileTo(server.id, file, path)
      load(path)
    } catch (err) {
      setMessage(err.message)
    }
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm flex justify-between items-center">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-gray-500 hover:text-white">✕</button>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => load('')} className="btn-ghost !py-1.5 text-xs">🏠 Raiz</button>
        {path && (
          <>
            <span className="text-gray-600">/</span>
            <button onClick={() => load(path.split('/').slice(0, -1).join('/'))} className="btn-ghost !py-1.5 text-xs">↑ Subir</button>
          </>
        )}
        <div className="text-sm text-gray-400 font-mono flex-1 truncate px-2 py-1 bg-gray-900 rounded-lg">/{path}</div>
        <label className="btn-secondary cursor-pointer !py-1.5 text-xs">
          Enviar arquivo
          <input type="file" className="hidden" onChange={upload} />
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="table-header">Nome</th>
                <th className="table-header">Tamanho</th>
                <th className="table-header">Modificado</th>
                <th className="table-header text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {files.map(f => (
                <tr key={f.name} className="hover:bg-gray-800/40 cursor-pointer" onClick={() => openFile(f)}>
                  <td className="table-cell">
                    <span className="flex items-center gap-2">
                      <span>{f.type === 'dir' ? '📁' : '📄'}</span>
                      <span className="text-gray-200 font-mono text-xs">{f.name}</span>
                    </span>
                  </td>
                  <td className="table-cell text-xs">{f.type === 'dir' ? '-' : f.sizeHuman}</td>
                  <td className="table-cell text-xs">{new Date(f.modified).toLocaleString('pt-BR')}</td>
                  <td className="table-cell text-right">
                    {f.type === 'file' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteFile(f) }}
                        className="text-red-400 hover:text-red-300 text-xs font-medium"
                      >
                        Apagar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Editor de arquivo */}
      <Modal open={!!editor} onClose={() => setEditor(null)} title={`Editar: ${editor?.path}`} size="lg"
        footer={
          <>
            <button onClick={() => setEditor(null)} className="btn-secondary">Cancelar</button>
            <button onClick={saveEditor} className="btn-primary">Salvar</button>
          </>
        }>
        <textarea
          value={editor?.content || ''}
          onChange={e => setEditor({ ...editor, content: e.target.value })}
          className="w-full h-[400px] bg-gray-950 border border-gray-800 rounded-lg p-3 font-mono text-xs text-gray-200 focus:outline-none focus:border-green-500"
          spellCheck={false}
        />
      </Modal>
    </div>
  )
}

// ===================== JOGADORES =====================
function PlayersTab({ server }) {
  const [lists, setLists] = useState({ whitelist: server.whitelist || [], ops: server.ops || [], banned: server.banned || [] })
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')

  const updateList = async (kind, player, action) => {
    try {
      const res = await api.players(server.id, kind, player, action)
      setLists(prev => ({ ...prev, [kind]: res.list }))
    } catch (e) {
      setMessage(e.message)
    }
  }

  const addPlayer = async (kind) => {
    if (!name.trim()) return
    await updateList(kind, name.trim(), 'add')
    setName('')
  }

  const sections = [
    { id: 'whitelist', title: 'Whitelist', desc: 'Apenas estes jogadores podem entrar', icon: '✅' },
    { id: 'ops', title: 'Operadores (OP)', desc: 'Jogadores com poderes de admin', icon: '⚡' },
    { id: 'banned', title: 'Banidos', desc: 'Bloqueados de entrar', icon: '🚫' }
  ]

  return (
    <div className="space-y-5">
      {message && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">{message}</div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {sections.map(section => (
          <div key={section.id} className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{section.icon}</span>
              <h3 className="font-semibold text-white">{section.title}</h3>
              <span className="badge bg-gray-800 text-gray-400 ml-auto">{lists[section.id].length}</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">{section.desc}</p>

            <div className="flex gap-2 mb-3">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPlayer(section.id)}
                placeholder="Nome do jogador"
                className="input !py-1.5 text-xs"
              />
              <button onClick={() => addPlayer(section.id)} className="btn-primary !py-1.5 text-xs whitespace-nowrap">Adicionar</button>
            </div>

            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {lists[section.id].length === 0 ? (
                <p className="text-xs text-gray-600">Lista vazia</p>
              ) : (
                lists[section.id].map(p => (
                  <div key={p} className="flex items-center justify-between px-3 py-2 bg-gray-950 rounded-lg">
                    <span className="text-sm text-gray-300">{p}</span>
                    <button
                      onClick={() => updateList(section.id, p, 'remove')}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remover
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {server.status === 'running' && (
        <div className="card p-4">
          <h3 className="font-semibold text-white mb-2">Jogadores online agora ({server.players?.length || 0})</h3>
          <div className="flex flex-wrap gap-2">
            {(server.players || []).map(p => (
              <span key={p} className="px-3 py-1.5 bg-green-600/10 border border-green-600/30 rounded-full text-sm text-green-400">
                {p}
              </span>
            ))}
            {(server.players || []).length === 0 && <span className="text-sm text-gray-500">Ninguém online</span>}
          </div>
        </div>
      )}
    </div>
  )
}

// ===================== CONFIGURAÇÕES =====================
function SettingsTab({ server, execute }) {
  const [form, setForm] = useState({
    name: server.name,
    motd: server.motd,
    gamemode: server.gamemode,
    difficulty: server.difficulty,
    pvp: server.pvp,
    onlineMode: server.onlineMode,
    maxPlayers: server.maxPlayers,
    minRam: server.minRam,
    maxRam: server.maxRam,
    port: server.port,
    autoRestart: server.autoRestart,
    autoStart: server.autoStart,
    backupEnabled: server.backupEnabled,
    backupIntervalHours: server.backupIntervalHours,
    geyser: server.geyser
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const update = (k, v) => {
    setForm(f => ({ ...f, [k]: v }))
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    try {
      await api.updateServer(server.id, form)
      setSaved(true)
      setTimeout(() => execute().catch(() => {}), 300)
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-white">Informações básicas</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Nome</label>
            <input value={form.name} onChange={e => update('name', e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Porta</label>
            <input type="number" value={form.port} onChange={e => update('port', e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">MOTD</label>
            <input value={form.motd} onChange={e => update('motd', e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Máx. jogadores</label>
            <input type="number" value={form.maxPlayers} onChange={e => update('maxPlayers', e.target.value)} className="input" />
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-white">Jogo</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Modo de jogo</label>
            <select value={form.gamemode} onChange={e => update('gamemode', e.target.value)} className="input">
              <option value="survival">Sobrevivência</option>
              <option value="creative">Criativo</option>
              <option value="adventure">Aventura</option>
              <option value="spectator">Espectador</option>
            </select>
          </div>
          <div>
            <label className="label">Dificuldade</label>
            <select value={form.difficulty} onChange={e => update('difficulty', e.target.value)} className="input">
              <option value="peaceful">Pacífica</option>
              <option value="easy">Fácil</option>
              <option value="normal">Normal</option>
              <option value="hard">Difícil</option>
            </select>
          </div>
        </div>
        <Toggle label="PvP" checked={form.pvp} onChange={v => update('pvp', v)} />
        <Toggle label="Modo online (Mojang)" checked={form.onlineMode} onChange={v => update('onlineMode', v)} />
      </div>

      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-white">Recursos</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">RAM mínima</label>
            <select value={form.minRam} onChange={e => update('minRam', e.target.value)} className="input">
              {['512M', '1G', '2G', '4G'].map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label">RAM máxima</label>
            <select value={form.maxRam} onChange={e => update('maxRam', e.target.value)} className="input">
              {['1G', '2G', '3G', '4G', '6G', '8G', '12G', '16G'].map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <Toggle label="Auto-restart se travar" checked={form.autoRestart} onChange={v => update('autoRestart', v)} />
        <Toggle label="Auto-start com o daemon" checked={form.autoStart} onChange={v => update('autoStart', v)} />
        <Toggle label="Backup automático" checked={form.backupEnabled} onChange={v => update('backupEnabled', v)} />
        {form.backupEnabled && (
          <div>
            <label className="label">Intervalo de backup (horas)</label>
            <input type="number" value={form.backupIntervalHours} onChange={e => update('backupIntervalHours', e.target.value)} className="input" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? <Spinner size="sm" /> : 'Salvar configurações'}
        </button>
        {saved && <span className="text-green-400 text-sm">✓ Salvo!</span>}
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-1">
      <span className="text-sm text-gray-300">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-green-600' : 'bg-gray-700'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </label>
  )
}