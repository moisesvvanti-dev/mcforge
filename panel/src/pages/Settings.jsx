import { useState, useEffect } from 'react'
import { api, setDaemonUrl, getBase } from '../lib/api'
import { useApi } from '../hooks/useApi'
import Spinner from '../components/Spinner'
import { copyToClipboard } from '../lib/utils'

export default function Settings() {
  const { data, loading, execute } = useApi(() => api.system(), [])
  const [daemonUrl, setUrlState] = useState(getBase())
  const [configForm, setConfigForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [message, setMessage] = useState('')
  const [publicIp, setPublicIp] = useState('')
  const [detectingIp, setDetectingIp] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const config = data?.config
  const system = data?.system

  // Detectar IP público via daemon
  const detectIp = async () => {
    setDetectingIp(true)
    try {
      const res = await api.publicIp()
      setPublicIp(res.ip || '')
      if (!res.ip) setMessage('Não foi possível detectar o IP público (sem internet ou bloqueado).')
    } catch (e) {
      setMessage(`Erro ao detectar IP: ${e.message}`)
    } finally {
      setDetectingIp(false)
    }
  }

  // Testar conexão com o daemon
  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await api.health()
      const origin = getBase() || window.location.origin
      setTestResult({ ok: true, origin })
    } catch (e) {
      setTestResult({ ok: false, error: e.message })
    } finally {
      setTesting(false)
    }
  }

  // Detectar IP público automaticamente quando o sistema carrega
  useEffect(() => {
    if (!loading && system) {
      detectIp().catch(() => {})
    }
  }, [loading]) // eslint-disable-line

  const saveConfig = async () => {
    if (!configForm) return
    setSaving(true)
    try {
      await api.updateConfig(configForm)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setMessage(e.message)
    } finally {
      setSaving(false)
    }
  }

  const update = (k, v) => {
    setConfigForm(f => ({ ...f, [k]: v }))
    setSaved(false)
  }

  const handleUrlSave = () => {
    setDaemonUrl(daemonUrl.trim())
    setMessage('URL do daemon salva! Recarregue a página se necessário.')
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-gray-500 text-sm mt-0.5">Configurações do daemon e do painel</p>
      </div>

      {message && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">{message}</div>
      )}

      {/* Conexão com o daemon */}
      <div className="card p-6">
        <h2 className="font-semibold text-white mb-1">Conexão com o Daemon</h2>
        <p className="text-sm text-gray-500 mb-4">
          Quando o painel está no Netlify, ele precisa saber a URL pública do daemon (via Cloudflare Tunnel).
        </p>
        <div className="flex gap-2 max-w-lg">
          <input
            value={daemonUrl}
            onChange={e => setUrlState(e.target.value)}
            placeholder="https://seu-tunnel.trycloudflare.com"
            className="input"
          />
          <button onClick={handleUrlSave} className="btn-primary whitespace-nowrap">Salvar URL</button>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          Em desenvolvimento local (localhost), deixe vazio — o painel usa o proxy automático.
        </p>
      </div>

      {/* Endereços da sua máquina */}
      <div className="card p-6">
        <h2 className="font-semibold text-white mb-1">Endereços da sua máquina</h2>
        <p className="text-sm text-gray-500 mb-4">
          Use estas informações para port forwarding no roteador e para configurar o DAEMON_URL no Netlify.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          {/* IP local */}
          <div className="bg-gray-950 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">IPs locais (rede)</div>
            {system?.localIPs && system.localIPs.length > 0 ? (
              <div className="space-y-1.5">
                {system.localIPs.map((ip, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{ip.name}</span>
                    <code className="text-sm text-green-400 font-mono">{ip.address}</code>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Não disponível</p>
            )}
            <button
              onClick={() => copyToClipboard('192.168.42.183')}
              className="text-xs text-gray-500 hover:text-white mt-2"
            >
              ⓘ No seu PC, o IP local aparece no prompt: <code className="text-green-400">ipconfig</code>
            </button>
          </div>

          {/* IP público */}
          <div className="bg-gray-950 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">IP público (internet)</div>
            {publicIp ? (
              <code className="text-lg text-green-400 font-mono">{publicIp}</code>
            ) : (
              <p className="text-sm text-gray-500">Clique em "Detectar" abaixo</p>
            )}
            <div className="flex gap-2 mt-3">
              <button onClick={detectIp} disabled={detectingIp} className="btn-secondary !py-1.5 text-xs">
                {detectingIp ? <Spinner size="sm" /> : '🔄 Detectar IP'}
              </button>
              {publicIp && (
                <button onClick={() => copyToClipboard(publicIp)} className="btn-ghost !py-1.5 text-xs">
                  Copiar
                </button>
              )}
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Seu IP público é o endereço que o Netlify precisa para alcançar seu PC.
            </p>
          </div>
        </div>

        {/* Port forwarding */}
        <div className="bg-gray-950 rounded-xl p-4">
          <h3 className="text-sm font-medium text-white mb-2">🛡️ Para deixar seu PC acessível pela internet (port forwarding)</h3>
          <ol className="text-xs text-gray-400 space-y-1.5 list-decimal list-inside">
            <li>Acesse seu roteador: digite <code className="text-green-400">192.168.42.1</code> no navegador (geralmente)</li>
            <li>Procure por <strong className="text-gray-300">Encaminhamento de Portas</strong> / <em>Port Forwarding</em></li>
            <li>Encaminhe as portas <strong className="text-gray-300">TCP</strong> para o IP <code className="text-green-400">192.168.42.183</code>:</li>
            <li className="pl-4">• <code className="text-green-400">3000</code> → painel/daemon</li>
            <li className="pl-4">• <code className="text-green-400">25565</code> → servidor Minecraft Java</li>
            <li className="pl-4">• <code className="text-green-400">19132</code> → servidor Bedrock (se usar Geyser) <em>(UDP/TCP)</em></li>
            <li>Depois, no Netlify, defina a variável <code className="text-green-400">DAEMON_URL=http://SEU_IP_PUBLICO:3000</code></li>
          </ol>
          <p className="text-xs text-yellow-400/80 mt-3">
            ⚠️ Seu IP pode ser dinâmico (muda ao reiniciar o modem). Para IP fixo, o recomendado é usar o Cloudflare Tunnel (Rede & Tunnel no painel) — além de HTTPS e DDoS grátis.
          </p>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button onClick={testConnection} disabled={testing} className="btn-primary">
            {testing ? <Spinner size="sm" /> : '🧪 Testar conexão com o daemon'}
          </button>
          {testResult && (
            <span className={`text-sm ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}>
              {testResult.ok ? `✓ Conectado (${testResult.origin})` : `✗ ${testResult.error}`}
            </span>
          )}
        </div>
      </div>

      {/* Informações do sistema */}
      {loading && !config ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <>
          <div className="card p-6">
            <h2 className="font-semibold text-white mb-4">Informações do Sistema</h2>
            {system && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                <div className="bg-gray-950 rounded-xl p-3">
                  <div className="text-gray-500 text-xs">Hostname</div>
                  <div className="text-gray-200 font-medium">{system.hostname}</div>
                </div>
                <div className="bg-gray-950 rounded-xl p-3">
                  <div className="text-gray-500 text-xs">Plataforma</div>
                  <div className="text-gray-200 font-medium">{system.platform} {system.arch}</div>
                </div>
                <div className="bg-gray-950 rounded-xl p-3">
                  <div className="text-gray-500 text-xs">Node.js</div>
                  <div className="text-gray-200 font-medium">{system.nodeVersion}</div>
                </div>
                <div className="bg-gray-950 rounded-xl p-3">
                  <div className="text-gray-500 text-xs">Java</div>
                  <div className="text-gray-200 font-medium">{system.javaAvailable || 'não instalado'}</div>
                </div>
                <div className="bg-gray-950 rounded-xl p-3">
                  <div className="text-gray-500 text-xs">CPU</div>
                  <div className="text-gray-200 font-medium">{system.cpuCores} núcleos</div>
                </div>
                <div className="bg-gray-950 rounded-xl p-3">
                  <div className="text-gray-500 text-xs">RAM</div>
                  <div className="text-gray-200 font-medium">
                    {(system.totalMemory / (1024 ** 3)).toFixed(1)} GB total
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Configurações do daemon */}
          {config && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-white">Configurações do Daemon</h2>
                {saved && <span className="text-green-400 text-sm">✓ Salvo!</span>}
              </div>
              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="label">Porta do painel</label>
                  <input
                    type="number"
                    value={configForm?.port ?? config.port}
                    onChange={e => update('port', parseInt(e.target.value))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Caminho do Java (vazio = auto)</label>
                  <input
                    value={(configForm?.javaPath ?? config.javaPath) || ''}
                    onChange={e => update('javaPath', e.target.value)}
                    placeholder="ex: C:\Program Files\Java\jdk-21\bin\java.exe"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Caminho do cloudflared (vazio = auto)</label>
                  <input
                    value={configForm?.cloudflaredPath ?? config.cloudflaredPath}
                    onChange={e => update('cloudflaredPath', e.target.value)}
                    placeholder="cloudflared"
                    className="input"
                  />
                </div>
                <ToggleRow
                  label="Auto-restart de servidores travados"
                  checked={configForm?.autoRestart ?? config.autoRestart}
                  onChange={v => update('autoRestart', v)}
                />
                <ToggleRow
                  label="Modo debug (logs detalhados)"
                  checked={configForm?.debug ?? config.debug}
                  onChange={v => update('debug', v)}
                />
                <button onClick={saveConfig} disabled={saving} className="btn-primary">
                  {saving ? <Spinner size="sm" /> : 'Salvar configurações'}
                </button>
              </div>
            </div>
          )}

          {/* Como conectar */}
          <div className="card p-6">
            <h2 className="font-semibold text-white mb-4">🔗 Guia rápido de conexão (para jogadores)</h2>
            <div className="space-y-3 text-sm">
              <div className="bg-gray-950 rounded-xl p-4">
                <div className="text-gray-500 mb-1">Na rede local:</div>
                <code className="text-green-400 font-mono text-sm">localhost:25565</code>
                <button
                  onClick={() => copyToClipboard('localhost:25565')}
                  className="ml-3 text-xs text-gray-500 hover:text-white"
                >
                  copiar
                </button>
              </div>
              <div className="bg-gray-950 rounded-xl p-4">
                <div className="text-gray-500 mb-1">Pela internet (com Tunnel):</div>
                <p className="text-gray-300 text-xs">
                  Use seu domínio personalizado. Se não tiver domínio, use a URL <code className="text-green-400">trycloudflare.com</code> gerada pelo tunnel.
                </p>
              </div>
              <div className="bg-gray-950 rounded-xl p-4">
                <div className="text-gray-500 mb-1">No Minecraft:</div>
                <p className="text-gray-300 text-xs">
                  Multiplayer → Adicionar servidor → digite o endereço → Entrar.
                  <br />
                  Jogadores Bedrock (celular/console): use a mesma porta Bedrock (19132) na edição Bedrock.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ToggleRow({ label, checked, onChange }) {
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