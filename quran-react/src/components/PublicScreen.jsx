import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { useTimer } from '../hooks/useTimer'

export default function PublicScreen() {
  const { user, competition, participants, rankings, socketRef, now, logout } = useApp()
  const [currentPage, setCurrentPage] = useState(competition?.currentPage || 1)
  const [flipping, setFlipping] = useState(false)
  const { display: timerDisplay, danger, warning } = useTimer(competition, now)

  const isParticipant = user.role === 'participant'
  const canNav = isParticipant && competition?.participantHasHand
  const currentP = participants.find(p => p.id === competition?.currentParticipantId)
  const reading = currentP?.reading || 'Warsh'
  const folder = reading === 'Hafs' ? '/quran/hafs' : '/quran/warsh'
  const imgUrl = (p) => `${folder}/page_${String(p).padStart(3,'0')}.png`

  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return
    const handler = (data) => setCurrentPage(data.page)
    socket.on('page_changed', handler)
    return () => socket.off('page_changed', handler)
  }, [socketRef.current])

  useEffect(() => {
    if (competition?.currentPage && competition.currentPage !== currentPage) {
      setCurrentPage(competition.currentPage)
    }
  }, [competition?.currentPage])

  const flipNext = () => {
    if (!canNav || flipping) return
    const n = Math.min(currentPage + 2, 603)
    setFlipping(true)
    setCurrentPage(n)
    socketRef.current?.emit('page_change', { page: n })
    setTimeout(() => setFlipping(false), 700)
  }

  const flipPrev = () => {
    if (!canNav || flipping) return
    const p = Math.max(currentPage - 2, 1)
    setFlipping(true)
    setCurrentPage(p)
    socketRef.current?.emit('page_change', { page: p })
    setTimeout(() => setFlipping(false), 700)
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {})
    else document.exitFullscreen().catch(() => {})
  }

  const roleLabel = isParticipant ? 'Participant' : 'Public'
  const roleColor = isParticipant ? '#3498db' : '#27ae60'

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', background:'#0a1208', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'6px 14px', borderBottom:'1px solid rgba(201,168,76,0.2)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(0,0,0,0.5)', flexShrink:0 }}>
        <h1 style={{ fontFamily:"'Amiri',serif", fontSize:'1rem', color:'var(--gold)' }}>
          المسابقة الوطنية لتلاوة القرآن الكريم
        </h1>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {isParticipant && (
            <span style={{
              padding:'3px 10px', borderRadius:20, fontSize:'0.72rem', fontWeight:700,
              background: competition?.participantHasHand ? 'rgba(46,204,113,0.2)' : 'rgba(192,57,43,0.2)',
              border: `1px solid ${competition?.participantHasHand ? 'rgba(46,204,113,0.5)' : 'rgba(192,57,43,0.5)'}`,
              color: competition?.participantHasHand ? '#2ECC71' : '#E74C3C'
            }}>
              {competition?.participantHasHand ? '🎤 Vous récitez' : '⏳ En attente'}
            </span>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:20, padding:'4px 10px' }}>
            <span style={{ fontSize:'0.78rem', color:'#ccc' }}>{user.name}</span>
            <span style={{ background:roleColor, color:'white', fontSize:'0.7rem', fontWeight:700, padding:'2px 8px', borderRadius:12 }}>{roleLabel}</span>
          </div>
          <button onClick={toggleFullscreen} style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', color:'#aaa', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:'0.9rem' }}>⛶</button>
          <button onClick={logout} style={{ background:'rgba(192,57,43,0.2)', border:'1px solid rgba(192,57,43,0.4)', color:'#e74c3c', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:'0.85rem' }}>🚪</button>
        </div>
      </div>

      {/* Mushaf */}
      <div style={{ flex:1, display:'flex', minHeight:0, position:'relative', overflow:'hidden', padding:6, alignItems:'center', justifyContent:'center' }}>
        <div id="pub-book" style={{ aspectRatio:'4/3', height:'100%', maxWidth:'100%', display:'flex', background:'#e8dcc8', borderRadius:3, boxShadow:'0 4px 30px rgba(0,0,0,0.9)', overflow:'hidden', position:'relative' }}>
          {/* Reliure */}
          <div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:8, transform:'translateX(-50%)', background:'linear-gradient(to right,rgba(0,0,0,0.25),rgba(100,70,10,0.7),rgba(201,168,76,0.4),rgba(100,70,10,0.7),rgba(0,0,0,0.25))', zIndex:3, pointerEvents:'none' }}></div>
          {/* Page gauche */}
          <div style={{ flex:1, overflow:'hidden', display:'flex', alignItems:'stretch' }}>
            <img src={imgUrl(currentPage)} alt="" style={{ width:'100%', height:'100%', objectFit:'fill', display:'block' }} />
          </div>
          {/* Page droite */}
          <div style={{ flex:1, overflow:'hidden', display:'flex', alignItems:'stretch' }}>
            {currentPage + 1 <= 604
              ? <img src={imgUrl(currentPage + 1)} alt="" style={{ width:'100%', height:'100%', objectFit:'fill', display:'block' }} />
              : null}
          </div>
        </div>

        {/* Résultats overlay */}
        {competition?.resultsVisible && (
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.88)', zIndex:10, display:'flex', alignItems:'center', justifyContent:'center', overflowY:'auto' }}>
            <div style={{ width:'100%', maxWidth:700, padding:20 }}>
              <h3 style={{ color:'var(--gold)', textAlign:'center', marginBottom:16, fontFamily:"'Amiri',serif", fontSize:'1.8rem' }}>🏆 Classement Final</h3>
              <PublicRankings rankings={rankings} />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ flexShrink:0, background:'rgba(0,0,0,0.7)', borderTop:'1px solid rgba(201,168,76,0.25)', padding:'6px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
        <div style={{ minWidth:160 }}>
          <div style={{ fontFamily:"'Amiri',serif", fontSize:'2rem', color:'var(--gold)', fontWeight:700, lineHeight:1.1 }}>{currentP?.name || '—'}</div>
          <div style={{ color:'var(--text-muted)', fontSize:'0.75rem', marginTop:1 }}>
            {currentP ? `N°${currentP.number} • ${currentP.reading}` : ''}
          </div>
        </div>

        {isParticipant ? (
          <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'center' }}>
            <button className={`flipbook-nav-btn${canNav ? '' : ' nav-disabled'}`} onClick={flipPrev} disabled={!canNav}>◀</button>
            <span style={{ color:'var(--gold)', fontSize:'0.78rem', fontWeight:600, whiteSpace:'nowrap' }}>Page {currentPage} / 604</span>
            <button className={`flipbook-nav-btn${canNav ? '' : ' nav-disabled'}`} onClick={flipNext} disabled={!canNav}>▶</button>
          </div>
        ) : <div />}

        <div className={`timer-display${danger?' danger':warning?' warning':''}`} style={{ fontSize:'2rem', fontWeight:900, minWidth:110, textAlign:'center' }}>
          {timerDisplay}
        </div>
      </div>
    </div>
  )
}

function PublicRankings({ rankings }) {
  const r = rankings?.selection || { male:[], female:[] }
  const renderList = (list, title) => {
    if (!list.length) return null
    return (
      <div style={{ marginBottom:16 }}>
        <div style={{ color:'var(--gold)', fontWeight:700, marginBottom:8 }}>{title}</div>
        {list.slice(0,5).map(r => (
          <div key={r.participant.id} style={{ display:'flex', alignItems:'center', gap:12, padding:8, background:'rgba(255,255,255,0.03)', borderRadius:8, marginBottom:4 }}>
            <div style={{ fontSize:'1.4rem', width:36, textAlign:'center' }}>{r.rank===1?'🥇':r.rank===2?'🥈':r.rank===3?'🥉':r.rank}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:600 }}>{r.participant.name}</div>
              <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{r.participant.reading}</div>
            </div>
            <div style={{ fontSize:'1.4rem', fontWeight:900, color:'var(--gold)' }}>{r.total}</div>
          </div>
        ))}
      </div>
    )
  }
  return <>{renderList(r.male, '👨 Garçons')}{renderList(r.female, '👩 Filles')}</>
}
