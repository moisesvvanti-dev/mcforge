import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import Spinner from '../components/Spinner'
import Modal from '../components/Modal'
import { isValidPort } from '../lib/utils'

const serverTypes = [
  { id: 'paper', name: 'Paper', desc: 'Mais rápido e popular para plugins', color: 'bg-yellow-600' },
  { id: 'purpur', name: 'Purpur', desc: 'Paper com recursos extras', color: 'bg-purple-600' },
  { id: 'vanilla', name: 'Vanilla', desc: 'Minecraft original da Mojang', color: 'bg-gray-600' },
  { id: 'forge', name: 'Forge', desc: 'Mods clássicos', color: 'bg-orange-600' },
  { id: 'fabric', name: 'Fabric', desc: 'Mods modernos e leves', color: 'bg-cyan-600' },
  { id: 'neoforge', name: 'NeoForge', desc: 'Sucessor do Forge (1.20.1+)', color: 'bg-blue-600' },
  { id: 'bds', name: 'Bedrock (BDS)', desc: 'Servidor oficial da Bedrock', color: 'bg-green-700' }
]

export default function NewServer() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    type: 'paper',
    version: 'latest',
    port: 25565,
    minRam: '1G',
    maxRam: '2G',
    autoStart: false,
    autoRestart: true,
    motd: 'MCForge Server',
    gamemode: 'survival',
    difficulty: 'normal',
    pvp: true,
    onlineMode: true,
    maxPlayers: 20,
    geyser: false,
    // Para Geyser (Bedrock + Java)
    bedrockPort: 19132
  })

  const update = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const [showCloudModal, setShowCloudModal] = useState(false)
  const [createdServerId, setCreatedServerId] = useState(null)

  const handleSubmit = async () => {
    setError('')
    if (!form.name.trim()) {
      setError('Dê um nome ao servidor')
      return
    }
    if (!isValidPort(form.port)) {
      setError('Porta inválida (1-65535)')
      return
    }
    setLoading(true)
    try {
      try {
        const res = await api.createServer(form)
        if (res && res.server) {
          navigate(`/servers/${res.server.id}`)
          return
        }
      } catch (apiErr) {
        // Salva a configuração localmente para iniciar no GitHub Actions
        const localId = 'srv_' + Date.now()
        const newServer = {
          ...form,
          id: localId,
          status: 'stopped',
          createdAt: new Date().toISOString(),
          playerCount: 0,
          uptime: 'Offline'
        }
        const existing = JSON.parse(localStorage.getItem('mcforge_local_servers') || '{}')
        existing[localId] = newServer
        localStorage.setItem('mcforge_local_servers', JSON.stringify(existing))
        setCreatedServerId(localId)
        setShowCloudModal(true)
        return
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Criar Novo Servidor</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Configure um servidor Minecraft gratuito em poucos passos
        </p>
      </div>

      {/* Progresso */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step >= i ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-500'
            }`}>
              {i}
            </div>
            <div className={`text-xs font-medium ${step >= i ? 'text-green-400' : 'text-gray-500'}`}>
              {i === 1 ? 'Tipo & Versão' : i === 2 ? 'Recursos' : 'Configurações'}
            </div>
            {i < 3 && <div className={`flex-1 h-0.5 rounded ${step > i ? 'bg-green-600' : 'bg-gray-800'}`} />}
          </div>
        ))}
      </div>

      {/* Passo 1: Tipo e versão */}
      {step === 1 && (
        <div className="card p-6 space-y-5">
          <div>
            <label className="label">Nome do servidor</label>
            <input
              value={form.name}
              onChange={e => update('name', e.target.value)}
              placeholder="Meu Servidor Survival"
              className="input"
            />
          </div>

          <div>
            <label className="label">Tipo de servidor</label>
            <div className="grid sm:grid-cols-2 gap-3">
              {serverTypes.map(t => (
                <button
                  key={t.id}
                  onClick={() => update('type', t.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    form.type === t.id
                      ? 'border-green-500 bg-green-600/10'
                      : 'border-gray-800 bg-gray-900 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${t.color}`} />
                    <span className="font-semibold text-white">{t.name}</span>
                  </div>
                  <p className="text-xs text-gray-500">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Versão (deixe 'latest' para a mais recente)</label>
              <input
                value={form.version}
                onChange={e => update('version', e.target.value)}
                placeholder="latest"
                className="input"
              />
            </div>
            <div>
              <label className="label">Porta</label>
              <input
                type="number"
                value={form.port}
                onChange={e => update('port', e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={() => setStep(2)} className="btn-primary">Continuar →</button>
          </div>
        </div>
      )}

      {/* Passo 2: Recursos */}
      {step === 2 && (
        <div className="card p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">RAM mínima</label>
              <select value={form.minRam} onChange={e => update('minRam', e.target.value)} className="input">
                {['512M', '1G', '2G', '4G', '6G', '8G'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label">RAM máxima</label>
              <select value={form.maxRam} onChange={e => update('maxRam', e.target.value)} className="input">
                {['1G', '2G', '3G', '4G', '6G', '8G', '12G', '16G'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Mensagem de entrada (MOTD)</label>
            <input
              value={form.motd}
              onChange={e => update('motd', e.target.value)}
              className="input"
            />
          </div>

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

          <div>
            <label className="label">Máximo de jogadores</label>
            <input
              type="number"
              value={form.maxPlayers}
              onChange={e => update('maxPlayers', e.target.value)}
              className="input"
            />
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <Toggle label="PvP ativado" checked={form.pvp} onChange={v => update('pvp', v)} />
            <Toggle label="Modo online (verificação de contas Mojang)" checked={form.onlineMode} onChange={v => update('onlineMode', v)} />
            <Toggle label="Reiniciar automaticamente se travar" checked={form.autoRestart} onChange={v => update('autoRestart', v)} />
            <Toggle label="Iniciar automaticamente ao ligar o daemon" checked={form.autoStart} onChange={v => update('autoStart', v)} />
            <Toggle label="Suporte Bedrock (Geyser - celular/console) 🎮" checked={form.geyser} onChange={v => update('geyser', v)} />
          </div>

          {form.geyser && (
            <div className="p-4 bg-blue-600/10 border border-blue-600/30 rounded-xl text-sm text-blue-300">
              O plugin Geyser + Floodgate será instalado automaticamente. Jogadores de celular, console e
              Windows 10/11 poderão entrar junto com jogadores Java. Porta Bedrock: <strong>{form.bedrockPort}</strong>
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="btn-secondary">← Voltar</button>
            <button onClick={() => setStep(3)} className="btn-primary">Continuar →</button>
          </div>
        </div>
      )}

      {/* Passo 3: Confirmação */}
      {step === 3 && (
        <div className="card p-6 space-y-5">
          <h3 className="font-semibold text-white">Resumo da configuração</h3>
          <div className="bg-gray-950 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Nome</span><span className="text-gray-200">{form.name || '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Tipo</span><span className="text-gray-200">{serverTypes.find(t => t.id === form.type)?.name}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Versão</span><span className="text-gray-200">{form.version}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Porta</span><span className="text-gray-200">{form.port}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">RAM</span><span className="text-gray-200">{form.minRam} - {form.maxRam}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Modo</span><span className="text-gray-200">{form.gamemode}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Jogadores</span><span className="text-gray-200">{form.maxPlayers}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Bedrock</span><span className="text-gray-200">{form.geyser ? 'Ativado' : 'Desativado'}</span></div>
          </div>

          <div className="p-4 bg-gray-950 rounded-xl text-xs text-gray-500">
            O servidor será baixado na primeira inicialização (pode levar alguns minutos).
            O EULA da Mojang será aceito automaticamente.
          </div>

          {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="btn-secondary">← Voltar</button>
            <button onClick={handleSubmit} disabled={loading} className="btn-primary">
              {loading ? <><Spinner size="sm" /> Criando...</> : '🚀 Criar e Iniciar Servidor'}
            </button>
          </div>
        </div>
      )}

      {/* Modal de Inicialização na Nuvem (GitHub Actions) */}
      <Modal open={showCloudModal} onClose={() => navigate('/servers')} title="🚀 Servidor Criado com Sucesso!">
        <div className="space-y-4">
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm flex items-start gap-3">
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="font-bold text-white">Configuração salva no painel!</p>
              <p className="text-xs text-gray-300 mt-1">
                O seu servidor <strong>{form.name}</strong> ({serverTypes.find(t => t.id === form.type)?.name} {form.version} • {form.maxRam} RAM) está pronto.
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            Agora, para ligar a máquina na nuvem e colocar seu servidor Minecraft online, clique no botão abaixo:
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
            <button onClick={() => navigate('/servers')} className="btn-secondary w-full sm:w-auto text-xs">
              Ver no Painel
            </button>
            <a
              href="https://github.com/moisesvvanti-dev/mcforge/actions"
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                setTimeout(() => navigate('/servers'), 1000)
              }}
              className="btn-primary w-full sm:w-auto text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <span>▶️ Ligar Servidor no GitHub Actions</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </Modal>
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