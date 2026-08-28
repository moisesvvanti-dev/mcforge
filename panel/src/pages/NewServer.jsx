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
    version: '1.20.1',
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
        navigate(`/servers/${localId}`)
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
              <label className="label">Versão do Minecraft</label>
              <select
                value={form.version}
                onChange={e => update('version', e.target.value)}
                className="input font-mono font-medium"
              >
                <optgroup label="Minecraft 1.21 (Tricky Trials)">
                  <option value="1.21.4">1.21.4</option>
                  <option value="1.21.3">1.21.3</option>
                  <option value="1.21.2">1.21.2</option>
                  <option value="1.21.1">1.21.1</option>
                  <option value="1.21">1.21</option>
                </optgroup>
                <optgroup label="Minecraft 1.20 (Trails & Tales)">
                  <option value="1.20.6">1.20.6</option>
                  <option value="1.20.5">1.20.5</option>
                  <option value="1.20.4">1.20.4</option>
                  <option value="1.20.3">1.20.3</option>
                  <option value="1.20.2">1.20.2</option>
                  <option value="1.20.1">1.20.1</option>
                  <option value="1.20">1.20</option>
                </optgroup>
                <optgroup label="Minecraft 1.19 (The Wild)">
                  <option value="1.19.4">1.19.4</option>
                  <option value="1.19.3">1.19.3</option>
                  <option value="1.19.2">1.19.2</option>
                  <option value="1.19.1">1.19.1</option>
                  <option value="1.19">1.19</option>
                </optgroup>
                <optgroup label="Minecraft 1.18 (Caves & Cliffs II)">
                  <option value="1.18.2">1.18.2</option>
                  <option value="1.18.1">1.18.1</option>
                  <option value="1.18">1.18</option>
                </optgroup>
                <optgroup label="Minecraft 1.17 (Caves & Cliffs I)">
                  <option value="1.17.1">1.17.1</option>
                  <option value="1.17">1.17</option>
                </optgroup>
                <optgroup label="Minecraft 1.16 (Nether Update)">
                  <option value="1.16.5">1.16.5</option>
                  <option value="1.16.4">1.16.4</option>
                  <option value="1.16.3">1.16.3</option>
                  <option value="1.16.2">1.16.2</option>
                  <option value="1.16.1">1.16.1</option>
                  <option value="1.16">1.16</option>
                </optgroup>
                <optgroup label="Minecraft 1.15 (Buzzy Bees)">
                  <option value="1.15.2">1.15.2</option>
                  <option value="1.15.1">1.15.1</option>
                  <option value="1.15">1.15</option>
                </optgroup>
                <optgroup label="Minecraft 1.14 (Village & Pillage)">
                  <option value="1.14.4">1.14.4</option>
                  <option value="1.14.3">1.14.3</option>
                  <option value="1.14.2">1.14.2</option>
                  <option value="1.14.1">1.14.1</option>
                  <option value="1.14">1.14</option>
                </optgroup>
                <optgroup label="Minecraft 1.13 (Update Aquatic)">
                  <option value="1.13.2">1.13.2</option>
                  <option value="1.13.1">1.13.1</option>
                  <option value="1.13">1.13</option>
                </optgroup>
                <optgroup label="Minecraft 1.12 (World of Color)">
                  <option value="1.12.2">1.12.2</option>
                  <option value="1.12.1">1.12.1</option>
                  <option value="1.12">1.12</option>
                </optgroup>
                <optgroup label="Minecraft 1.11 (Exploration)">
                  <option value="1.11.2">1.11.2</option>
                  <option value="1.11.1">1.11.1</option>
                  <option value="1.11">1.11</option>
                </optgroup>
                <optgroup label="Minecraft 1.10 (Frostburn)">
                  <option value="1.10.2">1.10.2</option>
                  <option value="1.10.1">1.10.1</option>
                  <option value="1.10">1.10</option>
                </optgroup>
                <optgroup label="Minecraft 1.9 (Combat Update)">
                  <option value="1.9.4">1.9.4</option>
                  <option value="1.9.3">1.9.3</option>
                  <option value="1.9.2">1.9.2</option>
                  <option value="1.9.1">1.9.1</option>
                  <option value="1.9">1.9</option>
                </optgroup>
                <optgroup label="Minecraft 1.8 (Bountiful Update)">
                  <option value="1.8.9">1.8.9</option>
                  <option value="1.8.8">1.8.8</option>
                  <option value="1.8.7">1.8.7</option>
                  <option value="1.8.6">1.8.6</option>
                  <option value="1.8.5">1.8.5</option>
                  <option value="1.8.4">1.8.4</option>
                  <option value="1.8.3">1.8.3</option>
                  <option value="1.8.2">1.8.2</option>
                  <option value="1.8.1">1.8.1</option>
                  <option value="1.8">1.8</option>
                </optgroup>
                <optgroup label="Minecraft 1.7 (The Update That Changed the World)">
                  <option value="1.7.10">1.7.10</option>
                  <option value="1.7.9">1.7.9</option>
                  <option value="1.7.5">1.7.5</option>
                  <option value="1.7.2">1.7.2</option>
                </optgroup>
                <optgroup label="Minecraft 1.6 (Horse Update)">
                  <option value="1.6.4">1.6.4</option>
                  <option value="1.6.2">1.6.2</option>
                </optgroup>
                <optgroup label="Minecraft 1.5 (Redstone Update)">
                  <option value="1.5.2">1.5.2</option>
                  <option value="1.5.1">1.5.1</option>
                </optgroup>
                <optgroup label="Minecraft 1.4 (Pretty Scary)">
                  <option value="1.4.7">1.4.7</option>
                  <option value="1.4.6">1.4.6</option>
                  <option value="1.4.5">1.4.5</option>
                  <option value="1.4.2">1.4.2</option>
                </optgroup>
                <optgroup label="Minecraft 1.3 - 1.0 (Clássicos)">
                  <option value="1.3.2">1.3.2</option>
                  <option value="1.2.5">1.2.5</option>
                  <option value="1.1">1.1</option>
                  <option value="1.0.0">1.0.0</option>
                </optgroup>
              </select>
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