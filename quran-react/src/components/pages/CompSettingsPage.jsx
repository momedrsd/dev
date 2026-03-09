import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'

export default function CompSettingsPage() {
  const { competition, api, showToast, setCompetition } = useApp()
  const [form, setForm] = useState({
    title: competition?.title || '',
    edition: competition?.edition || '',
    date_debut: competition?.date_debut || '',
    date_fin: competition?.date_fin || '',
    lieu: competition?.lieu || ''
  })

  const save = async () => {
    if (!form.title.trim()) return showToast('Nom requis', 'error')
    try {
      await api('PUT', '/api/competition', { ...form, edition: parseInt(form.edition) || 1 })
      setCompetition(prev => ({ ...prev, ...form }))
      showToast('✅ Compétition mise à jour', 'success')
    } catch(e) { showToast(e.message, 'error') }
  }

  return (
    <div>
      <h2 style={{ color:'var(--gold)', marginBottom:20, fontFamily:"'Amiri',serif" }}>🏆 Paramètres de la Compétition</h2>
      <div className="card">
        <div className="card-header"><div className="card-title">📝 Informations générales</div></div>
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {[
            { label:'Nom de la compétition', id:'title', type:'text', style:{ direction:'rtl' } },
            { label:"Numéro d'édition", id:'edition', type:'number', style:{ width:120, direction:'ltr', textAlign:'center' } },
            { label:'Date de début', id:'date_debut', type:'date', style:{ direction:'ltr', textAlign:'left' } },
            { label:'Date de fin', id:'date_fin', type:'date', style:{ direction:'ltr', textAlign:'left' } },
            { label:'Lieu', id:'lieu', type:'text', style:{ direction:'rtl' } },
          ].map(f => (
            <div key={f.id} className="form-group" style={{ margin:0 }}>
              <label>{f.label}</label>
              <input className="form-control" type={f.type} style={f.style}
                value={form[f.id]} onChange={e => setForm(prev => ({ ...prev, [f.id]: e.target.value }))} />
            </div>
          ))}
        </div>
        <button className="btn btn-primary" style={{ width:'auto', marginTop:20 }} onClick={save}>💾 Enregistrer</button>
      </div>
    </div>
  )
}
