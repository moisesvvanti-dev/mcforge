import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

// Componente de console em tempo real
export default function Console({ serverId, ws, initialLogs = [] }) {
  const [input, setInput] = useState('')
  const [localLogs, setLocalLogs] = useState(initialLogs)
  const consoleRef = useRef(null)
  const inputRef = useRef(null)
  const historyRef = useRef([])
  const historyIdxRef = useRef(-1)

  // Scroll automático ao final
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight
    }
  }, [localLogs.length])

  // Receber logs via WebSocket (novos logs em tempo real)
  useEffect(() => {
    if (!ws) return
    const handler = (msg) => {
      const msgServerId = msg.serverId || msg.id
      if (!serverId || msgServerId === serverId) {
        const text = msg.line || msg.text || ''
        setLocalLogs(prev => [...prev.slice(-400), {
          time: msg.time || new Date().toISOString(),
          text,
          command: !!msg.command
        }])
      }
    }
    ws.on('log', handler)
    return () => ws.off('log')
  }, [serverId, ws])

  // Sincronizar logs iniciais da API
  useEffect(() => {
    if (initialLogs && initialLogs.length) {
      setLocalLogs(initialLogs.map(l => ({
        time: l.time || new Date().toISOString(),
        text: l.line || l.text || l,
        command: !!l.command
      })))
    }
  }, [initialLogs, serverId])

  // Fallback: busca logs por polling a cada 2 segundos se o WS estiver reconectando
  useEffect(() => {
    if (ws?.connected) return
    const poll = async () => {
      try {
        const res = await api.logs(serverId, 100)
        if (res && res.logs) {
          const fetched = res.logs.map(l => ({
            time: l.time,
            text: l.line || l.text || l,
            command: l.command || false
          }))
          setLocalLogs(prev => {
            if (fetched.length === prev.length && fetched[fetched.length - 1]?.text === prev[prev.length - 1]?.text) {
              return prev
            }
            return fetched.slice(-400)
          })
        }
      } catch { }
    }
    poll()
    const timer = setInterval(poll, 2500)
    return () => clearInterval(timer)
  }, [serverId, ws?.connected])

  const handleSend = async () => {
    if (!input.trim()) return
    const cmd = input.trim()
    historyRef.current.push(cmd)
    historyIdxRef.current = -1
    setInput('')

    // Adiciona o comando visualmente de forma instantânea
    setLocalLogs(prev => [...prev.slice(-400), {
      time: new Date().toISOString(),
      text: cmd,
      command: true
    }])

    const sent = ws?.sendCommand ? ws.sendCommand(serverId, cmd) : false
    if (!sent) {
      try {
        await api.command(serverId, cmd)
      } catch (err) {
        setLocalLogs(prev => [...prev.slice(-400), {
          time: new Date().toISOString(),
          text: `[Erro ao enviar comando]: ${err.message}`,
          command: false
        }])
      }
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const hist = historyRef.current
      if (hist.length) {
        historyIdxRef.current = Math.min(historyIdxRef.current + 1, hist.length - 1)
        setInput(hist[hist.length - 1 - historyIdxRef.current])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIdxRef.current > 0) {
        historyIdxRef.current--
        setInput(historyRef.current[historyRef.current.length - 1 - historyIdxRef.current])
      } else {
        historyIdxRef.current = -1
        setInput('')
      }
    }
  }

  // Cor por linha
  const lineColor = (line) => {
    if (line.command) return 'text-green-400'
    const t = line.text
    if (/ERROR|Exception|Fatal|Error/i.test(t)) return 'text-red-400'
    if (/WARN|Warning/i.test(t)) return 'text-yellow-400'
    if (/INFO|Done|Started/i.test(t)) return 'text-green-400'
    if (/joined the game/i.test(t)) return 'text-cyan-400'
    if (/left the game/i.test(t)) return 'text-orange-400'
    return 'text-gray-300'
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 rounded-xl border border-gray-800 overflow-hidden">
      {/* Barra do console */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="text-xs font-semibold text-gray-300">Console</span>
        </div>
        <span className="text-xs text-gray-500">
          {ws.connected ? 'Tempo real' : 'Atualizando (sem WebSocket)'}
        </span>
      </div>

      {/* Logs */}
      <div ref={consoleRef} className="flex-1 overflow-y-auto console-scroll p-3 font-mono text-xs leading-relaxed">
        {localLogs.length === 0 && (
          <div className="text-gray-600 italic">
            {ws.connected ? 'Aguardando logs... Inicie o servidor.' : 'Conecte ao daemon para ver os logs em tempo real.'}
          </div>
        )}
        {localLogs.map((line, i) => (
          <div key={i} className={`whitespace-pre-wrap break-all ${lineColor(line)}`}>
            {line.command ? (
              <span>
                <span className="text-gray-500">{line.time ? line.time.slice(11, 19) + ' ' : ''}</span>
                <span className="text-green-400 font-bold">› </span>
                {line.text}
              </span>
            ) : (
              <span>
                {line.time && <span className="text-gray-600">{line.time.slice(11, 19)} </span>}
                {line.text}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-900 border-t border-gray-800">
        <span className="text-green-400 font-mono text-sm">›</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite um comando (ex: say Olá, gamemode creative @a, list)..."
          className="flex-1 bg-transparent outline-none text-sm font-mono text-gray-200 placeholder-gray-600"
          autoFocus
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || !ws.connected}
          className="px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 rounded-md text-xs font-semibold text-white transition-colors"
        >
          Enviar
        </button>
      </div>
    </div>
  )
}