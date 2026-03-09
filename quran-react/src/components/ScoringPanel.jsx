import React, { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'

export default function ScoringPanel({ isFinal = false }) {
  const { user, competition, participants, scores, finalScores, criteria, scoreUnlocked, api, showToast, socketRef } = useApp()
  const [values, setValues] = useState({})
  const [confirming, setConfirming] = useState(false)

  const currentP = participants.find(p => p.id === competition?.currentParticipantId)
  const scoreArr = isFinal ? finalScores : scores
  const myScore = scoreArr.find(s => s.participantId === currentP?.id && s.judgeId === user.userId)
  const isPresident = ['president','admin'].includes(user.role)
  const locked = !!myScore && !scoreUnlocked && !isPresident

  useEffect(() => {
    if (myScore) setValues(myScore.criteria || {})
    else setValues({})
  }, [currentP?.id, myScore])

  if (!currentP) return (
    <p style={{ color:'var(--text-muted)', fontSize:'0.85rem', textAlign:'center', padding:12 }}>
      En attente d'un participant...
    </p>
  )

  const total = criteria.reduce((s,c) => s + Math.min(parseInt(values[c.key])||0, c.max), 0)

  const step = (key, delta, max) => {
    setValues(prev => ({ ...prev, [key]: Math.min(Math.max((parseInt(prev[key])||0) + delta, 0), max) }))
  }

  const confirm = async () => {
    const criteriaData = {}
    let t = 0
    criteria.forEach(c => { const v = Math.min(parseInt(values[c.key])||0, c.max); criteriaData[c.key] = v; t += v })
    try {
      await api('POST', '/api/scores', { participantId: currentP.id, criteria: criteriaData, isFinal: !!isFinal })
      showToast('✅ Note enregistrée et verrouillée', 'success')
    } catch(e) { showToast('❌ ' + e.message, 'error') }
  }

  if (locked) return (
    <div style={{ textAlign:'center', padding:12, background:'rgba(192,57,43,0.1)', borderRadius:8, border:'1px solid rgba(192,57,43,0.3)' }}>
      <div style={{ fontSize:'1.2rem', marginBottom:8 }}>🔒</div>
      <div style={{ fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:10 }}>Note verrouillée</div>
      <button className="btn btn-ghost btn-sm" onClick={() => socketRef.current?.emit('request_unlock')}>
        📤 Demander modification au Président
      </button>
    </div>
  )

  return (
    <div>
      <div style={{ fontSize:'0.82rem', color:'var(--text-muted)', marginBottom:10 }}>
        Participant: <strong style={{ color:'var(--gold)' }}>{currentP.name}</strong>
        {myScore && <span className="badge badge-warsh" style={{ marginRight:4, fontSize:'0.7rem' }}>Noté: {myScore.total}/20</span>}
        {isFinal && <span className="badge badge-hafs" style={{ fontSize:'0.7rem' }}>🌟 FINALE</span>}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        {criteria.map(c => (
          <div key={c.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6, padding:'3px 0' }}>
            <label style={{ fontSize:'0.75rem', color:'var(--gold-light)', flex:1, lineHeight:1.2 }}>{c.label}</label>
            <div className="score-stepper" style={{ height:28 }}>
              <button className="stepper-btn" style={{ width:24 }} onClick={() => step(c.key, -1, c.max)}>−</button>
              <input type="number" className="score-input" min="0" max={c.max}
                value={values[c.key] || 0}
                onChange={e => setValues(prev => ({ ...prev, [c.key]: Math.min(Math.max(parseInt(e.target.value)||0, 0), c.max) }))}
                style={{ width:32, background:'transparent', border:'none', color:'white', textAlign:'center', direction:'ltr', fontWeight:700, fontSize:'0.9rem' }} />
              <button className="stepper-btn" style={{ width:24 }} onClick={() => step(c.key, +1, c.max)}>+</button>
            </div>
            <span style={{ fontSize:'0.7rem', color:'var(--text-muted)', width:26, textAlign:'right' }}>/{c.max}</span>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', margin:'8px 0 6px', padding:'6px 10px', background:'rgba(201,168,76,0.1)', borderRadius:6 }}>
        <span style={{ color:'var(--text-muted)', fontSize:'0.78rem' }}>Total</span>
        <span>
          <span style={{ color:'var(--gold)', fontWeight:900, fontSize:'1.4rem' }}>{total}</span>
          <span style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>/20</span>
        </span>
      </div>

      <button className="btn btn-primary btn-sm" style={{ width:'100%', padding:8 }} onClick={confirm}>
        {myScore ? '🔄 Modifier' : '✅ Valider'} la note
      </button>
    </div>
  )
}
