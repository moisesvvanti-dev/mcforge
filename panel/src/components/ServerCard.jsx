import { Link } from 'react-router-dom'
import StatusBadge from './StatusBadge'
import { serverTypeLabel, serverTypeColor, formatMemory } from '../lib/utils'

export default function ServerCard({ server, onStart, onStop, onRestart, busy }) {
  const isRunning = server.status === 'running'

  return (
    <div className="card p-5 hover:border-gray-700 transition-colors group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg ${serverTypeColor(server.type)}`}>
            {server.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <Link to={`/servers/${server.id}`} className="font-semibold text-white hover:text-green-400 transition-colors">
              {server.name}
            </Link>
            <div className="text-xs text-gray-500">
              {serverTypeLabel(server.type)} {server.version} • porta {server.port}
            </div>
          </div>
        </div>
        <StatusBadge status={server.status} />
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {server.playerCount} online
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {server.uptime}
        </span>
        {server.memory && (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {formatMemory(server.memory)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isRunning ? (
          <>
            <button
              onClick={() => onRestart(server.id)}
              disabled={busy}
              className="btn-ghost !py-1.5 text-xs"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reiniciar
            </button>
            <button
              onClick={() => onStop(server.id)}
              disabled={busy}
              className="btn-danger !py-1.5 text-xs"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              Parar
            </button>
          </>
        ) : (
          <button
            onClick={() => onStart(server.id)}
            disabled={busy}
            className="btn-primary !py-1.5 text-xs"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Iniciar
          </button>
        )}
        <Link to={`/servers/${server.id}`} className="btn-ghost !py-1.5 text-xs ml-auto">
          Gerenciar →
        </Link>
      </div>
    </div>
  )
}