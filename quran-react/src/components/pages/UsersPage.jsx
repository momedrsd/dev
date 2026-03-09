import React, { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'

function getRoleLabel(role) {
  return { admin:'Admin', president:'Président', judge:'Juge', participant:'Participant', public:'Public' }[role] || role
}

export default function UsersPage() {
  const { api, showToast } = useApp()
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({ name:'', username:'', password:'', role:'judge' })

  const load = async () => {
    try { setUsers(await api('GET', '/api/users')) } catch {}
  }

  useEffect(() => { load() }, [])

  const createUser = async () => {
    if (!form.name || !form.username || !form.password) return showToast('Tous les champs sont requis', 'error')
    try {
      await api('POST', '/api/users', form)
      setForm({ name:'', username:'', password:'', role:'judge' })
      showToast('✅ Compte créé', 'success')
      load()
    } catch(e) { showToast(e.message, 'error') }
  }

  const toggleActive = async (id, active) => {
    try { await api('PUT', '/api/users/'+id, { active: !active }); load() }
    catch(e) { showToast(e.message, 'error') }
  }

  const deleteUser = async (id, name) => {
    if (!confirm(`Supprimer ${name} ?`)) return
    try { await api('DELETE', '/api/users/'+id); load() }
    catch(e) { showToast(e.message, 'error') }
  }

  return (
    <div>
      <h2 style={{ color:'var(--gold)', marginBottom:20, fontFamily:"'Amiri',serif" }}>⚙️ Gestion des Comptes</h2>
      <div className="card">
        <div className="card-header"><div className="card-title">➕ Nouveau compte</div></div>
        <div className="grid-2" style={{ gap:12 }}>
          {[
            { label:'Nom complet', id:'name', type:'text', placeholder:'Nom affiché' },
            { label:'Identifiant', id:'username', type:'text', placeholder:'username', style:{ direction:'ltr', textAlign:'left' } },
            { label:'Mot de passe', id:'password', type:'password', placeholder:'••••••••' },
          ].map(f => (
            <div key={f.id} className="form-group" style={{ margin:0 }}>
              <label>{f.label}</label>
              <input className="form-control" type={f.type} placeholder={f.placeholder} style={f.style}
                value={form[f.id]} onChange={e => setForm(p=>({...p,[f.id]:e.target.value}))} />
            </div>
          ))}
          <div className="form-group" style={{ margin:0 }}><label>Rôle</label>
            <select className="form-control" value={form.role} onChange={e => setForm(p=>({...p,role:e.target.value}))}>
              <option value="judge">Juge</option><option value="president">Président</option>
              <option value="participant">Participant</option><option value="public">Public</option><option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <button className="btn btn-primary" style={{ width:'auto', marginTop:16 }} onClick={createUser}>➕ Créer</button>
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">👥 Comptes</div></div>
        <div className="table-wrap">
          <table><thead><tr><th>Nom</th><th>Identifiant</th><th>Rôle</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>{users.map(u => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td style={{ direction:'ltr', textAlign:'left' }}>{u.username}</td>
                <td><span className={'role-tag role-'+u.role}>{getRoleLabel(u.role)}</span></td>
                <td><span className={'status-dot '+(u.active?'status-active':'status-inactive')}></span> {u.active?'Actif':'Inactif'}</td>
                <td><div style={{ display:'flex', gap:6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(u.id, u.active)}>{u.active?'🔒 Désactiver':'✅ Activer'}</button>
                  {u.username !== 'admin' && <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u.id, u.name)}>🗑️</button>}
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
