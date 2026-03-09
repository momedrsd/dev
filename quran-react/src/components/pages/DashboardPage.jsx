import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { useTimer } from '../../hooks/useTimer'
import Mushaf from '../Mushaf'
import ScoringPanel from '../ScoringPanel'

export default function DashboardPage({ onNavigate }) {
  const { user, competition, participants, scores, socketRef, api, now, showToast, scoreUnlocked, judgesLockStatus, setJudgesLockStatus } = useApp()
  const [currentPage, setCurrentPage] = useState(competition?.currentPage || 1)
  const [filter, setFilter] = useState('')
  const { display: timerDisplay, danger, warning } = useTimer(competition, now)
  const role = user.role
  const isJudge = role === 'judge'
  const currentP = participants.find(p => p.id === competition?.currentParticipantId)
  const leftColRef = useRef(null)
  const rightColRef = useRef(null)

  // Sync page from competition updates
  useEffect(() => {
    if (competition?.currentPage && competition.currentPage !== currentPage) {
      setCurrentPage(competition.currentPage)
    }
  }, [competition?.currentPage])

  // Sync right column height (president/admin only)
  useEffect(() => {
    if (isJudge) return
    const syncH = () => {
      if (leftColRef.current && rightColRef.current) {
        const h = leftColRef.current.offsetHeight
        if (h > 0) rightColRef.current.style.maxHeight = (h - 19) + 'px'
      }
    }
    syncH()
    setTimeout(syncH, 300)
    if (leftColRef.current) {
      const obs = new ResizeObserver(syncH)
      obs.observe(leftColRef.current)
      return () => obs.disconnect()
    }
  }, [isJudge])

  // Listen to page_changed socket
  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return
    const handler = (data) => setCurrentPage(data.page)
    socket.on('page_changed', handler)
    return () => socket.off('page_changed', handler)
  }, [socketRef.current])

  const giveHand = (hasHand) => {
    socketRef.current?.emit('give_hand', { hasHand })
  }

  const timerStart = () => socketRef.current?.emit('timer_start', { duration: competition?.timerDuration || 300 })
  const timerStop  = () => socketRef.current?.emit('timer_stop')
  const timerReset = () => socketRef.current?.emit('timer_reset', { duration: competition?.timerDuration || 300 })

  const selectParticipant = (id) => {
    socketRef.current?.emit('set_current_participant', { participantId: id })
    showToast('Participant sélectionné', 'info')
  }

  const toggleJudgeLock = (judgeId, judgeName, currentlyUnlocked) => {
    socketRef.current?.emit('unlock_score', { judgeId, judgeName, unlock: !currentlyUnlocked })
    setJudgesLockStatus(prev => ({ ...prev, [judgeId]: { name: judgeName, unlocked: !currentlyUnlocked } }))
  }

  const filteredParticipants = filter
    ? participants.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()))
    : participants

  // ── JUGE LAYOUT ───────────────────────────────────────────────────────────
  if (isJudge) return (
    <div style={{ display:'grid', gridTemplateColumns:'340px 1fr', gap:16, overflowY:'auto' }}>
      {/* Gauche */}
      <div>
        <div className="card" style={{ padding:12 }}>
          <div style={{ fontFamily:"'Amiri',serif", fontSize:'1.4rem', color:'var(--gold)', textAlign:'center' }}>
            {currentP ? currentP.name : '— En attente —'}
          </div>
          <div style={{ color:'var(--text-muted)', fontSize:'0.78rem', textAlign:'center', marginTop:2 }}>
            {currentP ? `N°${currentP.number} • ${currentP.reading} • ${currentP.gender==='male'?'👨 Masculin':'👩 Féminin'}` : ''}
          </div>
          <div style={{ textAlign:'center', marginTop:8, paddingTop:8, borderTop:'1px solid rgba(201,168,76,0.2)' }}>
            <div className={`timer-display${danger?' danger':warning?' warning':''}`} style={{ fontSize:'2.4rem', lineHeight:1 }}>{timerDisplay}</div>
            {competition?.participantHasHand && (
              <div className="live-badge" style={{ margin:'4px auto', width:'fit-content' }}>
                <span className="dot"></span>RÉCITATION
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ padding:12 }}>
          <div className="card-title" style={{ marginBottom:4 }}>✏️ Notation</div>
          <ScoringPanel />
        </div>

        <div className="card" style={{ padding:12 }}>
          <div className="card-title" style={{ marginBottom:8 }}>📋 Dernières notes</div>
          <RecentScores />
        </div>
      </div>

      {/* Droite : Mushaf */}
      <div>
        <div className="card" style={{ padding:12 }}>
          <Mushaf page={currentPage} height={500} showNav={false} readOnly={true} onPageChange={setCurrentPage} />
        </div>
      </div>
    </div>
  )

  // ── PRÉSIDENT / ADMIN LAYOUT ──────────────────────────────────────────────
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 420px', gap:20 }} id="president-grid">
      {/* Gauche */}
      <div ref={leftColRef}>
        <div className="card" style={{ marginBottom:16, padding:16 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div>
              <div style={{ fontFamily:"'Amiri',serif", fontSize:'1.6rem', color:'var(--gold)' }}>
                {currentP ? currentP.name : '— En attente —'}
              </div>
              <div style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>
                {currentP ? `N°${currentP.number} • ${currentP.reading} • ${currentP.gender==='male'?'👨 Masculin':'👩 Féminin'}` : ''}
              </div>
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>
              {currentP ? (
                <button className={`btn ${competition?.participantHasHand ? 'btn-danger' : 'btn-primary'}`}
                  onClick={() => giveHand(!competition?.participantHasHand)}>
                  {competition?.participantHasHand ? '✋ Reprendre la main' : '🤝 Donner la main + Démarrer'}
                </button>
              ) : (
                <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('participants')}>
                  👥 Sélectionner participant
                </button>
              )}
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:16, padding:12, background:'rgba(201,168,76,0.06)', borderRadius:8, border:'1px solid rgba(201,168,76,0.15)' }}>
            <div className={`timer-display${danger?' danger':warning?' warning':''}`} style={{ fontSize:'2.2rem', flexShrink:0 }}>{timerDisplay}</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <button className="btn btn-green btn-sm" onClick={timerStart}>▶️ Démarrer</button>
              <button className="btn btn-danger btn-sm" onClick={timerStop}>⏹️ Stop</button>
              <button className="btn btn-ghost btn-sm" onClick={timerReset}>🔄 Reset</button>
            </div>
            {competition?.participantHasHand && (
              <div className="live-badge"><span className="dot"></span>RÉCITATION</div>
            )}
          </div>
        </div>

        <div className="card" style={{ padding:12 }}>
          <Mushaf page={currentPage} height={350} showNav={true} onPageChange={setCurrentPage} />
        </div>
      </div>

      {/* Droite */}
      <div ref={rightColRef} style={{ display:'flex', flexDirection:'column', gap:16, overflowY:'auto', paddingRight:4 }}>
        <div className="card" style={{ padding:16 }}>
          <div className="card-title" style={{ marginBottom:8 }}>
            👥 Participants
            <input type="text" placeholder="🔍 Rechercher..." className="form-control"
              style={{ display:'inline-block', width:140, marginRight:8, padding:'4px 8px', fontSize:'0.8rem' }}
              onInput={e => setFilter(e.target.value)} />
          </div>
          <div style={{ maxHeight:220, overflowY:'auto' }}>
            {!filteredParticipants.length
              ? <p style={{ color:'var(--text-muted)', fontSize:'0.82rem', textAlign:'center' }}>Aucun participant</p>
              : filteredParticipants.map(p => (
                <div key={p.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <span style={{ fontSize:'0.88rem', ...(p.id===competition?.currentParticipantId ? { color:'var(--gold)', fontWeight:700 } : {}) }}>{p.name}</span>
                    <span className={`badge badge-${p.reading==='Warsh'?'warsh':'hafs'}`} style={{ marginRight:4, fontSize:'0.7rem' }}>{p.reading}</span>
                    {p.gender==='female' ? <span style={{ fontSize:'0.7rem', color:'#e74c9a' }}>👩</span> : <span style={{ fontSize:'0.7rem', color:'#3498db' }}>👨</span>}
                  </div>
                  {p.id !== competition?.currentParticipantId
                    ? <button className="btn btn-green btn-sm" style={{ fontSize:'0.75rem', padding:'4px 10px' }} onClick={() => selectParticipant(p.id)}>▶ Sélectionner</button>
                    : <span style={{ color:'var(--gold)', fontSize:'0.75rem' }}>✅ En cours</span>}
                </div>
              ))
            }
          </div>
        </div>

        <div className="card" style={{ padding:16 }}>
          <div className="card-title" style={{ marginBottom:12 }}>🔓 Demandes de modification</div>
          <div style={{ marginTop:12 }}>
            <div className="card-title" style={{ fontSize:'0.9rem', marginBottom:8 }}>Statut des verrous</div>
            {!Object.keys(judgesLockStatus).length
              ? <p style={{ color:'var(--text-muted)', fontSize:'0.82rem' }}>En attente des juges...</p>
              : Object.entries(judgesLockStatus).map(([id, info]) => (
                <div key={id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 0' }}>
                  <span style={{ fontSize:'0.85rem' }}>{info.name}</span>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <span style={{ fontSize:'0.75rem', color: info.unlocked ? '#2ECC71' : '#E74C3C' }}>
                      {info.unlocked ? '🔓 Autorisé' : '🔒 Verrouillé'}
                    </span>
                    <button className={`btn btn-sm ${info.unlocked ? 'btn-danger' : 'btn-green'}`}
                      style={{ fontSize:'0.72rem', padding:'3px 8px' }}
                      onClick={() => toggleJudgeLock(id, info.name, info.unlocked)}>
                      {info.unlocked ? 'Verrouiller' : 'Autoriser'}
                    </button>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        <div className="card" style={{ padding:12 }}>
          <div className="card-title" style={{ marginBottom:4 }}>✏️ Notation (Président)</div>
          <ScoringPanel />
        </div>

        <div className="card" style={{ padding:16 }}>
          <div className="card-title" style={{ marginBottom:12 }}>📋 Dernières notes</div>
          <RecentScores />
        </div>
      </div>
    </div>
  )
}

function RecentScores() {
  const { user, scores, participants } = useApp()
  const isJudge = user?.role === 'judge'
  let list = isJudge ? scores.filter(s => s.judgeId === user.userId) : [...scores]
  list = list.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0,5)
  if (!list.length) return <p style={{ color:'var(--text-muted)', fontSize:'0.82rem', textAlign:'center' }}>Aucune note</p>
  return list.map(s => {
    const p = participants.find(x => x.id === s.participantId)
    return (
      <div key={s.id || s.participantId + s.judgeId} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.05)', fontSize:'0.82rem' }}>
        <span>{p?.name || '?'}</span>
        {!isJudge && <span style={{ color:'var(--text-muted)' }}>{s.judgeName}</span>}
        <strong style={{ color:'var(--gold)' }}>{s.total}/20</strong>
      </div>
    )
  })
}
