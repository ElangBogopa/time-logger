'use client'

import { useState, useCallback, useEffect } from 'react'
import { fetchEntries as apiFetchEntries, fetchSessionCompletions } from '@/lib/api'
import { TimeEntry, SessionCompletion } from '@/lib/types'
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
      // Use 12 as fallback (won't show prompt) if currentHour not yet set
      if (currentHour !== null && canLogYesterdayEvening(currentHour)) {
        const yesterday = getYesterdayDateString()
        const yesterdayCompletions = await fetchSessionCompletions({ date: yesterday, period: 'evening' })
        setYesterdayEveningLogged(yesterdayCompletions.length > 0)
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