import React, { useEffect, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'

export default function Mushaf({ page, height = 500, showNav = false, onPageChange, readOnly = false }) {
  const { competition, participants, socketRef } = useApp()
  const currentP = participants.find(p => p.id === competition?.currentParticipantId)
  const reading = currentP?.reading || 'Warsh'
  const folder = reading === 'Hafs' ? '/quran/hafs' : '/quran/warsh'
  const imgUrl = (p) => `${folder}/page_${String(p).padStart(3,'0')}.png`

  const flipNext = () => {
    if (readOnly) return
    const n = Math.min((page || 1) + 2, 604)
    onPageChange?.(n)
    socketRef.current?.emit('page_change', { page: n })
  }

  const flipPrev = () => {
    if (readOnly) return
    const p = Math.max((page || 1) - 2, 1)
    onPageChange?.(p)
    socketRef.current?.emit('page_change', { page: p })
  }

  const goTo = (val) => {
    const p = Math.min(Math.max(parseInt(val) || 1, 1), 604)
    onPageChange?.(p)
    socketRef.current?.emit('page_change', { page: p })
  }

  return (
    <div>
      {showNav && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
          <div style={{ color:'var(--gold)', fontSize:'0.9rem', fontWeight:600 }}>
            📖 Coran — <span>{page || 1}/604</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <button className="flipbook-nav-btn" style={{ width:36, height:36 }} onClick={flipPrev}>◀️</button>
            <input type="number" min="1" max="604" defaultValue={page || 1}
              key={page}
              style={{ width:60, padding:'4px', background:'rgba(255,255,255,0.05)', border:'var(--border-gold)', borderRadius:6, color:'var(--text-light)', textAlign:'center', direction:'ltr' }}
              onChange={e => goTo(e.target.value)} />
            <button className="flipbook-nav-btn" style={{ width:36, height:36 }} onClick={flipNext}>▶️</button>
          </div>
        </div>
      )}

      <div style={{ display:'flex', gap:0, width:'100%', background:'#e8dcc8', borderRadius:6, overflow:'hidden', minHeight:height, boxShadow:'0 4px 20px rgba(0,0,0,0.5)' }}>
        {/* Page gauche */}
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', borderRight:'3px solid #8B6914' }}>
          {page && page <= 604 ? (
            <img src={imgUrl(page)} alt={`Page ${page}`} style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} />
          ) : (
            <div style={{ color:'#c9a84c', opacity:0.3, fontFamily:"'Amiri',serif", fontSize:'1.5rem' }}>نهاية</div>
          )}
        </div>
        {/* Page droite */}
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
          {page && page + 1 <= 604 ? (
            <img src={imgUrl(page + 1)} alt={`Page ${page + 1}`} style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} />
          ) : (
            <div style={{ color:'#c9a84c', opacity:0.3, fontFamily:"'Amiri',serif", fontSize:'1.5rem' }}>نهاية</div>
          )}
        </div>
      </div>
    </div>
  )
}
