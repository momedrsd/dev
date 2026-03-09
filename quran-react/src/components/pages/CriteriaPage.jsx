import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'

// ── CRITÈRES ──────────────────────────────────────────────────────────────────
export function CriteriaPage() {
  const { criteria, setCriteria, api, showToast } = useApp()
  const total = criteria.reduce((s,c) => s + (c.max||0), 0)

  const update = (i, field, val) => {
    setCriteria(prev => prev.map((c,j) => j===i ? {...c,[field]:field==='max'?parseInt(val)||0:val} : c))
  }
  const add = () => setCriteria(prev => [...prev, { key:'crit_'+Date.now(), label:'Nouveau critère', max:0 }])
  const remove = (i) => setCriteria(prev => prev.filter((_,j) => j!==i))

  const save = async () => {
    if (total !== 20) return showToast('❌ Le total doit être 20 (actuellement ' + total + ')', 'error')
    try { await api('PUT', '/api/criteria', { criteria }); showToast('✅ Grille enregistrée', 'success') }
    catch(e) { showToast(e.message, 'error') }
  }

  return (
    <div>
      <h2 style={{ color:'var(--gold)', marginBottom:20, fontFamily:"'Amiri',serif" }}>📋 Grille de Notation</h2>
      <div className="card">
        <div className="card-header">
          <div className="card-title">⚙️ Critères et Barèmes</div>
          <div className={'badge '+(total===20?'badge-warsh':'badge-hafs')}>Total: {total}/20</div>
        </div>
        <p style={{ color:'var(--text-muted)', fontSize:'0.85rem', marginBottom:16 }}>⚠️ Le total des barèmes doit être exactement 20 points.</p>
        {criteria.map((c,i) => (
          <div key={c.key} className="score-criterion" style={{ marginBottom:10 }}>
            <div className="grid-2" style={{ gap:10, alignItems:'center' }}>
              <div>
                <label style={{ fontSize:'0.78rem', marginBottom:4, display:'block' }}>Libellé</label>
                <input className="form-control" value={c.label} onChange={e => update(i,'label',e.target.value)} />
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:'0.78rem', marginBottom:4, display:'block' }}>Barème (max)</label>
                  <input type="number" className="form-control" value={c.max} min="1" max="20" onChange={e => update(i,'max',e.target.value)} />
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => remove(i)}>🗑️</button>
              </div>
            </div>
          </div>
        ))}
        <div style={{ display:'flex', gap:12, marginTop:16 }}>
          <button className="btn btn-green" onClick={add}>➕ Ajouter</button>
          <button className="btn btn-primary" onClick={save}>💾 Enregistrer</button>
        </div>
      </div>
    </div>
  )
}
export default CriteriaPage

// ── TIMER SETTINGS ────────────────────────────────────────────────────────────
export function TimerSettingsPage() {
  const { competition, setCompetition, api, showToast } = useApp()
  const presets = competition?.timerPresets || [60,120,180,300,600,900]
  const currentDefault = competition?.timerDuration || 300
  const fmt = (s) => String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0')

  const setDefault = async (seconds) => {
    try {
      await api('PUT', '/api/competition', { timerDuration: seconds })
      setCompetition(prev => ({ ...prev, timerDuration: seconds }))
      showToast('✅ Durée par défaut : ' + fmt(seconds), 'success')
    } catch(e) { showToast(e.message, 'error') }
  }

  const savePresets = async () => {
    try { await api('PUT', '/api/timer-presets', { presets }); showToast('✅ Préréglages enregistrés','success') }
    catch(e) { showToast(e.message,'error') }
  }

  return (
    <div>
      <h2 style={{ color:'var(--gold)', marginBottom:20, fontFamily:"'Amiri',serif" }}>⏱️ Paramètres du Chronomètre</h2>
      <div className="card">
        <div className="card-header">
          <div className="card-title">⚡ Durées pré-configurées</div>
          <div style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>
            Durée par défaut : <strong style={{ color:'var(--gold)' }}>{fmt(currentDefault)}</strong>
          </div>
        </div>
        {presets.map((p,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <span style={{ color:'var(--text-muted)', fontSize:'0.85rem', minWidth:45 }}>{fmt(p)}</span>
            <button className={`btn btn-ghost btn-sm${p===currentDefault?' btn-active':''}`}
              style={{ color:'#2ECC71', borderColor:'rgba(46,204,113,0.4)', ...(p===currentDefault?{background:'rgba(46,204,113,0.15)'}:{}) }}
              onClick={() => setDefault(p)}>
              {p===currentDefault ? '✅ Par défaut' : '⭐ Par défaut'}
            </button>
          </div>
        ))}
        <button className="btn btn-primary btn-sm" style={{ marginTop:12 }} onClick={savePresets}>💾 Enregistrer</button>
      </div>
    </div>
  )
}

// ── EMERGENCY ─────────────────────────────────────────────────────────────────
export function EmergencyPage() {
  const { api, socketRef, showToast } = useApp()
  const [msg, setMsg] = useState('')

  return (
    <div>
      <h2 style={{ color:'var(--red)', marginBottom:20, fontFamily:"'Amiri',serif" }}>🚨 Panneau d'Urgence</h2>
      <div className="emergency-panel">
        <div className="emergency-title">⚠️ Utilisez avec précaution</div>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <button className="btn btn-danger" onClick={async () => { if(confirm('Réinitialiser ?')) await api('POST','/api/emergency/reset') }}>🔄 Réinitialiser</button>
          <button className="btn btn-danger" onClick={async () => { if(confirm('Arrêter ?')) await api('POST','/api/emergency/stop') }}>⏹️ Arrêter</button>
          <button className="btn btn-danger" onClick={() => location.reload()}>🔁 Recharger</button>
        </div>
      </div>
      <div className="card" style={{ marginTop:20 }}>
        <div className="card-header"><div className="card-title">📢 Diffusion</div></div>
        <textarea className="form-control" rows="3" placeholder="Message à diffuser..." style={{ marginBottom:12 }}
          value={msg} onChange={e => setMsg(e.target.value)}></textarea>
        <button className="btn btn-ghost" onClick={() => { if(msg.trim()) { socketRef.current?.emit('broadcast',{message:msg}); showToast('✅ Message diffusé','success') } }}>📢 Diffuser à tous</button>
      </div>
    </div>
  )
}
