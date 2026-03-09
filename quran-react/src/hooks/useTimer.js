import { useState, useEffect, useRef } from 'react'

export function useTimer(competition, now) {
  const [display, setDisplay] = useState('00:00')
  const [danger, setDanger] = useState(false)
  const [warning, setWarning] = useState(false)
  const intervalRef = useRef(null)

  const fmt = (s) => String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0')

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (!competition) return
    if (competition.timerRunning && competition.timerEndTime) {
      intervalRef.current = setInterval(() => {
        const rem = Math.max(0, Math.ceil((competition.timerEndTime - now()) / 1000))
        setDisplay(fmt(rem))
        setDanger(rem <= 30)
        setWarning(rem > 30 && rem <= 60)
        if (rem <= 0) clearInterval(intervalRef.current)
      }, 200)
    } else {
      setDisplay(fmt(competition.timerDuration || 300))
      setDanger(false)
      setWarning(false)
    }
    return () => clearInterval(intervalRef.current)
  }, [competition?.timerRunning, competition?.timerEndTime, competition?.timerDuration])

  return { display, danger, warning }
}
