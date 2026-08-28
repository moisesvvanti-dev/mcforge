import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setToken, setUser, isHostedStaticPage, getGitHubRepoInfo, setDaemonUrl, autoDiscoverDaemonUrl } from '../lib/api'
import Spinner from '../components/Spinner'

// Avaliador de força de senha
function evaluatePasswordStrength(password) {
  if (!password) return { score: 0, label: '', color: 'bg-gray-700', textClass: 'text-gray-500' }
  let score = 0
  if (password.length >= 6) score += 1
  if (password.length >= 10) score += 1
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1

  if (score <= 1) return { score: 1, label: 'Fraca', color: 'bg-red-500', textClass: 'text-red-400' }
  if (score <= 3) return { score: 2, label: 'Média', color: 'bg-amber-500', textClass: 'text-amber-400' }
  if (score === 4) return { score: 3, label: 'Boa', color: 'bg-emerald-500', textClass: 'text-emerald-400' }
  return { score: 4, label: 'Excelente', color: 'bg-cyan-400', textClass: 'text-cyan-300' }
}

export default function Login() {
  const navigate = useNavigate()
  const isHosted = isHostedStaticPage()
  const repoInfo = getGitHubRepoInfo()

  // Tabs: 'login' | 'register'
  const [tab, setTab] = useState('login')

  // Form states
  const [username, setUsername] = useState(localStorage.getItem('mcforge_saved_user') || '')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [rememberUser, setRememberUser] = useState(true)

  // Status & loading
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isFirstSetup, setIsFirstSetup] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('checking') // 'checking' | 'connected' | 'offline'
  const [pingMs, setPingMs] = useState(null)
  const [customTunnel, setCustomTunnel] = useState('')
  const [showManualInput, setShowManualInput] = useState(false)

  const passwordStrength = useMemo(() => evaluatePasswordStrength(password), [password])
  const passwordsMatch = !confirmPassword || password === confirmPassword

  const [publicData, setPublicData] = useState(null)

  // Verificar status inicial do servidor e carregar opções públicas
  const checkConnection = async () => {
    const start = performance.now()
    try {
      if (isHosted) {
        await autoDiscoverDaemonUrl()
      }
      const [authStat, info] = await Promise.all([
        api.authStatus(),
        api.publicInfo().catch(() => api.health())
      ])
      const latency = Math.round(performance.now() - start)
      setPingMs(latency)
      setConnectionStatus('connected')
      setPublicData(info)
      setError('')
      if (!authStat.initialized) {
        setIsFirstSetup(true)
        setTab('register')
      }
    } catch {
      setConnectionStatus('offline')
      setPingMs(null)
    }
  }

  useEffect(() => {
    checkConnection()
    // Se estiver offline no GitHub Pages, tenta reconectar a cada 5s
    const interval = setInterval(() => {
      if (connectionStatus === 'offline' || connectionStatus === 'checking') {
        checkConnection()
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [connectionStatus])

  // Limpa mensagens ao trocar de aba
  useEffect(() => {
    setError('')
    setSuccessMsg('')
  }, [tab])

  // Submissão do Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)

    const finalUsername = (username || 'admin').trim()

    if (!password) {
      setError('Por favor, informe a sua senha.')
      setLoading(false)
      return
    }

    try {
      const result = await api.login(finalUsername, password)
      
      if (result.token) {
        setToken(result.token)
        if (result.user) setUser(result.user)
        if (rememberUser && finalUsername) {
          localStorage.setItem('mcforge_saved_user', finalUsername)
        } else {
          localStorage.removeItem('mcforge_saved_user')
        }
        navigate('/')
      } else {
        setError('Resposta inválida do servidor.')
      }
    } catch (err) {
      setError(err.message || 'Falha ao autenticar. Verifique seus dados.')
    } finally {
      setLoading(false)
    }
  }

  // Submissão de Registro
  const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    const finalUsername = username.trim()

    if (!finalUsername) {
      setError('Por favor, escolha um nome de usuário.')
      return
    }

    if (finalUsername.length < 3) {
      setError('O nome de usuário deve ter pelo menos 3 caracteres.')
      return
    }

    if (!password || password.length < 6) {
      setError('A senha deve conter no mínimo 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas digitadas não coincidem. Verifique e tente novamente.')
      return
    }

    setLoading(true)

    try {
      const result = await api.register(finalUsername, password, name.trim())
      
      if (result.token) {
        setToken(result.token)
        if (result.user) setUser(result.user)
        if (rememberUser) {
          localStorage.setItem('mcforge_saved_user', finalUsername)
        }
        setIsFirstSetup(false)
        navigate('/')
      } else {
        setSuccessMsg('Conta criada com sucesso! Você já pode entrar.')
        setTab('login')
      }
    } catch (err) {
      setError(err.message || 'Falha ao registrar usuário.')
    } finally {
      setLoading(false)
    }
  }

  const handleApplyCustomTunnel = async (e) => {
    e.preventDefault()
    if (!customTunnel.trim()) return
    setDaemonUrl(customTunnel.trim())
    setConnectionStatus('checking')
    await checkConnection()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 relative overflow-hidden px-4 py-12 selection:bg-green-500 selection:text-black">
      {/* Background Decorativo com Malha Gradiente e Orbes Neon */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-green-500/20 to-emerald-800/10 blur-[130px] animate-pulse-slow" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-tl from-cyan-600/20 to-blue-700/10 blur-[140px] animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-emerald-950/20 blur-[160px]" />
        
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }}
        />
      </div>

      <div className="relative w-full max-w-md z-10">
        {/* Header com Logo Isométrico Stylized */}
        <div className="text-center mb-8">
          <div className="relative inline-block group">
            <div className="absolute -inset-1.5 bg-gradient-to-r from-green-500 via-emerald-400 to-cyan-500 rounded-3xl blur-md opacity-75 group-hover:opacity-100 transition duration-500 group-hover:duration-200 animate-pulse-slow" />
            <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gray-900 border border-green-500/30 text-white shadow-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-transparent pointer-events-none" />
              <svg className="w-11 h-11 text-green-400 drop-shadow-[0_0_12px_rgba(74,222,128,0.6)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-100 to-gray-300 tracking-tight mt-4">
            MCForge
          </h1>
          <p className="text-gray-400 text-sm mt-1 flex items-center justify-center gap-2">
            <span>Hospedagem de Minecraft</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            <span className="text-gray-500 text-xs font-mono">v1.0</span>
          </p>

          {/* Status do Servidor em Tempo Real */}
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-gray-900/80 border border-gray-800 backdrop-blur">
            <span className="relative flex h-2 w-2">
              {connectionStatus === 'connected' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                connectionStatus === 'connected' ? 'bg-green-500' :
                connectionStatus === 'checking' ? 'bg-amber-400 animate-pulse' : 'bg-red-500'
              }`} />
            </span>
            <span className="text-gray-300">
              {connectionStatus === 'connected' && (pingMs !== null ? `Servidor Conectado • ${pingMs}ms` : 'Servidor Conectado')}
              {connectionStatus === 'checking' && 'Conectando ao sistema...'}
              {connectionStatus === 'offline' && 'Servidor Offline na Nuvem'}
            </span>
          </div>

          {/* Opções Públicas Disponíveis no Servidor (Sem precisar logar para visualizar) */}
          {connectionStatus === 'connected' && (
            <div className="mt-3 flex items-center justify-center gap-1.5 flex-wrap animate-fade-in">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                ⚡ Paper & Purpur
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-400">
                ☕ Java 21
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/10 border border-purple-500/20 text-purple-400">
                🛡️ Cloudflare DDoS
              </span>
            </div>
          )}
        </div>

        {/* Card de Aviso Quando o Servidor no GitHub Actions Está Offline */}
        {connectionStatus === 'offline' && isHosted && (
          <div className="mb-6 bg-gray-900/95 border border-amber-500/40 rounded-3xl p-5 shadow-2xl animate-slide-up text-left">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400 shrink-0 mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-white">Servidor Desligado no GitHub Actions</h3>
                <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                  Para fazer login e usar seus servidores, inicie o workflow no GitHub Actions com 1 clique:
                </p>

                <div className="mt-3 flex flex-col gap-2">
                  <a
                    href={`https://github.com/${repoInfo.user}/${repoInfo.repo}/actions`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary !py-2 !px-4 text-xs font-bold text-center !rounded-xl shadow-lg shadow-green-900/30 flex items-center justify-center gap-2"
                  >
                    <span>▶️ Iniciar Servidor no GitHub Actions</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>

                  <button
                    type="button"
                    onClick={() => setShowManualInput(!showManualInput)}
                    className="text-[11px] text-gray-400 hover:text-gray-200 text-center underline py-1"
                  >
                    {showManualInput ? 'Ocultar inserção manual de URL' : 'Já tem o link https://xxx.trycloudflare.com? Clique aqui'}
                  </button>

                  {showManualInput && (
                    <form onSubmit={handleApplyCustomTunnel} className="mt-2 space-y-2 animate-fade-in">
                      <input
                        type="text"
                        value={customTunnel}
                        onChange={e => setCustomTunnel(e.target.value)}
                        placeholder="https://seu-tunnel.trycloudflare.com"
                        className="input !py-1.5 text-xs font-mono"
                      />
                      <button type="submit" className="btn-secondary w-full !py-1.5 text-xs">
                        Conectar a este Túnel
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Card Principal com Glassmorphism */}
        <div className="bg-gray-900/85 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.7)] transition-all">
          {/* Banner de Primeira Execução */}
          {isFirstSetup && (
            <div className="mb-6 p-4 bg-gradient-to-r from-emerald-500/15 via-green-500/10 to-transparent border border-emerald-500/30 rounded-2xl animate-fade-in flex items-start gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-300">🚀 Primeira Execução</h4>
                <p className="text-xs text-gray-300 mt-0.5 leading-relaxed">
                  Crie sua conta de <strong>Administrador</strong> para começar a gerenciar seus servidores.
                </p>
              </div>
            </div>
          )}

          {/* Navegação por Abas */}
          <div className="flex bg-gray-950/70 p-1.5 rounded-2xl border border-gray-800 mb-6 gap-1">
            <button
              type="button"
              onClick={() => setTab('login')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                tab === 'login'
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-900/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Entrar
            </button>

            <button
              type="button"
              onClick={() => setTab('register')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                tab === 'register'
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-900/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              {isFirstSetup ? 'Criar Admin' : 'Registrar'}
            </button>
          </div>

          {/* Mensagens de Sucesso e Erro */}
          {error && (
            <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs sm:text-sm flex items-start gap-3 animate-slide-up">
              <svg className="w-5 h-5 shrink-0 text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3.5 bg-green-500/10 border border-green-500/30 rounded-2xl text-green-400 text-xs sm:text-sm flex items-start gap-3 animate-slide-up">
              <svg className="w-5 h-5 shrink-0 text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="leading-relaxed">{successMsg}</span>
            </div>
          )}

          {/* ======================= ABA: LOGIN ======================= */}
          {tab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4 animate-fade-in">
              <div>
                <label className="label flex items-center justify-between">
                  <span>Nome de Usuário</span>
                  <span className="text-[11px] text-gray-500 lowercase">ex: admin</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="admin"
                    className="input !pl-10 !py-2.5 !bg-gray-950/60 !border-gray-800 focus:!border-green-500 focus:!ring-green-500/30"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label className="label flex items-center justify-between">
                  <span>Senha</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Sua senha de acesso"
                    className="input !pl-10 !pr-10 !py-2.5 !bg-gray-950/60 !border-gray-800 focus:!border-green-500 focus:!ring-green-500/30"
                    autoComplete="current-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 text-gray-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberUser}
                    onChange={e => setRememberUser(e.target.checked)}
                    className="w-4 h-4 rounded bg-gray-950 border-gray-700 text-green-600 focus:ring-green-500 focus:ring-offset-gray-950"
                  />
                  <span>Lembrar meu usuário</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || !password}
                className="btn-primary w-full !py-3 !rounded-xl font-bold flex items-center justify-center gap-2 mt-2 transition-all active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <Spinner size="sm" />
                    <span>Entrando no painel...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar no Painel</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          )}

          {/* ======================= ABA: REGISTRO / CRIAR CONTA ======================= */}
          {tab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4 animate-fade-in">
              <div>
                <label className="label flex items-center justify-between">
                  <span>Nome de Usuário (Login)</span>
                  <span className="text-[11px] text-gray-500">letras, números ou _</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder={isFirstSetup ? 'admin' : 'seu_usuario'}
                    className="input !pl-10 !py-2.5 !bg-gray-950/60 !border-gray-800 focus:!border-green-500 focus:!ring-green-500/30"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label flex items-center justify-between">
                  <span>Nome Completo ou Apelido (Opcional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ex: Steve da Silva"
                    className="input !pl-10 !py-2.5 !bg-gray-950/60 !border-gray-800 focus:!border-green-500 focus:!ring-green-500/30"
                  />
                </div>
              </div>

              <div>
                <label className="label flex items-center justify-between">
                  <span>Senha</span>
                  {password && (
                    <span className={`text-[11px] font-semibold ${passwordStrength.textClass}`}>
                      Força: {passwordStrength.label}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="input !pl-10 !pr-10 !py-2.5 !bg-gray-950/60 !border-gray-800 focus:!border-green-500 focus:!ring-green-500/30"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Barra de Força da Senha */}
                {password && (
                  <div className="mt-2 flex gap-1 h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-300 ${passwordStrength.score >= 1 ? passwordStrength.color : 'bg-transparent'}`} style={{ width: '25%' }} />
                    <div className={`h-full transition-all duration-300 ${passwordStrength.score >= 2 ? passwordStrength.color : 'bg-transparent'}`} style={{ width: '25%' }} />
                    <div className={`h-full transition-all duration-300 ${passwordStrength.score >= 3 ? passwordStrength.color : 'bg-transparent'}`} style={{ width: '25%' }} />
                    <div className={`h-full transition-all duration-300 ${passwordStrength.score >= 4 ? passwordStrength.color : 'bg-transparent'}`} style={{ width: '25%' }} />
                  </div>
                )}
              </div>

              <div>
                <label className="label flex items-center justify-between">
                  <span>Confirmar Senha</span>
                  {confirmPassword && (
                    <span className={`text-[11px] ${passwordsMatch ? 'text-green-400' : 'text-red-400'}`}>
                      {passwordsMatch ? '✓ Senhas coincidem' : '✗ Senhas não coincidem'}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    className={`input !pl-10 !pr-10 !py-2.5 !bg-gray-950/60 ${
                      confirmPassword && !passwordsMatch
                        ? '!border-red-500/80 focus:!ring-red-500/30'
                        : '!border-gray-800 focus:!border-green-500 focus:!ring-green-500/30'
                    }`}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showConfirmPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !username || !password || (confirmPassword && !passwordsMatch)}
                className="btn-primary w-full !py-3 !rounded-xl font-bold flex items-center justify-center gap-2 mt-2 transition-all active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <Spinner size="sm" />
                    <span>Criando conta e entrando...</span>
                  </>
                ) : (
                  <>
                    <span>{isFirstSetup ? 'Definir Senha Mestre & Entrar' : 'Criar Conta e Entrar'}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Rodapé Elegante */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              100% Gratuito & Open-Source
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Anti-DDoS & Cloudflare
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}