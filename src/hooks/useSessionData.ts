'use client'

import { useState, useCallback, useEffect } from 'react'
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

export function useSessionData({ userId, today, currentHour }: UseSessionDataProps): UseSessionDataReturn {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [completions, setCompletions] = useState<SessionCompletion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [yesterdayEveningLogged, setYesterdayEveningLogged] = useState(true)

  // Fetch today's entries and session completions
  const fetchData = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)

    try {
      const [entriesData, completionsData] = await Promise.all([
        apiFetchEntries({ date: today, status: 'confirmed', orderBy: 'start_time', orderAsc: true }),
        fetchSessionCompletions({ date: today }),
      ])

      setEntries(entriesData as TimeEntry[])
      setCompletions(completionsData as SessionCompletion[])

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