'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Target, Square } from 'lucide-react'

interface FocusSessionData {
  isActive: boolean
  startTime: number
  durationMinutes: number
  activity: string
  label: string
}

const STORAGE_KEY = 'focus-session'

function loadSession(): FocusSessionData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as FocusSessionData
    if (data.isActive && data.startTime && data.durationMinutes) {
      return data
    }
    return null
  } catch {
    return null
  }
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * A thin floating bar shown at the top of all pages when a focus session is active.
 * This reads directly from localStorage to stay independent of the main FocusSession component.
 */
export default function FocusSessionBar() {
  const [remaining, setRemaining] = useState<number | null>(null)
  const [activity, setActivity] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const tick = useCallback(() => {
    const data = loadSession()
    if (!data || !data.isActive) {
      setRemaining(null)
      setActivity('')
      return
    }

    const elapsed = (Date.now() - data.startTime) / 1000
    const total = data.durationMinutes * 60
    const rem = Math.max(0, Math.ceil(total - elapsed))

    setRemaining(rem)
    setActivity(data.activity || 'Focus Session')

    if (rem <= 0) {
      // Session completed — the main component handles completion.
      // Clear storage so the bar disappears.
      setRemaining(null)
    }
  }, [])

  useEffect(() => {
    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [tick])

  // Also listen to storage changes (e.g. another tab started/stopped a session)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) tick()
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [tick])

  // Listen to visibility change
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [tick])

  if (remaining === null || remaining <= 0) return null

  const progress = (() => {
    const data = loadSession()
    if (!data) return 0
    const total = data.durationMinutes * 60
    const elapsed = (Date.now() - data.startTime) / 1000
    return Math.min(100, (elapsed / total) * 100)
  })()

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      {/* Progress bar background */}
      <div className="h-1 w-full bg-zinc-300 dark:bg-zinc-800/50">
        <div
          className="h-full bg-[#6B8CAE] transition-[width] duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
      {/* Info bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#6B8CAE]/10 dark:bg-[#6B8CAE]/10 backdrop-blur-md border-b border-[#6B8CAE]/20 dark:border-[#6B8CAE]/20">
        <div className="flex items-center gap-2 min-w-0">
          <Target className="h-3.5 w-3.5 text-[#6B8CAE] shrink-0" />
          <span className="text-xs font-medium text-[#6B8CAE] truncate">
            {activity}
          </span>
        </div>
        <span className="text-xs font-mono font-semibold text-[#6B8CAE] tabular-nums shrink-0 ml-3">
          {formatCountdown(remaining)}
        </span>
      </div>
    </div>
  )
}
