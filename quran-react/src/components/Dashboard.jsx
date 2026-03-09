import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import DashboardPage from './pages/DashboardPage'
import ParticipantsPage from './pages/ParticipantsPage'
import RankingsPage from './pages/RankingsPage'
import FinalePage from './pages/FinalePage'
import CompSettingsPage from './pages/CompSettingsPage'
import UsersPage from './pages/UsersPage'
import CriteriaPage from './pages/CriteriaPage'
import TimerSettingsPage from './pages/TimerSettingsPage'
import EmergencyPage from './pages/EmergencyPage'

const NAV = [
  { id: 'dashboard',      icon: '📊', label: 'Tableau de bord',    roles: ['admin','president','judge'] },
  { id: 'participants',   icon: '👥', label: 'Participants',        roles: ['admin','president'] },
  { id: 'rankings',       icon: '🏆', label: 'Classement',         roles: ['admin','president'] },
  { id: 'finale',         icon: '🌟', label: 'Finale',             roles: ['admin','president'] },
  { id: 'comp-settings',  icon: '🏆', label: 'Compétition',        roles: ['admin'] },
  { id: 'users',          icon: '⚙️', label: 'Comptes',            roles: ['admin'] },
  { id: 'criteria',       icon: '📋', label: 'Grille de notation', roles: ['admin'] },
  { id: 'timer-settings', icon: '⏱️', label: 'Paramètres Timer',   roles: ['admin'] },
  { id: 'emergency',      icon: '🚨', label: 'Urgences',           roles: ['admin'] },
]

const PAGES = {
  dashboard: DashboardPage,
  participants: ParticipantsPage,
  rankings: RankingsPage,
  finale: FinalePage,
  'comp-settings': CompSettingsPage,
  users: UsersPage,
  criteria: CriteriaPage,
  'timer-settings': TimerSettingsPage,
  emergency: EmergencyPage,
}

function getRoleLabel(role) {
  return { admin:'Admin', president:'Président', judge:'Juge', participant:'Participant', public:'Public' }[role] || role
}

export default function Dashboard() {
  const { user, competition, logout, scoreUnlocked } = useApp()
  const [page, setPage] = useState('dashboard')
  const role = user.role
  const isJudge = role === 'judge'
  const nav = NAV.filter(n => n.roles.includes(role))
  const PageComponent = PAGES[page] || DashboardPage

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <span className="logo-icon">☪</span>
          <div className="logo-text">
            <h2>{competition?.title || 'المسابقة الوطنية لتلاوة القرآن'}</h2>
            <p>Édition {competition?.edition || 9}{competition?.lieu ? ' — ' + competition.lieu : ' — Warsh & Hafs'}</p>
          </div>
        </div>
        <div className="header-right">
          <div className="live-badge"><span className="dot"></span>EN DIRECT</div>
          {role === 'judge' && (
            <div id="lock-badge" className={'badge ' + (scoreUnlocked ? 'badge-warsh' : 'badge-hafs')}>
              {scoreUnlocked ? '🔓 Modification autorisée' : '🔒 Note verrouillée'}
            </div>
          )}
          <div className="user-badge">
            <span className={'role-tag role-' + role}>{getRoleLabel(role)}</span>
            <span>{user.name}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout}>🚪</button>
        </div>
      </header>

      <div className="app-body">
        {!isJudge && (
          <nav className="sidebar">
            <div className="sidebar-nav">
              {nav.map(n => (
                <div key={n.id}
                  className={'nav-item' + (page === n.id ? ' active' : '')}
                  onClick={() => setPage(n.id)}>
                  <span className="icon">{n.icon}</span>
                  <span>{n.label}</span>
                </div>
              ))}
            </div>
          </nav>
        )}
        <main className="main-content">
          <PageComponent onNavigate={setPage} />
        </main>
      </div>

      <div id="modal-root"></div>
    </div>
  )
}
