'use client'

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { fetchEntries } from '@/lib/api'
import { TimeEntry, getLocalDateString, isDateLoggable, VIEWING_PAST_MESSAGE } from '@/lib/types'
import TimelineView, { DragCreateData } from '@/components/TimelineView'
import type { CommittedTask } from '@/components/timeline/TimelineCommitted'
import { useCalendar, CalendarEvent } from '@/contexts/CalendarContext'
import QuickLogModal from '@/components/QuickLogModal'
import Toast from '@/components/Toast'
import GhostEntryModal from '@/components/GhostEntryModal'
import { Button } from '@/components/ui/button'
import CalendarPicker from '@/components/CalendarPicker'
import WeekStrip from '@/components/WeekStrip'
import ErrorBoundary from '@/components/ErrorBoundary'
import { Calendar, ChevronLeft, ChevronRight, Loader2, RefreshCw, Clock, X } from 'lucide-react'

function formatDateDisplay(dateStr: string): { label: string; date: string; isFuture: boolean } {
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const isFuture = date > today

  if (dateStr === getLocalDateString(today)) {
    return { label: 'Today', date: formattedDate, isFuture: false }
  } else if (dateStr === getLocalDateString(yesterday)) {
    return { label: 'Yesterday', date: formattedDate, isFuture: false }
  } else if (dateStr === getLocalDateString(tomorrow)) {
    return { label: 'Tomorrow', date: formattedDate, isFuture: true }
  }

  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' })
  return { label: weekday, date: formattedDate, isFuture }
}

function CalendarContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // Initialize to empty string for hydration safety, set on client
  const [selectedDate, setSelectedDate] = useState('')

  // Set selected date on client to avoid hydration mismatch — respect ?date= param
  useEffect(() => {
    if (!selectedDate) {
      const dateParam = searchParams.get('date')
      const initial = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : getLocalDateString()
      // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only initialization for hydration safety
      setSelectedDate(initial)
    }
  }, [selectedDate, searchParams])
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false)
  const [selectedGhostEvent, setSelectedGhostEvent] = useState<CalendarEvent | null>(null)
  const [toast, setToast] = useState<{ message: string } | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [dragCreateData, setDragCreateData] = useState<DragCreateData | null>(null)
  const [showCalendarPicker, setShowCalendarPicker] = useState(false)
  const [taskFromParam, setTaskFromParam] = useState<string | null>(null)

  // Read ?task= param (from "View calendar" in commit modal) — show banner, pre-fill when user creates entry
  useEffect(() => {
    const taskParam = searchParams.get('task')
    if (taskParam) {
      setTaskFromParam(taskParam)
      // Clean up URL param but keep task in state
      window.history.replaceState(null, '', selectedDate ? `/calendar?date=${selectedDate}` : '/calendar')
    }
  }, [searchParams, selectedDate])
  const [committedTasks, setCommittedTasks] = useState<CommittedTask[]>([])

  // Use cached calendar events from context
  const {
    getEventsForDate,
    fetchEventsForDate,
    refreshCalendar,
    isLoading: isCalendarLoading,
    isDateInCache,
    calendarStatus,
  } = useCalendar()

  // Get calendar events for the selected date from cache
  const calendarEvents = useMemo(() => {
    return getEventsForDate(selectedDate).filter(
      (e: CalendarEvent) => !e.isAllDay && e.startTime && e.endTime
    )
  }, [getEventsForDate, selectedDate])

  // Get user ID from session
  const userId = session?.user?.id || session?.user?.email || ''

  // Use selectedDate as "today" reference since both are set client-side
  const isToday = selectedDate === getLocalDateString()

  // Memoize date display calculations
  const { dateDisplay, isFutureDay, isPastDay } = useMemo(() => {
    const display = formatDateDisplay(selectedDate)
    return {
      dateDisplay: display,
      isFutureDay: display.isFuture,
      isPastDay: !isToday && !display.isFuture
    }
  }, [selectedDate, isToday])

  // Check if logging is allowed for the selected date
  const canLog = isDateLoggable(selectedDate)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // Get the last entry's end time for Quick Log auto-fill
  const lastEntryEndTime = useMemo(() => {
    if (entries.length === 0) return null
    return entries.reduce((latest, entry) => {
      if (!entry.end_time) return latest
      if (!latest) return entry.end_time
      return entry.end_time > latest ? entry.end_time : latest
    }, null as string | null)
  }, [entries])

  const fetchEntriesForDate = useCallback(async () => {
    if (!userId || !selectedDate) return
    setIsLoading(true)
    try {
      const [data, plansRes] = await Promise.all([
        fetchEntries({ date: selectedDate }),
        fetch(`/api/plans?date=${selectedDate}`),
      ])
      setEntries(data)

      // Fetch committed tasks for this date
      if (plansRes.ok) {
        const { plans } = await plansRes.json()
        const committed = (plans || [])
          .filter((p: CommittedTask & { committed_start: string | null }) => p.committed_start && p.committed_end)
          .map((p: CommittedTask) => ({
            id: p.id,
            title: p.title,
            date: p.date,
            committed_start: p.committed_start,
            committed_end: p.committed_end,
            completed: p.completed,
          }))
        setCommittedTasks(committed)
      }
    } catch (error) {
      console.error('Failed to fetch entries:', error)
    }
    setIsLoading(false)
  }, [selectedDate, userId])

  // Fetch entries and calendar events for the selected date
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching in effect is a standard pattern
    fetchEntriesForDate()
    if (!isDateInCache(selectedDate)) {
      fetchEventsForDate(selectedDate)
    }
  }, [fetchEntriesForDate, refreshKey, selectedDate, isDateInCache, fetchEventsForDate])

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate)
  }

  const handlePrevDay = () => {
    const date = new Date(selectedDate + 'T00:00:00')
    date.setDate(date.getDate() - 1)
    setSelectedDate(getLocalDateString(date))
  }

  const handleNextDay = () => {
    const date = new Date(selectedDate + 'T00:00:00')
    date.setDate(date.getDate() + 1)
    setSelectedDate(getLocalDateString(date))
  }

  const showToast = (message: string) => {
    setToast({ message })
  }

  // Handle drag to create new entry
  const handleDragCreate = (data: DragCreateData) => {
    setDragCreateData(data)
    setIsQuickLogOpen(true)
  }

  // Show loading state (also wait for selectedDate to be set for hydration)
  if (status === 'loading' || !selectedDate) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background pb-20">
        <div className="mx-auto max-w-2xl px-4 py-6">
          {/* Header */}
          <header className="mb-4">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Calendar
              </h1>

              {calendarStatus?.connected && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refreshCalendar()}
                  disabled={isCalendarLoading}
                >
                  <RefreshCw className={`h-4 w-4 ${isCalendarLoading ? 'animate-spin' : ''}`} />
                  {isCalendarLoading ? 'Syncing' : 'Sync'}
                </Button>
              )}
            </div>

            {/* Date navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={handlePrevDay}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Previous day"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <button
                onClick={() => setShowCalendarPicker(!showCalendarPicker)}
                className="flex flex-col items-center px-4 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <span className="text-lg font-semibold">{dateDisplay.label}</span>
                <span className="text-sm text-muted-foreground">{dateDisplay.date}</span>
              </button>

              <button
                onClick={handleNextDay}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Next day"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Calendar picker dropdown */}
            {showCalendarPicker && (
              <div className="mt-2 flex justify-center">
                <CalendarPicker
                  selectedDate={selectedDate}
                  onDateSelect={(date) => {
                    handleDateChange(date)
                    setShowCalendarPicker(false)
                  }}
                  datesWithEntries={entries.map(e => e.date)}
                />
              </div>
            )}
          </header>

          {/* Week Strip */}
          <div className="mb-4">
            <WeekStrip
              selectedDate={selectedDate}
              onDateSelect={handleDateChange}
              datesWithEntries={entries.map(e => e.date)}
            />
          </div>

          {/* Viewing-only message for old dates */}
          {!canLog && isPastDay && (
            <div className="mb-4 rounded-lg bg-zinc-100 px-4 py-3 text-center dark:bg-zinc-800">
              <p className="text-sm text-muted-foreground">
                {VIEWING_PAST_MESSAGE}
              </p>
            </div>
          )}

          {/* Task planning banner */}
          {taskFromParam && (
            <div className="mb-3 flex items-center justify-between rounded-xl border border-[#8B7E74]/30 bg-[#8B7E74]/10 px-4 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Clock className="h-4 w-4 shrink-0 text-[#8B7E74]" />
                <div className="min-w-0">
                  <p className="text-xs text-[#8B7E74]/70">Planning task</p>
                  <p className="text-sm font-medium text-foreground truncate">{taskFromParam}</p>
                </div>
              </div>
              <button
                onClick={() => setTaskFromParam(null)}
                className="shrink-0 ml-2 text-muted-foreground/40 hover:text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Timeline */}
          <section>
            <TimelineView
              key={refreshKey}
              entries={entries}
              calendarEvents={calendarEvents}
              committedTasks={committedTasks}
              isLoading={isLoading}
              onEntryDeleted={fetchEntriesForDate}
              onGhostEntryClick={setSelectedGhostEvent}
              onDragCreate={canLog ? handleDragCreate : undefined}
              onShowToast={showToast}
              selectedDate={selectedDate}
              isToday={isToday}
              isFutureDay={isFutureDay}
              isPastDay={isPastDay}
              canLog={canLog}
            />
          </section>
        </div>

        <QuickLogModal
          isOpen={isQuickLogOpen}
          onClose={() => {
            setIsQuickLogOpen(false)
            setDragCreateData(null)
            setTaskFromParam(null)
          }}
          onEntryAdded={() => {
            fetchEntriesForDate()
            setDragCreateData(null)
          }}
          lastEntryEndTime={lastEntryEndTime}
          initialStartTime={dragCreateData?.startTime}
          initialEndTime={dragCreateData?.endTime}
          onShowToast={showToast}
          userId={userId}
          calendarEvents={calendarEvents}
          entries={entries}
          selectedDate={selectedDate}
          isFutureDay={isFutureDay}
          isPastDay={isPastDay}
          disablePostSubmit={true}
          initialActivity={taskFromParam || undefined}
        />

        <GhostEntryModal
          event={selectedGhostEvent}
          onClose={() => setSelectedGhostEvent(null)}
          onConfirm={() => {
            setSelectedGhostEvent(null)
            fetchEntriesForDate()
          }}
          onShowToast={showToast}
          userId={userId}
          selectedDate={selectedDate}
        />

        {/* Toast removed — no popups on entry add/confirm */}
      </div>
    </ErrorBoundary>
  )
}

export default function CalendarPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    }>
      <CalendarContent />
    </Suspense>
  )
}
