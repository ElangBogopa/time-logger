'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { fetchEntries as apiFetchEntries, fetchSessionCompletions } from '@/lib/api'
import { TimeEntry, SessionCompletion, PERIOD_TIME_RANGES } from '@/lib/types'
import { canLogYesterdayEvening, getYesterdayDateString } from '@/lib/session-utils'

interface UseSessionDataReturn {
  entries: TimeEntry[]
  completions: SessionCompletion[]
  isLoading: boolean
  yesterdayEveningLogged: boolean
  fetchData: () => Promise<void>
}

interface UseSessionDataProps {
  userId: string
  today: string
  currentHour: number | null
}

// Client-side cache for session data per date — shared across pages
interface SessionCacheEntry {
  entries: TimeEntry[]
  completions: SessionCompletion[]
}
const sessionDataCache = new Map<string, SessionCacheEntry>()

/** Read cached entries for a date (instant, no fetch). Returns null if not cached. */
export function getCachedEntries(date: string): TimeEntry[] | null {
  return sessionDataCache.get(date)?.entries ?? null
}

/** Write entries into the shared cache (called by session pages after fetch). */
export function setCachedEntries(date: string, entries: TimeEntry[]): void {
  const existing = sessionDataCache.get(date)
  if (existing) {
    existing.entries = entries
  } else {
    sessionDataCache.set(date, { entries, completions: [] })
  }
}

export function useSessionData({ userId, today, currentHour }: UseSessionDataProps): UseSessionDataReturn {
  const cached = sessionDataCache.get(today)
  const [entries, setEntries] = useState<TimeEntry[]>(cached?.entries || [])
  const [completions, setCompletions] = useState<SessionCompletion[]>(cached?.completions || [])
  const [isLoading, setIsLoading] = useState(!cached)
  const [yesterdayEveningLogged, setYesterdayEveningLogged] = useState(true)

  // Fetch today's entries and session completions
  const fetchData = useCallback(async () => {
    if (!userId) return

    // Only show loading if we have no cached data for this date
    const cachedData = sessionDataCache.get(today)
    if (cachedData) {
      setEntries(cachedData.entries)
      setCompletions(cachedData.completions)
      setIsLoading(false)
    } else {
      setIsLoading(true)
    }

    try {
      const [entriesData, completionsData] = await Promise.all([
        apiFetchEntries({ date: today, status: 'confirmed', orderBy: 'start_time', orderAsc: true }),
        fetchSessionCompletions({ date: today }),
      ])

      const typedEntries = entriesData as TimeEntry[]
      const typedCompletions = completionsData as SessionCompletion[]

      // Cache the result
      sessionDataCache.set(today, { entries: typedEntries, completions: typedCompletions })

      setEntries(typedEntries)
      setCompletions(typedCompletions)

      // Check if yesterday's evening was logged (for morning prompt)
      // Consider it "logged" if there's a session completion OR actual entries in the evening time range
      if (currentHour !== null && canLogYesterdayEvening(currentHour)) {
        const yesterday = getYesterdayDateString()
        const [yesterdayCompletions, yesterdayEntries] = await Promise.all([
          fetchSessionCompletions({ date: yesterday, period: 'evening' }),
          apiFetchEntries({ date: yesterday, status: 'confirmed' }),
        ])
        // Check for entries in the evening time range (18:00+)
        const eveningRange = PERIOD_TIME_RANGES.evening
        const hasEveningEntries = yesterdayEntries.some(e => {
          const startHour = parseInt(e.start_time?.split(':')[0] || '0', 10)
          return startHour >= eveningRange.start
        })
        setYesterdayEveningLogged(yesterdayCompletions.length > 0 || hasEveningEntries)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [userId, today, currentHour])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    entries,
    completions,
    isLoading,
    yesterdayEveningLogged,
    fetchData,
  }
}