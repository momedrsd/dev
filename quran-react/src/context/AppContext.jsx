import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('auth_token'))
  const [user, setUser] = useState(null)
  const [competition, setCompetition] = useState(null)
  const [participants, setParticipants] = useState([])
  const [scores, setScores] = useState([])
  const [finalScores, setFinalScores] = useState([])
  const [criteria, setCriteria] = useState([])
  const [rankings, setRankings] = useState({ selection: { male:[], female:[], all:[] }, final: { male:[], female:[], all:[] } })
  const [scoreUnlocked, setScoreUnlocked] = useState(false)
  const [judgesLockStatus, setJudgesLockStatus] = useState({})
  const [publicComp, setPublicComp] = useState(null)
  const [toasts, setToasts] = useState([])
  const socketRef = useRef(null)
  const serverTimeOffsetRef = useRef(0)

  // ── API ───────────────────────────────────────────────────────────────────
  const api = useCallback(async (method, url, body) => {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token || '' },
      body: body ? JSON.stringify(body) : undefined
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Erreur serveur')
    return data
  }, [token])

  const now = useCallback(() => Date.now() + serverTimeOffsetRef.current, [])

  // ── Time sync ─────────────────────────────────────────────────────────────
  const syncServerTime = useCallback(() => {
    if (!socketRef.current) return
    const t0 = Date.now()
    socketRef.current.emit('time_sync', t0)
    socketRef.current.once('time_sync_response', ({ clientTime, serverTime }) => {
      const t1 = Date.now()
      const latency = (t1 - clientTime) / 2
      serverTimeOffsetRef.current = serverTime - t1 + latency
    })
  }, [])

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const [comp, parts, sc, crit, finSc] = await Promise.all([
      api('GET', '/api/competition'),
      api('GET', '/api/participants'),
      api('GET', '/api/scores'),
      api('GET', '/api/criteria'),
      api('GET', '/api/final-scores').catch(() => [])
    ])
    setCompetition(comp)
    setParticipants(parts)
    setScores(sc)
    setCriteria(crit)
    setFinalScores(finSc)
    try {
      const r = await api('GET', '/api/rankings')
      setRankings(r)
    } catch {}
  }, [api])

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg, type = 'info') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3800)
  }, [])

  // ── Socket ────────────────────────────────────────────────────────────────
  const connectSocket = useCallback((tok) => {
    if (socketRef.current) socketRef.current.disconnect()
    const socket = io({ transports: ['websocket'], upgrade: false })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('authenticate', tok)
      syncServerTime()
    })
    socket.on('competition_updated', setCompetition)
    socket.on('participants_updated', setParticipants)
    socket.on('scores_updated', setScores)
    socket.on('final_scores_updated', setFinalScores)
    socket.on('rankings_updated', setRankings)
    socket.on('criteria_updated', setCriteria)
    socket.on('score_lock_status', (data) => {
      setScoreUnlocked(!!data.unlocked)
      if (data.unlocked) showToast('✅ Le Président vous autorise à modifier votre note', 'success')
      else showToast('🔒 Note verrouillée', 'info')
    })
    socket.on('score_unlock_confirmed', (data) => {
      setJudgesLockStatus(prev => ({ ...prev, [data.judgeId]: { name: data.judgeName, unlocked: data.unlocked } }))
      showToast((data.unlocked ? '🔓 ' : '🔒 ') + data.judgeName + ': ' + (data.unlocked ? 'peut modifier' : 'verrouillé'), 'info')
    })
    socket.on('results_revealed', () => showToast('🏆 Résultats dévoilés au public!', 'success'))
    socket.on('emergency', (data) => showToast('🚨 ' + data.message, 'error'))
    socket.on('broadcast_message', (data) => showToast('📢 ' + data.from + ': ' + data.message, 'info'))
    socket.on('auth_error', () => logout())
  }, [syncServerTime, showToast])

  // ── Auth ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (username, password) => {
    const data = await api('POST', '/api/login', { username, password })
    localStorage.setItem('auth_token', data.token)
    setToken(data.token)
    setUser(data)
    await loadData()
    connectSocket(data.token)
    return data
  }, [api, loadData, connectSocket])

  const logout = useCallback(async () => {
    try { await api('POST', '/api/logout') } catch {}
    localStorage.removeItem('auth_token')
    setToken(null)
    setUser(null)
    if (socketRef.current) socketRef.current.disconnect()
  }, [api])

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/competition-public').then(r => r.ok ? r.json() : null).then(d => { if(d) setPublicComp(d) }).catch(() => {})
    if (!token) return
    api('GET', '/api/me').then(u => {
      setUser(u)
      return loadData()
    }).then(() => {
      connectSocket(token)
    }).catch(() => {
      localStorage.removeItem('auth_token')
      setToken(null)
    })
  }, []) // eslint-disable-line

  const value = {
    token, user, competition, participants, scores, finalScores, criteria,
    rankings, scoreUnlocked, judgesLockStatus, publicComp, toasts,
    socket: socketRef.current,
    socketRef,
    api, now, showToast, login, logout, loadData,
    setCompetition, setParticipants, setScores, setCriteria, setFinalScores,
    setRankings, setScoreUnlocked, setJudgesLockStatus,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => useContext(AppContext)
