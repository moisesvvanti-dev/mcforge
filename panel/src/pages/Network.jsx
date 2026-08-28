import { useState } from 'react'
import { api } from '../lib/api'
import { useApi } from '../hooks/useApi'
import Spinner from '../components/Spinner'
import { copyToClipboard } from '../lib/utils'

export default function Network({ ws }) {
  const { data, loading, execute } = useApi(() => api.dashboard(), [])
  const [tunnelName, setTunnelName] = useState('minecraft')
  const [tunnelModal, setTunnelModal] = useState(null) // 'create' | 'start' | 'dns'
  const [domain, setDomain] = useState('')
  const [dnsInfo, setDnsInfo] = useState(null)
  const [busy, setBusy] = useState(null)
  const [message, setMessage] = useState('')

  const tunnel = data?.tunnel || { status: 'stopped', installed: false, tunnelName: null, tunnelUrl: null }
  const tunnelStatus = tunnel.status

  const handleCreate = async () => {
    setBusy('create')
    try {
      const res = await api.tunnelCreate(tunnelName)
      setMessage(`Tunnel "${tunnelName}" criado!`)
      execute()
    } catch (e) {
      setMessage(`Erro: ${e.message}`)
    } finally {
      setBusy(null)
      setTunnelModal(null)
    }
  }

  const handleStart = async () => {
    setBusy('start')
    try {
      const res = await api.tunnelStart(tunnelName)
      setMessage('Tunnel iniciado!')
      execute()
    } catch (e) {
      setMessage(`Erro: ${e.message}`)
    } finally {
      setBusy(null)
      setTunnelModal(null)
    }
  }

  const handleStop = async () => {
    setBusy('stop')
    try {
      await api.tunnelStop()
      setMessage('Tunnel parado.')
      execute()
    } catch (e) {
      setMessage(e.message)
    } finally {
      setBusy(null)
    }
  }

  const handleDns = async () => {
    if (!domain.trim()) return
    setBusy('dns')
    try {
      const res = await api.tunnelDns(domain)
      setDnsInfo(res)
    } catch (e) {
      setMessage(e.message)
    } finally {
      setBusy(null)
    }
  }

  const generateConfig = async () => {
    setBusy('config')
    try {
      const res = await api.tunnelGenerate([25565, 19132])
      setMessage('Config do tunnel gerada!')
    } catch (e) {
      setMessage(e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Rede & Tunnel</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Cloudflare Tunnel — domínio personalizado, TLS e proteção DDoS gratuitos
        </p>
      </div>

      {message && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm flex justify-between items-center">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-gray-500 hover:text-white">✕</button>
        </div>
      )}

      {/* Status do Tunnel */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-600/15 flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-white">Cloudflare Tunnel</h2>
              <p className="text-sm text-gray-500">
                {tunnelStatus === 'running'
                  ? 'Tunnel ativo — DDoS, TLS e custom domain ativos'
                  : 'Tunnel inativo — o servidor só roda na rede local'}
              </p>
            </div>
          </div>
          <span className={`badge ${tunnelStatus === 'running' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
            <span className={`w-2 h-2 rounded-full mr-1.5 ${tunnelStatus === 'running' ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
            {tunnelStatus === 'running' ? 'Ativo' : 'Inativo'}
          </span>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <div className="bg-gray-950 rounded-xl p-3">
            <div className="text-gray-500 text-xs">Instalado</div>
            <div className="text-gray-200 font-medium">{tunnel.installed ? '✅ Sim' : '❌ Não'}</div>
          </div>
          <div className="bg-gray-950 rounded-xl p-3">
            <div className="text-gray-500 text-xs">Nome do Tunnel</div>
            <div className="text-gray-200 font-medium">{tunnel.tunnelName || '-'}</div>
          </div>
          <div className="bg-gray-950 rounded-xl p-3">
            <div className="text-gray-500 text-xs">URL</div>
            <div className="text-gray-200 font-medium text-xs truncate">{tunnel.tunnelUrl || '-'}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {tunnelStatus !== 'running' ? (
            <>
              <button onClick={() => setTunnelModal('create')} disabled={busy === 'create'} className="btn-secondary">
                {busy === 'create' ? <Spinner size="sm" /> : 'Criar Tunnel'}
              </button>
              <button onClick={generateConfig} disabled={busy === 'config'} className="btn-secondary">
                {busy === 'config' ? <Spinner size="sm" /> : 'Gerar config'}
              </button>
              <button onClick={() => setTunnelModal('start')} className="btn-primary">
                Iniciar Tunnel
              </button>
            </>
          ) : (
            <button onClick={handleStop} disabled={busy === 'stop'} className="btn-danger">
              {busy === 'stop' ? <Spinner size="sm" /> : 'Parar Tunnel'}
            </button>
          )}
          <button onClick={() => setTunnelModal('dns')} className="btn-ghost">
            Instruções de DNS
          </button>
        </div>
      </div>

      {/* Servidores e portas */}
      <div className="card p-6">
        <h2 className="font-semibold text-white mb-4">Servidores e Portas</h2>
        {data?.servers && Object.keys(data.servers).length > 0 ? (
          <div className="space-y-3">
            {Object.values(data.servers).map(s => (
              <div key={s.id} className="flex items-center justify-between bg-gray-950 rounded-xl p-3">
                <div>
                  <span className="text-gray-200 font-medium">{s.name}</span>
                  <span className="text-gray-500 text-sm ml-2">({s.type})</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-300">Porta {s.port}</span>
                  {s.geyser && <span className="badge bg-cyan-500/10 text-cyan-300 text-[10px]">Bedrock</span>}
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-600 mt-2">
              O Cloudflare Tunnel expõe TODAS as portas configuradas. Seu domínio aponta para o tunnel, que redireciona para cada servidor.
            </p>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Crie um servidor primeiro para ver as portas aqui.</p>
        )}
      </div>

      {/* Info Cloudflare */}
      <div className="card p-6">
        <h2 className="font-semibold text-white mb-3">🛡️ Como funciona a segurança</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-950 rounded-xl p-4">
            <h3 className="font-medium text-green-400 mb-1">Proteção DDoS</h3>
            <p className="text-gray-400 text-xs">Todo tráfego passa pelo Cloudflare, que filtra ataques DDoS antes de chegar ao seu servidor. Plano Free já inclui proteção contra ataques de até 500 Gbps.</p>
          </div>
          <div className="bg-gray-950 rounded-xl p-4">
            <h3 className="font-medium text-green-400 mb-1">TLS / Criptografia</h3>
            <p className="text-gray-400 text-xs">O Cloudflare termina o TLS na borda da rede. A conexão entre o jogador e o Cloudflare é criptografada. O tunnel usa conexão segura entre Cloudflare e seu PC.</p>
          </div>
          <div className="bg-gray-950 rounded-xl p-4">
            <h3 className="font-medium text-green-400 mb-1">Domínio Personalizado</h3>
            <p className="text-gray-400 text-xs">Adicione seu domínio ao Cloudflare (DNS), crie um registro CNAME apontando para o tunnel. Jogadores conectam usando seu domínio, sem IP exposto.</p>
          </div>
          <div className="bg-gray-950 rounded-xl p-4">
            <h3 className="font-medium text-green-400 mb-1">IP Oculto</h3>
            <p className="text-gray-400 text-xs">Seu IP real nunca é exposto. O Cloudflare proxy (laranja) mascara seu IP. Ataques diretos ao seu IP não funcionam — só o Cloudflare vê o servidor real.</p>
          </div>
        </div>
      </div>

      {/* Modal DNS */}
      {tunnelModal === 'create' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setTunnelModal(null)}>
          <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-white mb-4">Criar Tunnel</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Nome do tunnel</label>
                <input value={tunnelName} onChange={e => setTunnelName(e.target.value)} className="input" />
              </div>
              <p className="text-xs text-gray-500">
                Requer cloudflared instalado e logado. Execute primeiro: <code className="text-green-400">cloudflared tunnel login</code>
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setTunnelModal(null)} className="btn-secondary">Cancelar</button>
                <button onClick={handleCreate} className="btn-primary">Criar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tunnelModal === 'start' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setTunnelModal(null)}>
          <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-white mb-4">Iniciar Tunnel</h3>
            <p className="text-sm text-gray-300 mb-1">Nome do tunnel para iniciar:</p>
            <input value={tunnelName} onChange={e => setTunnelName(e.target.value)} className="input mb-4" />
            <p className="text-xs text-gray-500 mb-4">
              O tunnel precisa estar criado e a config gerada antes de iniciar.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setTunnelModal(null)} className="btn-secondary">Cancelar</button>
              <button onClick={handleStart} className="btn-primary">Iniciar</button>
            </div>
          </div>
        </div>
      )}

      {tunnelModal === 'dns' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setTunnelModal(null)}>
          <div className="w-full max-w-xl bg-gray-900 border border-gray-800 rounded-2xl p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-white mb-4">Instruções de DNS</h3>

            <div className="space-y-3 mb-4">
              <div>
                <label className="label">Seu domínio (ex: mc.meuservidor.com)</label>
                <div className="flex gap-2">
                  <input value={domain} onChange={e => setDomain(e.target.value)} placeholder="mc.seusite.com" className="input" />
                  <button onClick={handleDns} disabled={busy === 'dns'} className="btn-primary">
                    {busy === 'dns' ? <Spinner size="sm" /> : 'Gerar'}
                  </button>
                </div>
              </div>
            </div>

            {dnsInfo && (
              <div className="space-y-4 animate-fade-in">
                <div className="bg-gray-950 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-white mb-2">Registro CNAME</h4>
                  <div className="font-mono text-xs bg-gray-900 rounded-lg p-3 text-gray-300">
                    <div>Tipo: <span className="text-green-400">CNAME</span></div>
                    <div>Nome: <span className="text-green-400">{dnsInfo.cname?.name || domain}</span></div>
                    <div>Alvo: <span className="text-green-400">{dnsInfo.cname?.target}</span></div>
                    <div>Proxy (laranja): <span className="text-green-400">Sim</span></div>
                  </div>
                </div>

                <div className="bg-gray-950 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-white mb-2">Registro SRV (para Minecraft)</h4>
                  <div className="font-mono text-xs bg-gray-900 rounded-lg p-3 text-gray-300">
                    <div>Tipo: <span className="text-green-400">SRV</span></div>
                    <div>Nome: <span className="text-green-400">{dnsInfo.srv?.name}</span></div>
                    <div>Valor: <span className="text-green-400">{dnsInfo.srv?.content}</span></div>
                  </div>
                </div>

                <div className="bg-gray-950 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-white mb-2">Passos no Cloudflare</h4>
                  <ol className="text-xs text-gray-400 space-y-1.5 list-decimal list-inside">
                    <li>Adicione seu domínio ao Cloudflare (plano Free)</li>
                    <li>Vá em DNS → Adicione o registro CNAME acima</li>
                    <li>Certifique-se de que o proxy está laranja ☁️</li>
                    <li>Adicione o registro SRV para Minecraft</li>
                    <li>Jogadores conectam usando: <strong className="text-green-400">{domain}</strong></li>
                    <li>A proteção DDoS e TLS são automáticas</li>
                  </ol>
                </div>
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button onClick={() => { setTunnelModal(null); setDnsInfo(null) }} className="btn-secondary">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}