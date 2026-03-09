// ParticipantsPage.jsx
import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'

export default function ParticipantsPage() {
  const { participants, competition, api, showToast, socketRef } = useApp()
  const [filter, setFilter] = useState('')
  const [form, setForm] = useState({ name:'', gender:'male', reading:'Warsh', category:'selection' })

  const filtered = filter ? participants.filter(p => p.name.toLowerCase().includes(filter.toLowerCase())) : participants

  const addParticipant = async () => {
    if (!form.name.trim()) return showToast('Nom requis', 'error')
    try {
      await api('POST', '/api/participants', form)
      setForm({ name:'', gender:'male', reading:'Warsh', category:'selection' })
      showToast('✅ Participant ajouté', 'success')
    } catch(e) { showToast(e.message, 'error') }
  }

  const deleteParticipant = async (id, name) => {
    if (!confirm(`Supprimer ${name} ?`)) return
    try { await api('DELETE', '/api/participants/' + id); showToast('Supprimé', 'info') }
    catch(e) { showToast(e.message, 'error') }
  }

  const selectParticipant = (id) => {
    socketRef.current?.emit('set_current_participant', { participantId: id })
    showToast('Participant sélectionné', 'info')
  }

  return (
    <div>
      <h2 style={{ color:'var(--gold)', marginBottom:20, fontFamily:"'Amiri',serif" }}>👥 Gestion des Participants</h2>
      <div className="card">
        <div className="card-header"><div className="card-title">➕ Ajouter un participant</div></div>
        <div className="grid-2" style={{ gap:12 }}>
          <div className="form-group" style={{ margin:0 }}><label>Nom complet</label>
            <input className="form-control" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="Nom du participant" /></div>
          <div className="form-group" style={{ margin:0 }}><label>Genre</label>
            <select className="form-control" value={form.gender} onChange={e => setForm(f=>({...f,gender:e.target.value}))}>
              <option value="male">👨 Masculin</option><option value="female">👩 Féminin</option>
            </select></div>
          <div className="form-group" style={{ margin:0 }}><label>Lecture</label>
            <select className="form-control" value={form.reading} onChange={e => setForm(f=>({...f,reading:e.target.value}))}>
              <option value="Warsh">Warsh — ورش</option><option value="Hafs">Hafs — حفص</option>
            </select></div>
          <div className="form-group" style={{ margin:0 }}><label>Catégorie</label>
            <select className="form-control" value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}>
              <option value="selection">Sélection</option><option value="final">Finale</option>
            </select></div>
        </div>
        <button className="btn btn-primary" style={{ width:'auto', marginTop:16 }} onClick={addParticipant}>➕ Ajouter</button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">📋 Liste ({participants.length})</div>
          <input type="text" className="form-control" placeholder="🔍 Rechercher..." style={{ width:200 }}
            onChange={e => setFilter(e.target.value)} />
        </div>
        <div className="table-wrap">
          <table><thead><tr><th>N°</th><th>Nom</th><th>Genre</th><th>Lecture</th><th>Phase</th><th>Actions</th></tr></thead>
            <tbody>{filtered.map(p => (
              <tr key={p.id}>
                <td>{p.number}</td>
                <td>{p.id===competition?.currentParticipantId && <span className="status-dot status-current"></span>} {p.name}</td>
                <td><span className={'badge badge-'+p.gender}>{p.gender==='male'?'👨 M':'👩 F'}</span></td>
                <td><span className={'badge badge-'+(p.reading==='Warsh'?'warsh':'hafs')}>{p.reading}</span></td>
                <td>{p.phase==='final'?<span className="badge badge-warsh">🌟 Finale</span>:<span className="badge">🔵 Sélection</span>}</td>
                <td><div style={{ display:'flex', gap:6 }}>
                  {p.id!==competition?.currentParticipantId
                    ? <button className="btn btn-green btn-sm" onClick={() => selectParticipant(p.id)}>▶️ Sélectionner</button>
                    : <button className="btn btn-danger btn-sm" onClick={() => selectParticipant(null)}>⏸️ Arrêter</button>}
                  <button className="btn btn-danger btn-sm" onClick={() => deleteParticipant(p.id, p.name)}>🗑️</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
