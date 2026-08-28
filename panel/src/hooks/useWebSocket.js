import { useCallback, useEffect, useRef, useState } from 'react'
import { getWsUrl, getToken, setDaemonUrl, getBase } from '../lib/api'

// Hook do WebSocket para console em tempo real
export function useWebSocket(serverId = null) {
  const [connected, setConnected] = useState(false)
  const [logs, setLogs] = useState([])
  const [servers, setServers] = useState({})
  const [playerEvents, setPlayerEvents] = useState([])
  const [stats, setStats] = useState({})
  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)
  const logsRef = useRef([])
  const handlersRef = useRef({})

  const connect = useCallback(() => {
    if (!getToken()) return

    // Fechar conexão anterior
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    const url = getWsUrl()
    if (!url) return

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        if (reconnectTimer.current) {
          clearTimeout(reconnectTimer.current)
          reconnectTimer.current = null
        }
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (!msg || !msg.type) return

          switch (msg.type) {
            case 'init':
              setServers(msg.servers || {})
              if (handlersRef.current['init']) handlersRef.current['init'](msg)
              break

            case 'logs': {
              const serverLogs = (msg.logs || []).map(l => ({
                time: l.time || new Date().toISOString(),
                text: l.line || l.text || l,
                line: l.line || l.text || l,
                command: !!l.command,
                serverId: msg.id || msg.serverId
              }))
              logsRef.current = [...logsRef.current.filter(l => l.serverId !== (msg.id || msg.serverId)), ...serverLogs].slice(-400)
              setLogs(logsRef.current)
              if (handlersRef.current['logs']) handlersRef.current['logs'](msg)
              break
            }

            case 'log': {
              const logEntry = {
                time: msg.time || new Date().toISOString(),
                text: msg.line || msg.text,
                line: msg.line || msg.text,
                command: msg.command || false,
                serverId: msg.id || msg.serverId
              }
              logsRef.current = [...logsRef.current.slice(-400), logEntry]
              setLogs(logsRef.current)

              // Notificar handlers (suporta tanto 'log' quanto 'onLog')
              if (handlersRef.current['log']) {
                handlersRef.current['log'](logEntry)
              }
              if (handlersRef.current.onLog) {
                handlersRef.current.onLog(logEntry)
              }
              break
            }

            case 'status':
              setServers(prev => ({
                ...prev,
                [msg.id]: { ...prev[msg.id], status: msg.status }
              }))
              if (handlersRef.current['status']) handlersRef.current['status'](msg)
              if (handlersRef.current.onStatus) handlersRef.current.onStatus(msg)
              break

            case 'player':
              setPlayerEvents(prev => [{ ...msg, time: Date.now() }, ...prev].slice(0, 50))
              if (handlersRef.current['player']) handlersRef.current['player'](msg)
              if (handlersRef.current.onPlayer) handlersRef.current.onPlayer(msg)
              break

            case 'stats':
              setStats(prev => ({ ...prev, [msg.id]: { memory: msg.memory, cpu: msg.cpu } }))
              if (handlersRef.current['stats']) handlersRef.current['stats'](msg)
              if (handlersRef.current.onStats) handlersRef.current.onStats(msg)
              break

            case 'error':
              console.error('WS error:', msg.message)
              if (handlersRef.current['error']) handlersRef.current['error'](msg)
              break
          }
        } catch (e) {
          // Ignorar mensagens mal formatadas
        }
      }

      ws.onclose = () => {
        setConnected(false)
        wsRef.current = null
        // Reconectar após 5s
        reconnectTimer.current = setTimeout(() => connect(), 5000)
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch (e) {
      console.error('WS connection error:', e)
      // Tentar novamente
      reconnectTimer.current = setTimeout(() => connect(), 10000)
    }
  }, [])

  const sendCommand = useCallback((id, command) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'command', serverId: id, command }))
      return true
    }
    return false
  }, [])

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setConnected(false)
  }, [])

  // Registrar handlers
  const on = useCallback((event, handler) => {
    handlersRef.current[event] = handler
  }, [])

  const off = useCallback((event) => {
    delete handlersRef.current[event]
  }, [])

  // Conectar na montagem e quando a URL do daemon mudar
  useEffect(() => {
    const timer = setTimeout(() => connect(), 300)
    const onUrlChange = () => {
      connect()
    }
    window.addEventListener('daemon_url_changed', onUrlChange)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('daemon_url_changed', onUrlChange)
      disconnect()
    }
  }, [connect, disconnect])

  // Filtrar logs por servidor se serverId for fornecido
  const filteredLogs = serverId
    ? logs.filter(l => !serverId || l.serverId === serverId)
    : logs

  return {
    connected,
    logs: filteredLogs,
    allLogs: logs,
    servers,
    playerEvents,
    stats,
    sendCommand,
    on,
    off,
    connect,
    disconnect
  }
}