import { useState, useEffect } from 'react'
import { PIXELS_PER_MINUTE } from './constants'

interface CurrentTimeIndicatorProps {
  startHour: number
  endHour: number
}

export function CurrentTimeIndicator({ startHour, endHour }: CurrentTimeIndicatorProps) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = startHour * 60
  const endMinutes = endHour * 60

  if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
    return null
  }

  const top = (currentMinutes - startMinutes) * PIXELS_PER_MINUTE

  return (
    <div
      className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
      style={{ top }}
    >
      <div className="h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-500" />
      <div className="h-px flex-1 bg-zinc-400 dark:bg-zinc-500" />
    </div>
  )
}