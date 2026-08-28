import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useServers } from '../hooks/useApi'
import ServerCard from '../components/ServerCard'
import Spinner from '../components/Spinner'

export default function Servers({ ws }) {
  const { servers, loading, error, refresh } = useServers()
  const [busy, setBusy] = useState(null)
  const [filter, setFilter] = useState('all')

  const handleAction = async (id, action) => {
    setBusy(id)
    try {
      if (action === 'start') await api.startServer(id)
      if (action === 'stop') await api.stopServer(id)
      if (action === 'restart') await api.restartServer(id)
      setTimeout(() => refresh(), 400)
    } catch (e) {
      alert(e.message)
    } finally {
      setBusy(null)
    }
  }

  const list = Object.values(servers || {})
  const filtered = list.filter(s =>
    filter === 'all' ? true : filter === 'running' ? s.status === 'running' : s.status === 'stopped'
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Servidores</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {list.length} servidor(es) • {list.filter(s => s.status === 'running').length} online
          </p>
        </div>
        <Link to="/servers/new" className="btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Servidor
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {['all', 'running', 'stopped'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === f
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {f === 'all' ? 'Todos' : f === 'running' ? 'Online' : 'Offline'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : error ? (
        <div className="card p-8 text-center">
          <p className="text-red-400">{error}</p>
          <p className="text-sm text-gray-500 mt-2">Verifique se o daemon está rodando.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-3">🗺️</div>
          <p className="text-gray-400 mb-1">
            {list.length === 0 ? 'Nenhum servidor criado ainda.' : 'Nenhum servidor neste filtro.'}
          </p>
          <p className="text-sm text-gray-600 mb-5">
            Crie seu primeiro servidor Minecraft gratuitamente.
          </p>
          <Link to="/servers/new" className="btn-primary">Criar Servidor</Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map(s => (
            <ServerCard
              key={s.id}
              server={s}
              busy={busy === s.id}
              onStart={(id) => handleAction(id, 'start')}
              onStop={(id) => handleAction(id, 'stop')}
              onRestart={(id) => handleAction(id, 'restart')}
            />
          ))}
        </div>
      )}
    </div>
  )
}