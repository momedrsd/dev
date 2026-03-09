import React from 'react'

export default function LoadingScreen() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'radial-gradient(ellipse at center, #1A2E1C 0%, #0D1B0F 70%)', color:'#C9A84C', fontFamily:'serif', gap:16 }}>
      <div style={{ fontSize:'5rem', filter:'drop-shadow(0 0 20px rgba(201,168,76,0.6))' }}>☪</div>
      <div style={{ fontSize:'2rem', fontFamily:"'Amiri',serif", textAlign:'center' }}>المسابقة الوطنية لتلاوة القرآن الكريم</div>
      <div style={{ color:'#A89860', fontSize:'0.9rem' }}>Chargement en cours...</div>
      <div style={{ width:48, height:48, border:'3px solid rgba(201,168,76,0.2)', borderTopColor:'#C9A84C', borderRadius:'50%', animation:'spin 1s linear infinite' }}></div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
