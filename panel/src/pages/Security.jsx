import { useState } from 'react'
import { api } from '../lib/api'
import { useApi } from '../hooks/useApi'
import Spinner from '../components/Spinner'
import Modal from '../components/Modal'

export default function Security() {
  const { data, loading, execute } = useApi(() => api.dashboard(), [])
  const { data: systemData, execute: reloadSystem } = useApi(() => api.system(), [])
  const [users, setUsers] = useState([])
  const [usersLoaded, setUsersLoaded] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', name: '', password: '', role: 'user' })
  const [userModal, setUserModal] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const loadUsers = async () => {
    try {
      const res = await api.users()
      setUsers(res.users || [])
      setUsersLoaded(true)
    } catch (e) {
      setMessage(e.message)
    }
  }

  const addUser = async () => {
    if (!newUser.username || !newUser.password) return
    setBusy(true)
    try {
      const res = await api.addUser(newUser)
      setMessage(`Usuário ${res.username || newUser.username} criado!`)
      setNewUser({ username: '', name: '', password: '', role: 'user' })
      setUserModal(false)
      loadUsers()
    } catch (e) {
      setMessage(e.message)
    } finally {
      setBusy(false)
    }
  }

  const removeUser = async (username) => {
    if (!confirm(`Remover usuário ${username}?`)) return
    try {
      await api.removeUser(username)
      loadUsers()
    } catch (e) {
      setMessage(e.message)
    }
  }

  const checkSecurity = () => {
    const issues = []
    const srv = Object.values(data?.servers || {})

    if (!srv.length) issues.push({ ok: true, text: 'Nenhum servidor criado ainda' })
    srv.forEach(s => {
      if (!s.onlineMode) issues.push({ ok: false, text: `Servidor "${s.name}" está com modo offline (online-mode=false) — sem verificação de conta.` })
      if (s.status === 'running' && data?.tunnel?.status !== 'running') {
        issues.push({ ok: false, text: `Servidor "${s.name}" está rodando sem Cloudflare Tunnel ativo (IP exposto).` })
      }
    })

    if (data?.tunnel?.status !== 'running') {
      issues.push({ ok: false, text: 'Tunnel Cloudflare não está ativo — sem proteção DDoS e sem TLS na borda.' })
    }

    if (!issues.length) {
      issues.push({ ok: true, text: 'Tudo certo! Nenhum problema de segurança detectado.' })
    }
    return issues
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Segurança</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Controle de acesso, usuários compartilhados e verificação de segurança
        </p>
      </div>

      {message && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">{message}</div>
      )}

      {/* Checkup de segurança */}
      <div className="card p-6">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Checkup de Segurança
        </h2>
        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <div className="space-y-2">
            {checkSecurity().map((issue, i) => (
              <div key={i} className={`flex items-start gap-2 p-3 rounded-lg text-sm ${issue.ok ? 'bg-green-500/5 text-green-400' : 'bg-yellow-500/5 text-yellow-400'}`}>
                <span>{issue.ok ? '✅' : '⚠️'}</span>
                <span>{issue.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usuários compartilhados */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-white">Usuários Compartilhados</h2>
            <p className="text-sm text-gray-500">Dê acesso ao painel para seus amigos (papéis: admin ou user)</p>
          </div>
          <button onClick={() => setUserModal(true)} className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Usuário
          </button>
        </div>

        {!usersLoaded ? (
          <button onClick={loadUsers} className="btn-secondary">Carregar usuários</button>
        ) : users.length === 0 ? (
          <p className="text-gray-500 text-sm">Nenhum usuário compartilhado. Apenas o admin (você) tem acesso.</p>
        ) : (
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between bg-gray-950 rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center text-xs font-bold">
                    {u.name?.charAt(0)?.toUpperCase() || u.username?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm text-gray-200 font-medium">{u.name || u.username}</div>
                    <div className="text-xs text-gray-500">@{u.username}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`badge text-[10px] ${u.role === 'admin' ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-300'}`}>
                    {u.role === 'admin' ? 'Admin' : 'Usuário'}
                  </span>
                  <button onClick={() => removeUser(u.username)} className="text-xs text-red-400 hover:text-red-300">
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Boas práticas */}
      <div className="card p-6">
        <h2 className="font-semibold text-white mb-4">📋 Boas Práticas de Segurança</h2>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-950 rounded-xl p-4">
            <h3 className="font-medium text-white mb-1">1. Senha forte</h3>
            <p className="text-xs text-gray-400">Use uma senha mestre com 12+ caracteres. Não compartilhe com quem não confia.</p>
          </div>
          <div className="bg-gray-950 rounded-xl p-4">
            <h3 className="font-medium text-white mb-1">2. Ative o Tunnel</h3>
            <p className="text-xs text-gray-400">Mantenha o Cloudflare Tunnel ativo para esconder seu IP real e filtrar DDoS.</p>
          </div>
          <div className="bg-gray-950 rounded-xl p-4">
            <h3 className="font-medium text-white mb-1">3. Whitelist</h3>
            <p className="text-xs text-gray-400">Use a whitelist para limitar quem pode entrar no servidor. Bloqueie bots e griefers.</p>
          </div>
          <div className="bg-gray-950 rounded-xl p-4">
            <h3 className="font-medium text-white mb-1">4. Backups</h3>
            <p className="text-xs text-gray-400">Ative backups automáticos. Um backup por dia evita perder o mundo inteiro.</p>
          </div>
          <div className="bg-gray-950 rounded-xl p-4">
            <h3 className="font-medium text-white mb-1">5. Não abra portas no roteador</h3>
            <p className="text-xs text-gray-400">Com o Tunnel ativo, não precisa de port forwarding. Deixe o firewall do roteador fechado.</p>
          </div>
          <div className="bg-gray-950 rounded-xl p-4">
            <h3 className="font-medium text-white mb-1">6. Modo online</h3>
            <p className="text-xs text-gray-400">Mantenha online-mode=true para que contas sejam verificadas pela Mojang. Modo offline facilita ataques.</p>
          </div>
        </div>
      </div>

      {/* Modal novo usuário */}
      <Modal open={userModal} onClose={() => setUserModal(false)} title="Novo Usuário">
        <div className="space-y-4">
          <div>
            <label className="label">Nome de usuário</label>
            <input
              value={newUser.username}
              onChange={e => setNewUser({ ...newUser, username: e.target.value })}
              placeholder="joao123"
              className="input"
            />
          </div>
          <div>
            <label className="label">Nome de exibição</label>
            <input
              value={newUser.name}
              onChange={e => setNewUser({ ...newUser, name: e.target.value })}
              placeholder="João"
              className="input"
            />
          </div>
          <div>
            <label className="label">Senha</label>
            <input
              type="password"
              value={newUser.password}
              onChange={e => setNewUser({ ...newUser, password: e.target.value })}
              placeholder="Mínimo 6 caracteres"
              className="input"
            />
          </div>
          <div>
            <label className="label">Papel</label>
            <select
              value={newUser.role}
              onChange={e => setNewUser({ ...newUser, role: e.target.value })}
              className="input"
            >
              <option value="user">Usuário (controle servidores)</option>
              <option value="admin">Admin (tudo + gerenciar usuários)</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setUserModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={addUser} disabled={busy || !newUser.username || !newUser.password} className="btn-primary">
              {busy ? <Spinner size="sm" /> : 'Criar usuário'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}