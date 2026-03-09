import React, { useState } from 'react'
import { useApp } from '../context/AppContext'

export default function LoginPage() {
  const { login, publicComp, competition } = useApp()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const comp = publicComp || competition || {}
  const titre = comp.title || 'المسابقة الوطنية لتلاوة القرآن الكريم'
  const edition = comp.edition || 9
  const lieu = comp.lieu || ''

  const mois = ['يناير','فبراير','مارس','أبريل','ماي','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
  const fmtDate = (d) => { if (!d) return ''; const dt = new Date(d); return dt.getDate() + ' ' + mois[dt.getMonth()] + ' ' + dt.getFullYear() }
  const dateStr = comp.date_debut ? fmtDate(comp.date_debut) + (comp.date_fin ? ' — ' + fmtDate(comp.date_fin) : '') : ''

  const doLogin = async () => {
    if (!username || !password) return
    setLoading(true); setError('')
    try { await login(username, password) }
    catch(e) { setError(e.message); setLoading(false) }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <span className="emblem">☪</span>
          <h1 style={{ fontSize: 'clamp(1rem,3vw,1.4rem)' }}>{titre}</h1>
          {lieu && <p style={{ fontSize: '0.85rem' }}>📍 {lieu}</p>}
          {dateStr && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{dateStr}</p>}
          <span className="edition-badge">ÉDITION {edition}</span>
        </div>
        <div className="ornament">﷽</div>
        <div>
          <div className="form-group">
            <label>Nom d'utilisateur</label>
            <input type="text" className="form-control" placeholder="Identifiant"
              value={username} onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doLogin()} />
          </div>
          <div className="form-group">
            <label>Mot de passe</label>
            <input type="password" className="form-control" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doLogin()} />
          </div>
          {error && <div style={{ color:'#E74C3C', fontSize:'0.85rem', marginBottom:'12px', textAlign:'center' }}>{error}</div>}
          <button className="btn btn-primary" onClick={doLogin} disabled={loading}>
            {loading ? '⏳ Connexion...' : '🔐 Se connecter'}
          </button>
        </div>
        <p style={{ textAlign:'center', color:'var(--text-muted)', fontSize:'0.75rem', marginTop:'20px' }}>
          Warsh • Hafs — رواية ورش وحفص
        </p>
      </div>
    </div>
  )
}
