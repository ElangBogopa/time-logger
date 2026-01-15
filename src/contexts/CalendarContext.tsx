'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from 'react'
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

interface CalendarStatus {
  connected: boolean
  source: 'google_oauth' | 'calendar_connection' | null
  googleEmail: string | null
}

interface CalendarContextType {
  events: CalendarEvent[]
  isLoading: boolean
  lastSynced: Date | null
  error: string | null
  calendarStatus: CalendarStatus | null
  isCheckingStatus: boolean
  getEventsForDate: (date: string) => CalendarEvent[]
  refreshCalendar: () => Promise<void>
  isDateInCache: (date: string) => boolean
  fetchEventsForDate: (date: string) => Promise<void>
  checkCalendarStatus: () => Promise<void>
}

const CalendarContext = createContext<CalendarContextType | null>(null)

// Cache duration: 30 minutes
const CACHE_DURATION_MS = 30 * 60 * 1000

// How many days to fetch before and after today
const DAYS_BEFORE = 7
const DAYS_AFTER = 14

// Maximum number of events to keep in cache (prevents memory bloat)
const MAX_CACHE_EVENTS = 500

// Maximum days to keep in cache from today
const MAX_CACHE_DAYS = 30

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
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)

  // Track in-flight fetches to prevent race conditions
  const fetchInProgressRef = useRef<Set<string>>(new Set())

  // Check calendar connection status
  const checkCalendarStatus = useCallback(async () => {
    if (status !== 'authenticated') return

    console.log('[CalendarContext] Checking calendar status...')
    setIsCheckingStatus(true)
    try {
      const response = await fetch('/api/calendar/status')
      if (response.ok) {
        const data = await response.json()
        console.log('[CalendarContext] Status response:', data)
        setCalendarStatus({
          connected: data.connected,
          source: data.source,
          googleEmail: data.googleEmail,
        })
      }
    } catch (err) {
      console.error('Failed to check calendar status:', err)
    } finally {
      setIsCheckingStatus(false)
    }
  }, [status])

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
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const response = await fetch(`/api/calendar/events?start=${startDate}&end=${endDate}&timezone=${encodeURIComponent(timezone)}`)

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))

      if (data.code === 'NO_CALENDAR') {
        // No calendar connected - not an error, just no events
        return []
      }

      if (data.code === 'SCOPE_INSUFFICIENT') {
        // Token doesn't have calendar scope - need to reconnect
        throw new Error('Calendar permission not granted. Please go to Settings > Connections and reconnect your calendar.')
      }

      if (response.status === 401) {
        throw new Error('Calendar access expired. Please reconnect your calendar.')
      }
      throw new Error('Failed to fetch calendar events')
    }

    const data = await response.json()
    return data.events || []
  }, [])

  // Refresh the entire cache (manual refresh or initial load)
  const refreshCalendar = useCallback(async () => {
    console.log('[CalendarContext] refreshCalendar called, connected=', calendarStatus?.connected)
    if (!calendarStatus?.connected) return

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
  }, [calendarStatus?.connected, fetchCalendarEvents])

  // Fetch events for a specific date range (when navigating outside cache)
  const fetchEventsForDate = useCallback(async (date: string) => {
    // If date is in cache and cache is valid, no need to fetch
    if (isDateInCache(date) && isCacheValid()) return

    if (!calendarStatus?.connected) return

    // Prevent concurrent fetches for the same date range (race condition fix)
    const { start, end } = getDateRange(date, DAYS_BEFORE, DAYS_AFTER)
    const fetchKey = `${start}:${end}`

    if (fetchInProgressRef.current.has(fetchKey)) {
      return // Already fetching this range
    }

    fetchInProgressRef.current.add(fetchKey)
    setIsLoading(true)
    setError(null)

    try {
      const newEvents = await fetchCalendarEvents(start, end)

      setCache(prevCache => {
        // Calculate the valid date window (today +/- MAX_CACHE_DAYS)
        const today = getLocalDateString()
        const todayDate = new Date(today + 'T00:00:00')
        const minDate = new Date(todayDate)
        minDate.setDate(minDate.getDate() - MAX_CACHE_DAYS)
        const maxDate = new Date(todayDate)
        maxDate.setDate(maxDate.getDate() + MAX_CACHE_DAYS)
        const minDateStr = getLocalDateString(minDate)
        const maxDateStr = getLocalDateString(maxDate)

        if (!prevCache) {
          // No previous cache, create new one
          return {
            events: newEvents.slice(0, MAX_CACHE_EVENTS),
            startDate: start,
            endDate: end,
            lastFetched: Date.now()
          }
        }

        // Merge with existing cache, but evict old events
        // Remove events in the new date range to avoid duplicates
        // Also remove events outside the valid date window
        const existingEvents = prevCache.events.filter(event => {
          // Remove duplicates in new range
          if (event.date >= start && event.date <= end) return false
          // Evict events outside valid window
          if (event.date < minDateStr || event.date > maxDateStr) return false
          return true
        })

        // Combine and limit to MAX_CACHE_EVENTS
        const allEvents = [...existingEvents, ...newEvents]
        const limitedEvents = allEvents.length > MAX_CACHE_EVENTS
          ? allEvents.slice(-MAX_CACHE_EVENTS) // Keep most recent events
          : allEvents

        // Calculate new cache bounds (use string comparison for dates)
        const effectiveStart = start > minDateStr ? start : minDateStr
        const effectiveEnd = end < maxDateStr ? end : maxDateStr
        const newStartDate = effectiveStart < prevCache.startDate ? effectiveStart : prevCache.startDate
        const newEndDate = effectiveEnd > prevCache.endDate ? effectiveEnd : prevCache.endDate

        return {
          events: limitedEvents,
          startDate: newStartDate,
          endDate: newEndDate,
          lastFetched: Date.now()
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch calendar')
    } finally {
      fetchInProgressRef.current.delete(fetchKey)
      setIsLoading(false)
    }
  }, [calendarStatus?.connected, isDateInCache, isCacheValid, fetchCalendarEvents])

  // Check calendar status on login
  useEffect(() => {
    if (status === 'authenticated' && !calendarStatus) {
      checkCalendarStatus()
    }
  }, [status, calendarStatus, checkCalendarStatus])

  // Initial fetch when calendar is connected
  useEffect(() => {
    console.log('[CalendarContext] useEffect: connected=', calendarStatus?.connected, 'cache=', !!cache)
    if (calendarStatus?.connected && !cache) {
      console.log('[CalendarContext] Triggering initial calendar refresh')
      refreshCalendar()
    }
  }, [calendarStatus?.connected, cache, refreshCalendar])

  // Clear cache on logout
  useEffect(() => {
    if (status === 'unauthenticated') {
      setCache(null)
      setCalendarStatus(null)
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
        calendarStatus,
        isCheckingStatus,
        getEventsForDate,
        refreshCalendar,
        isDateInCache,
        fetchEventsForDate,
        checkCalendarStatus
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
