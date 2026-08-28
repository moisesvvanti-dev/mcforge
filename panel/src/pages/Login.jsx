import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setToken, setDaemonUrl } from '../lib/api'
import Spinner from '../components/Spinner'

export default function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isFirstSetup, setIsFirstSetup] = useState(false)
  const [daemonUrl, setDaemonUrl] = useState(localStorage.getItem('mcforge_daemon_url') || '')
  const [showUrl, setShowUrl] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (daemonUrl.trim()) {
        setDaemonUrl(daemonUrl.trim())
      }
      const result = await api.login(username || 'admin', password)
      setToken(result.token)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Falha no login')
    } finally {
      setLoading(false)
    }
  }

  const checkSetup = async () => {
    try {
      const res = await api.authStatus()
      setIsFirstSetup(!res.initialized)
    } catch {
      // Se não conseguir conectar, mostra o campo de URL
      setShowUrl(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 relative overflow-hidden">
      {/* Background decorativo */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-green-600/30 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-blue-600/30 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-green-400 to-green-700 shadow-glow mb-4">
            <svg className="w-9 h-9 text-gray-950" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 3h12v4H6V3zm0 14h12v4H6v-4zm2-10h8v2H8V7zm0 6h8v2H8v-2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-white">MCForge</h1>
          <p className="text-gray-500 mt-1">Painel de hospedagem de Minecraft</p>
        </div>

        <div className="card p-6 shadow-2xl">
          {isFirstSetup && (
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
              <strong>Primeira execução!</strong> Defina a senha mestre do seu painel.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nome de usuário</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                className="input"
              />
            </div>

            <div>
              <label className="label">Senha</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={isFirstSetup ? 'Crie uma senha forte' : 'Sua senha'}
                className="input"
                autoFocus
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !password} className="btn-primary w-full !py-3">
              {loading ? <Spinner size="sm" /> : isFirstSetup ? 'Definir Senha e Entrar' : 'Entrar'}
            </button>
          </form>

          <div className="mt-4">
            <button
              onClick={() => setShowUrl(!showUrl)}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              {showUrl ? 'Ocultar' : '▶'} Configurar URL do daemon (Netlify)
            </button>
            {showUrl && (
              <div className="mt-2 animate-fade-in">
                <label className="label">URL do daemon (ex: https://seu-tunnel.trycloudflare.com)</label>
                <input
                  type="text"
                  value={daemonUrl}
                  onChange={e => setDaemonUrl(e.target.value)}
                  placeholder="http://localhost:3000"
                  className="input"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Deixe vazio se o painel está rodando junto com o daemon (localhost).
                </p>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Gratuito • Rode no seu PC ou VPS • Proteção DDoS via Cloudflare
        </p>
      </div>
    </div>
  )
}