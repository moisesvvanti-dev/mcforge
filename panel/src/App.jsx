import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Layout from './components/Layout'
import { isAuthenticated, autoDiscoverDaemonUrl } from './lib/api'
import { useWebSocket } from './hooks/useWebSocket'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Servers from './pages/Servers'
import NewServer from './pages/NewServer'
import ServerDetail from './pages/ServerDetail'
import Network from './pages/Network'
import Security from './pages/Security'
import Settings from './pages/Settings'

function RequireAuth({ children }) {
  const location = useLocation()
  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return children
}

function AppShell() {
  const ws = useWebSocket()

  useEffect(() => {
    autoDiscoverDaemonUrl(true).then((url) => {
      if (url && ws) ws.connect()
    }).catch(() => {})

    const interval = setInterval(() => {
      autoDiscoverDaemonUrl(true).catch(() => {})
    }, 12000)

    return () => clearInterval(interval)
  }, [ws])

  return (
    <Layout ws={ws}>
      <Routes>
        <Route path="/" element={<Dashboard ws={ws} />} />
        <Route path="/servers" element={<Servers ws={ws} />} />
        <Route path="/servers/new" element={<NewServer />} />
        <Route path="/servers/:id" element={<ServerDetail ws={ws} />} />
        <Route path="/network" element={<Network ws={ws} />} />
        <Route path="/security" element={<Security ws={ws} />} />
        <Route path="/settings" element={<Settings ws={ws} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        />
      </Routes>
    </HashRouter>
  )
}