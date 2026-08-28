import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

// Hook genérico para chamadas à API com loading/erro
export function useApi(fn, deps = [], { auto = true, initial = null } = {}) {
  const [data, setData] = useState(initial)
  const [loading, setLoading] = useState(auto)
  const [error, setError] = useState(null)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const execute = useCallback(async (...args) => {
    setError(null)
    try {
      const result = await fnRef.current(...args)
      setData(result)
      return result
    } catch (e) {
      setError(e.message || 'Erro na requisição')
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (auto) {
      execute().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error, execute, setData }
}

// Hook para dados do dashboard
export function useDashboard() {
  return useApi(() => api.dashboard(), [])
}

// Hook para listar servidores
export function useServers() {
  const [servers, setServers] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const res = await api.servers()
      const apiServers = res.servers || {}
      const localServers = JSON.parse(localStorage.getItem('mcforge_local_servers') || '{}')
      setServers({ ...localServers, ...apiServers })
      setError(null)
    } catch (e) {
      const localServers = JSON.parse(localStorage.getItem('mcforge_local_servers') || '{}')
      if (Object.keys(localServers).length > 0) {
        setServers(localServers)
        setError(null)
      } else {
        setError(null)
        setServers({})
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { servers, loading, error, refresh }
}