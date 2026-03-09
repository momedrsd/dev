import React from 'react'
import { useApp } from '../context/AppContext'

export default function ToastContainer() {
  const { toasts } = useApp()
  return (
    <div className="toast-container" id="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span>{{ success:'✅', error:'❌', info:'ℹ️' }[t.type] || 'ℹ️'}</span>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  )
}
