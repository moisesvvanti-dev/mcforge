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

          switch (msg.type) {
            case 'init':
              setServers(msg.servers || {})
              break

            case 'log':
              logsRef.current = [...logsRef.current.slice(-200), {
                time: msg.time || new Date().toISOString(),
                text: msg.line,
                command: msg.command || false,
                serverId: msg.id
              }]
              setLogs(logsRef.current)

              // Notificar handlers
              if (handlersRef.current.onLog) {
                handlersRef.current.onLog(msg)
              }
              break

            case 'status':
              setServers(prev => ({
                ...prev,
                [msg.id]: { ...prev[msg.id], status: msg.status }
              }))
              if (handlersRef.current.onStatus) {
                handlersRef.current.onStatus(msg)
              }
              break

            case 'player':
              setPlayerEvents(prev => [{ ...msg, time: Date.now() }, ...prev].slice(0, 50))
              if (handlersRef.current.onPlayer) {
                handlersRef.current.onPlayer(msg)
              }
              break

            case 'stats':
              setStats(prev => ({ ...prev, [msg.id]: { memory: msg.memory, cpu: msg.cpu } }))
              if (handlersRef.current.onStats) {
                handlersRef.current.onStats(msg)
              }
              break

            case 'error':
              console.error('WS error:', msg.message)
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

  // Conectar na montagem
  useEffect(() => {
    // Pequeno delay para garantir que o token está pronto
    const timer = setTimeout(() => connect(), 1000)
    return () => {
      clearTimeout(timer)
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