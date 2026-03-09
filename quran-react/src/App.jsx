import React from 'react'
import { AppProvider, useApp } from './context/AppContext'
import LoginPage from './components/LoginPage'
import Dashboard from './components/Dashboard'
import PublicScreen from './components/PublicScreen'
import ToastContainer from './components/ToastContainer'
import LoadingScreen from './components/LoadingScreen'

function AppInner() {
  const { token, user } = useApp()

  if (!token || !user) return <LoginPage />
  if (user.role === 'public' || user.role === 'participant') return <PublicScreen />
  return <Dashboard />
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
      <ToastContainer />
    </AppProvider>
  )
}
