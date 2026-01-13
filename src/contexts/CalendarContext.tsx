'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { getLocalDateString } from '@/lib/types'

export interface CalendarEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  date: string
  isAllDay: boolean
}

interface CalendarCache {
  events: CalendarEvent[]
  startDate: string
  endDate: string
  lastFetched: number
}

interface CalendarContextType {
  events: CalendarEvent[]
  isLoading: boolean
  lastSynced: Date | null
  error: string | null
  getEventsForDate: (date: string) => CalendarEvent[]
  refreshCalendar: () => Promise<void>
  isDateInCache: (date: string) => boolean
  fetchEventsForDate: (date: string) => Promise<void>
}

const CalendarContext = createContext<CalendarContextType | null>(null)

// Cache duration: 30 minutes
const CACHE_DURATION_MS = 30 * 60 * 1000

// How many days to fetch before and after today
const DAYS_BEFORE = 7
const DAYS_AFTER = 14

function getDateRange(centerDate: string, daysBefore: number, daysAfter: number): { start: string; end: string } {
  const center = new Date(centerDate + 'T00:00:00')

  const startDate = new Date(center)
  startDate.setDate(startDate.getDate() - daysBefore)

  const endDate = new Date(center)
  endDate.setDate(endDate.getDate() + daysAfter)

  return {
    start: getLocalDateString(startDate),
    end: getLocalDateString(endDate)
  }
}

export function CalendarProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const [cache, setCache] = useState<CalendarCache | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if cache is valid (not expired)
  const isCacheValid = useCallback(() => {
    if (!cache) return false
    const now = Date.now()
    return now - cache.lastFetched < CACHE_DURATION_MS
  }, [cache])

  // Check if a date is within the cached range
  const isDateInCache = useCallback((date: string): boolean => {
    if (!cache) return false
    return date >= cache.startDate && date <= cache.endDate
  }, [cache])

  // Get events for a specific date from cache
  const getEventsForDate = useCallback((date: string): CalendarEvent[] => {
    if (!cache) return []
    return cache.events.filter(event => event.date === date)
  }, [cache])

  // Fetch calendar events from API
  const fetchCalendarEvents = useCallback(async (startDate: string, endDate: string): Promise<CalendarEvent[]> => {
    if (!session?.accessToken) return []

    const response = await fetch(`/api/calendar/events?start=${startDate}&end=${endDate}`)

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Calendar access expired. Please sign in again.')
      }
      throw new Error('Failed to fetch calendar events')
    }

    const data = await response.json()
    return data.events || []
  }, [session?.accessToken])

  // Refresh the entire cache (manual refresh or initial load)
  const refreshCalendar = useCallback(async () => {
    if (!session?.accessToken) return

    setIsLoading(true)
    setError(null)

    try {
      const today = getLocalDateString()
      const { start, end } = getDateRange(today, DAYS_BEFORE, DAYS_AFTER)

      const events = await fetchCalendarEvents(start, end)

      setCache({
        events,
        startDate: start,
        endDate: end,
        lastFetched: Date.now()
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch calendar')
    } finally {
      setIsLoading(false)
    }
  }, [session?.accessToken, fetchCalendarEvents])

  // Fetch events for a specific date range (when navigating outside cache)
  const fetchEventsForDate = useCallback(async (date: string) => {
    // If date is in cache and cache is valid, no need to fetch
    if (isDateInCache(date) && isCacheValid()) return

    if (!session?.accessToken) return

    setIsLoading(true)
    setError(null)

    try {
      // Fetch a range around the requested date
      const { start, end } = getDateRange(date, DAYS_BEFORE, DAYS_AFTER)
      const newEvents = await fetchCalendarEvents(start, end)

      setCache(prevCache => {
        if (!prevCache) {
          // No previous cache, create new one
          return {
            events: newEvents,
            startDate: start,
            endDate: end,
            lastFetched: Date.now()
          }
        }

        // Merge with existing cache
        // Remove events in the new date range to avoid duplicates
        const existingEvents = prevCache.events.filter(
          event => event.date < start || event.date > end
        )

        return {
          events: [...existingEvents, ...newEvents],
          startDate: start < prevCache.startDate ? start : prevCache.startDate,
          endDate: end > prevCache.endDate ? end : prevCache.endDate,
          lastFetched: Date.now()
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch calendar')
    } finally {
      setIsLoading(false)
    }
  }, [session?.accessToken, isDateInCache, isCacheValid, fetchCalendarEvents])

  // Initial fetch on login
  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken && !cache) {
      refreshCalendar()
    }
  }, [status, session?.accessToken, cache, refreshCalendar])

  // Clear cache on logout
  useEffect(() => {
    if (status === 'unauthenticated') {
      setCache(null)
    }
  }, [status])

  const lastSynced = cache ? new Date(cache.lastFetched) : null

  return (
    <CalendarContext.Provider
      value={{
        events: cache?.events || [],
        isLoading,
        lastSynced,
        error,
        getEventsForDate,
        refreshCalendar,
        isDateInCache,
        fetchEventsForDate
      }}
    >
      {children}
    </CalendarContext.Provider>
  )
}

export function useCalendar() {
  const context = useContext(CalendarContext)
  if (!context) {
    throw new Error('useCalendar must be used within a CalendarProvider')
  }
  return context
}
