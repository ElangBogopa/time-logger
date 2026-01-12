'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TimeEntry, getLocalDateString } from '@/lib/types'
import TimeEntryForm from '@/components/TimeEntryForm'
import TimelineView, { CalendarEvent } from '@/components/TimelineView'
import WeeklySummary from '@/components/WeeklySummary'
import StatsCard from '@/components/StatsCard'
import QuickLogModal from '@/components/QuickLogModal'
import Toast from '@/components/Toast'
import GhostEntryModal from '@/components/GhostEntryModal'

type View = 'day' | 'weekly'

function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (dateStr === getLocalDateString(today)) {
    return 'Today'
  } else if (dateStr === getLocalDateString(yesterday)) {
    return 'Yesterday'
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function getAdjacentDate(dateStr: string, direction: 'prev' | 'next'): string {
  const date = new Date(dateStr + 'T00:00:00')
  date.setDate(date.getDate() + (direction === 'next' ? 1 : -1))
  return getLocalDateString(date)
}

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(getLocalDateString())
  const [view, setView] = useState<View>('day')
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false)
  const [isFormExpanded, setIsFormExpanded] = useState(false)
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [selectedGhostEvent, setSelectedGhostEvent] = useState<CalendarEvent | null>(null)
  const [toast, setToast] = useState<{ message: string } | null>(null)
  const navRef = useRef<HTMLDivElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  // Get user ID from session
  const userId = session?.user?.id || session?.user?.email || ''

  const today = getLocalDateString()
  const isToday = selectedDate === today
  const canGoNext = selectedDate < today

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // Get the last entry's end time for Quick Log auto-fill
  const lastEntryEndTime = entries.length > 0
    ? entries.reduce((latest, entry) => {
        if (!entry.end_time) return latest
        if (!latest) return entry.end_time
        return entry.end_time > latest ? entry.end_time : latest
      }, null as string | null)
    : null

  const fetchEntries = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('date', selectedDate)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setEntries(data as TimeEntry[])
    }
    setIsLoading(false)
  }, [selectedDate, userId])

  // Fetch calendar events for the selected date
  const fetchCalendarEvents = useCallback(async () => {
    if (!session?.accessToken) return

    try {
      const response = await fetch(`/api/calendar/events?date=${selectedDate}`)
      if (response.ok) {
        const data = await response.json()
        // Filter out all-day events and events without times
        const timedEvents = (data.events || []).filter(
          (e: CalendarEvent) => !e.isAllDay && e.startTime && e.endTime
        )
        setCalendarEvents(timedEvents)
      }
    } catch (err) {
      console.error('Failed to fetch calendar events:', err)
    }
  }, [selectedDate, session?.accessToken])

  useEffect(() => {
    if (view === 'day') {
      fetchEntries()
      fetchCalendarEvents()
    }
  }, [fetchEntries, fetchCalendarEvents, view])

  // Close nav dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setIsNavOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate)
    setView('day')
    setIsNavOpen(false)
  }

  const handleRefresh = () => {
    fetchEntries()
    setIsFormExpanded(false)
  }

  const showToast = (message: string) => {
    setToast({ message })
  }

  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  // Don't render if not authenticated (will redirect)
  if (status === 'unauthenticated') {
    return null
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Time Logger</h1>

              {/* Navigation dropdown */}
              <div ref={navRef} className="relative">
                <button
                  onClick={() => setIsNavOpen(!isNavOpen)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>

                {isNavOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                    <button
                      onClick={() => {
                        setSelectedDate(today)
                        setView('day')
                        setIsNavOpen(false)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      <span>📅</span> Today
                    </button>
                    <button
                      onClick={() => {
                        setView('weekly')
                        setIsNavOpen(false)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      <span>📊</span> Weekly Summary
                    </button>
                    <hr className="my-1 border-zinc-200 dark:border-zinc-700" />
                    <button
                      onClick={() => dateInputRef.current?.showPicker()}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      <span>🔍</span> Go to date...
                    </button>
                    <input
                      ref={dateInputRef}
                      type="date"
                      value={selectedDate}
                      max={today}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className="sr-only"
                    />
                    <hr className="my-1 border-zinc-200 dark:border-zinc-700" />
                    <div className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {session?.user?.email}
                    </div>
                    <button
                      onClick={() => signOut({ callbackUrl: '/login' })}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      <span>🚪</span> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Log button */}
            {view === 'day' && isToday && (
              <button
                onClick={() => setIsQuickLogOpen(true)}
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
              >
                <span>⚡</span>
                <span className="hidden sm:inline">Quick Log</span>
              </button>
            )}
          </div>
        </header>

        {view === 'day' ? (
          <>
            {/* Date Navigation */}
            <div className="mb-6 flex items-center justify-between">
              <button
                onClick={() => handleDateChange(getAdjacentDate(selectedDate, 'prev'))}
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                aria-label="Previous day"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <button
                onClick={() => dateInputRef.current?.showPicker()}
                className="flex items-center gap-2 rounded-lg px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatDateDisplay(selectedDate)}
                </span>
                {!isToday && (
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </button>

              <button
                onClick={() => canGoNext && handleDateChange(getAdjacentDate(selectedDate, 'next'))}
                disabled={!canGoNext}
                className={`rounded-lg p-2 ${
                  canGoNext
                    ? 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300'
                    : 'cursor-not-allowed text-zinc-300 dark:text-zinc-600'
                }`}
                aria-label="Next day"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Stats Card - only show for today */}
            {isToday && <StatsCard userId={userId} />}

            {/* Add Entry - Collapsible */}
            {isToday && (
              <div className="mb-6">
                {isFormExpanded ? (
                  <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        Add Entry
                      </h2>
                      <button
                        onClick={() => setIsFormExpanded(false)}
                        className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <TimeEntryForm onEntryAdded={handleRefresh} onShowToast={showToast} userId={userId} />
                  </section>
                ) : (
                  <button
                    onClick={() => setIsFormExpanded(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 py-3 text-sm font-medium text-zinc-500 transition-colors hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add detailed entry
                  </button>
                )}
              </div>
            )}

            {/* Timeline */}
            <section>
              <TimelineView
                entries={entries}
                calendarEvents={calendarEvents}
                isLoading={isLoading}
                onEntryDeleted={fetchEntries}
                onGhostEntryClick={setSelectedGhostEvent}
                selectedDate={selectedDate}
                isToday={isToday}
              />
            </section>
          </>
        ) : (
          /* Weekly Summary View */
          <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Weekly Summary</h2>
              <button
                onClick={() => setView('day')}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                ← Back to today
              </button>
            </div>
            <WeeklySummary userId={userId} />
          </section>
        )}
      </div>

      <QuickLogModal
        isOpen={isQuickLogOpen}
        onClose={() => setIsQuickLogOpen(false)}
        onEntryAdded={fetchEntries}
        lastEntryEndTime={lastEntryEndTime}
        onShowToast={showToast}
        userId={userId}
        calendarEvents={calendarEvents}
        entries={entries}
      />

      <GhostEntryModal
        event={selectedGhostEvent}
        onClose={() => setSelectedGhostEvent(null)}
        onConfirm={() => {
          setSelectedGhostEvent(null)
          fetchEntries()
          fetchCalendarEvents()
        }}
        onShowToast={showToast}
        userId={userId}
        selectedDate={selectedDate}
      />

      {toast && (
        <Toast
          title="Entry added"
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
