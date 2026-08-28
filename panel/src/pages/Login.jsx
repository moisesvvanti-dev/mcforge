import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setToken, setDaemonUrl as persistDaemonUrl } from '../lib/api'
import Spinner from '../components/Spinner'

// Detecta se o painel está rodando no mesmo lugar do daemon (localhost)
function isLocalEnvironment() {
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1' || host === ''
}

export default function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isFirstSetup, setIsFirstSetup] = useState(false)
  const [daemonUrl, setUrlInput] = useState(localStorage.getItem('mcforge_daemon_url') || '')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null) // null | {ok, msg}
  const localEnv = isLocalEnvironment()

  // Em ambiente local o campo de URL não é necessário
  const showUrlField = !localEnv || daemonUrl !== ''

  // Verificar se é primeira execução (quando conectado)
  useEffect(() => {
    const check = async () => {
      try {
        const res = await api.authStatus()
        setIsFirstSetup(!res.initialized)
      } catch {
        // Daemon inacessível — segue em frente, o login mostrará o erro
      }
    }
    check()
  }, [])

  const saveUrlIfNeeded = () => {
    if (daemonUrl.trim()) {
      persistDaemonUrl(daemonUrl.trim())
    } else if (!localEnv) {
      // Em GitHub Pages/Netlify sem URL, tenta o proxy relativo
      persistDaemonUrl('')
    }
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    saveUrlIfNeeded()
    try {
      const res = await api.health()
      setTestResult({ ok: true, msg: `Daemon conectado! (${res.status})` })
    } catch (e) {
      setTestResult({ ok: false, msg: `Falha: ${e.message}` })
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      saveUrlIfNeeded()
      const result = await api.login(username || 'admin', password)
      setToken(result.token)
      if (result.firstLogin) {
        setIsFirstSetup(false)
      }
      navigate('/')
    } catch (err) {
      setError(err.message || 'Falha no login')
      // Se o erro parece de conexão, mostra dica
      if (/fetch|network|502|404|Failed to fetch|inacess|Erro \d+/i.test(err.message)) {
        setError(`${err.message} — Confira a URL do daemon abaixo e use "Testar conexão".`)
      }
    } finally {
      setLoading(false)
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

          {!localEnv && (
            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-300 text-xs">
              🌐 Painel hospedado na nuvem. Conecte ao daemon do seu PC para continuar.
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

          {/* URL do daemon — sempre visível quando o painel não está no mesmo local que o daemon */}
          {(showUrlField || !localEnv) && (
            <div className="mt-4 pt-4 border-t border-gray-800 animate-fade-in">
              <label className="label">
                URL do daemon {localEnv ? '(opcional — use só se o daemon estiver em outra máquina)' : '(obrigatória — onde o daemon está rodando)'}
              </label>
              <input
                type="text"
                value={daemonUrl}
                onChange={e => {
                  setUrlInput(e.target.value)
                  setTestResult(null)
                }}
                placeholder={localEnv ? 'http://localhost:3000' : 'https://seu-tunnel.trycloudflare.com'}
                className="input"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                {localEnv
                  ? 'Deixe vazio se o painel está rodando junto com o daemon (localhost).'
                  : 'Ex: https://seu-tunnel.trycloudflare.com (Cloudflare Tunnel) ou http://SEU_IP:3000 (port forwarding).'}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <button type="button" onClick={testConnection} disabled={testing} className="btn-secondary !py-1.5 text-xs">
                  {testing ? <Spinner size="sm" /> : '🔌 Testar conexão'}
                </button>
                {testResult && (
                  <span className={`text-xs ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                    {testResult.msg}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Gratuito • Rode no seu PC ou VPS • Proteção DDoS via Cloudflare
        </p>
      </div>
    </div>
  )
}