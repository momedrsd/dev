import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { RankingTable } from './RankingsPage'
import ScoringPanel from '../ScoringPanel'

// ── FINALE ────────────────────────────────────────────────────────────────────
export default function FinalePage() {
  const { participants, rankings, user, api, showToast } = useApp()
  const r = rankings?.final || { male:[], female:[] }
  const finalists = participants.filter(p => p.phase === 'final')

  const promote = async () => {
    if (!confirm('Qualifier le Top 5 Garçons + Top 5 Filles pour la finale ?')) return
    try {
      const res = await api('POST', '/api/promote-finalists')
      showToast('✅ ' + res.promoted + ' finalistes qualifiés', 'success')
    } catch(e) { showToast(e.message, 'error') }
  }

  return (
    <div>
      <h2 style={{ color:'var(--gold)', marginBottom:20, fontFamily:"'Amiri',serif" }}>🌟 Finale</h2>
      <div className="card" style={{ marginBottom:20 }}>
        <div className="card-header"><div className="card-title">🚀 Gestion de la Finale</div></div>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
          <button className="btn btn-primary" onClick={promote}>🏆 Qualifier Top 5 Garçons + Top 5 Filles → Finale</button>
          <span style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>{finalists.length} finaliste(s)</span>
        </div>
      </div>
      {user.role === 'judge' && (
        <div className="card" style={{ marginBottom:20 }}>
          <div className="card-title" style={{ marginBottom:8 }}>✏️ Notation Finale</div>
          <ScoringPanel isFinal={true} />
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <div className="card"><div className="card-header"><div className="card-title">👨 Final Garçons</div></div><RankingTable list={r.male} /></div>
        <div className="card"><div className="card-header"><div className="card-title">👩 Final Filles</div></div><RankingTable list={r.female} /></div>
      </div>
    </div>
  )
}
