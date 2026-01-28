'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export type FocusSessionState = 'idle' | 'active' | 'completed'

export interface FocusSessionData {
  isActive: boolean
  startTime: number // epoch ms
  durationMinutes: number
  activity: string
  label: string
}

export interface CompletedSessionData {
  activity: string
  category: string
  durationMinutes: number
  startTime: string // ISO
  endTime: string // ISO
  date: string // YYYY-MM-DD
  actualElapsedMinutes: number
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

function saveSession(data: FocusSessionData | null) {
  if (typeof window === 'undefined') return
  if (data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export function useFocusSession() {
  const [state, setState] = useState<FocusSessionState>('idle')
  const [sessionData, setSessionData] = useState<FocusSessionData | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [completedData, setCompletedData] = useState<CompletedSessionData | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasCompletedRef = useRef(false)

  // Calculate remaining time from session data
  const calcRemaining = useCallback((data: FocusSessionData): number => {
    const elapsed = (Date.now() - data.startTime) / 1000
    const total = data.durationMinutes * 60
    return Math.max(0, Math.ceil(total - elapsed))
  }, [])

  // Complete the session
  const completeSession = useCallback((data: FocusSessionData, endedEarly: boolean = false) => {
    if (hasCompletedRef.current) return
    hasCompletedRef.current = true

    const startDate = new Date(data.startTime)
    const endDate = endedEarly ? new Date() : new Date(data.startTime + data.durationMinutes * 60 * 1000)
    const actualElapsed = Math.round((endDate.getTime() - data.startTime) / 60000)

    // Format times as HH:MM
    const formatTime = (d: Date) => {
      const h = String(d.getHours()).padStart(2, '0')
      const m = String(d.getMinutes()).padStart(2, '0')
      return `${h}:${m}`
    }

    // Format date as YYYY-MM-DD
    const formatDate = (d: Date) => {
      const y = d.getFullYear()
      const mo = String(d.getMonth() + 1).padStart(2, '0')
      const da = String(d.getDate()).padStart(2, '0')
      return `${y}-${mo}-${da}`
    }

    const completed: CompletedSessionData = {
      activity: data.activity || 'Focus Session',
      category: 'deep_work',
      durationMinutes: actualElapsed,
      startTime: formatTime(startDate),
      endTime: formatTime(endDate),
      date: formatDate(startDate),
      actualElapsedMinutes: actualElapsed,
    }

    saveSession(null)
    setCompletedData(completed)
    setSessionData(null)
    setState('completed')

    // Send browser notification
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('🎯 Focus Session Complete!', {
          body: `Great work! ${actualElapsed} minutes of deep focus logged.`,
          icon: '/icon-192x192.png',
          tag: 'focus-session-complete',
        })
      } catch {
        // Notification failed, that's fine
      }
    }
  }, [])

  // Tick: update remaining time
  const tick = useCallback(() => {
    const data = loadSession()
    if (!data || !data.isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    const remaining = calcRemaining(data)
    setRemainingSeconds(remaining)

    if (remaining <= 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      completeSession(data, false)
    }
  }, [calcRemaining, completeSession])

  // Initialize from localStorage on mount
  useEffect(() => {
    const data = loadSession()
    if (data && data.isActive) {
      const remaining = calcRemaining(data)
      if (remaining <= 0) {
        // Session ended while page was closed
        completeSession(data, false)
      } else {
        setSessionData(data)
        setRemainingSeconds(remaining)
        setState('active')
        hasCompletedRef.current = false
      }
    }
  }, [calcRemaining, completeSession])

  // Set up interval when active
  useEffect(() => {
    if (state === 'active') {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(tick, 1000)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [state, tick])

  // Handle visibility change — recalculate remaining when tab becomes visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && state === 'active') {
        tick()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [state, tick])

  // Start a new session
  const startSession = useCallback((durationMinutes: number, activity: string = 'Focus Session') => {
    const data: FocusSessionData = {
      isActive: true,
      startTime: Date.now(),
      durationMinutes,
      activity,
      label: activity,
    }
    saveSession(data)
    setSessionData(data)
    setRemainingSeconds(durationMinutes * 60)
    setState('active')
    hasCompletedRef.current = false
    setSaved(false)
    setCompletedData(null)
  }, [])

  // End early (still logs the time)
  const endEarly = useCallback(() => {
    const data = loadSession()
    if (data && data.isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      completeSession(data, true)
    }
  }, [completeSession])

  // Cancel (discards session)
  const cancelSession = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    saveSession(null)
    setSessionData(null)
    setRemainingSeconds(0)
    setState('idle')
    hasCompletedRef.current = false
    setCompletedData(null)
  }, [])

  // Save the completed entry
  const saveEntry = useCallback(async (overrides?: Partial<CompletedSessionData>) => {
    if (!completedData) return
    setIsSaving(true)

    const entryData = { ...completedData, ...overrides }

    try {
      await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: entryData.date,
          activity: entryData.activity,
          category: entryData.category,
          duration_minutes: entryData.durationMinutes,
          start_time: entryData.startTime,
          end_time: entryData.endTime,
          status: 'confirmed',
        }),
      })
      setSaved(true)
    } catch (err) {
      console.error('Failed to save focus session entry:', err)
      throw err
    } finally {
      setIsSaving(false)
    }
  }, [completedData])

  // Reset to idle
  const reset = useCallback(() => {
    setState('idle')
    setCompletedData(null)
    setSaved(false)
    hasCompletedRef.current = false
  }, [])

  // Computed values
  const totalSeconds = sessionData ? sessionData.durationMinutes * 60 : 0
  const elapsedSeconds = totalSeconds - remainingSeconds
  const progress = totalSeconds > 0 ? (elapsedSeconds / totalSeconds) * 100 : 0

  return {
    state,
    sessionData,
    remainingSeconds,
    totalSeconds,
    elapsedSeconds,
    progress,
    completedData,
    isSaving,
    saved,
    startSession,
    endEarly,
    cancelSession,
    saveEntry,
    reset,
  }
}
