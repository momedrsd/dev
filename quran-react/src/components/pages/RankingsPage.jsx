// RankingsPage.jsx
import React from 'react'
import { useApp } from '../../context/AppContext'

export function RankingTable({ list }) {
  if (!list?.length) return <p style={{ color:'var(--text-muted)', textAlign:'center', padding:20 }}>Aucune note encore</p>
  return (
    <div className="table-wrap">
      <table><thead><tr><th>Rang</th><th>Participant</th><th>Lecture</th><th>Juges</th><th>Score</th></tr></thead>
        <tbody>{list.map(r => (
          <tr key={r.participant.id}>
            <td>{r.rank===1?'🥇':r.rank===2?'🥈':r.rank===3?'🥉':r.rank}</td>
            <td>{r.participant.name}</td>
            <td><span className={'badge badge-'+(r.participant.reading==='Warsh'?'warsh':'hafs')}>{r.participant.reading}</span></td>
            <td>{r.judgeCount}/4</td>
            <td><strong style={{ color:'var(--gold)' }}>{r.total}</strong>/20</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

export default function RankingsPage() {
  const { competition, rankings, user, socketRef } = useApp()
  const r = rankings?.selection || { male:[], female:[] }
  const canToggle = ['admin','president'].includes(user.role)

  return (
    <div>
      <h2 style={{ color:'var(--gold)', marginBottom:20, fontFamily:"'Amiri',serif" }}>🏆 Classement — Sélection</h2>
      {canToggle && (
        <div className="card" style={{ marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <span>Affichage au public:</span>
            <button className={`btn ${competition?.resultsVisible ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => socketRef.current?.emit('toggle_results', { visible: !competition?.resultsVisible })}>
              {competition?.resultsVisible ? '🔒 Masquer' : '📢 Afficher au public'}
            </button>
          </div>
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <div className="card"><div className="card-header"><div className="card-title">👨 Garçons</div></div><RankingTable list={r.male} /></div>
        <div className="card"><div className="card-header"><div className="card-title">👩 Filles</div></div><RankingTable list={r.female} /></div>
      </div>
    </div>
  )
}
