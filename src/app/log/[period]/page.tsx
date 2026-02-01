'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { fetchEntries as apiFetchEntries, deleteEntry, upsertSessionCompletion, csrfFetch } from '@/lib/api'
import {
  TimePeriod,
  TimeEntry,
  PERIOD_LABELS,
  PERIOD_TIME_RANGES,
  getUserToday,
  getRealToday,
  DAY_ROLLOVER_HOUR,
} from '@/lib/types'
import {
  getEntriesForPeriod,
  getSessionStats,
  formatSessionDuration,
  getPeriodStartTime,
  getPeriodEndTime,
  getFlexiblePeriodRange,
  getYesterdayDateString,
} from '@/lib/session-utils'
import { timeToMinutes } from '@/lib/time-utils'
import { useCalendar, CalendarEvent } from '@/contexts/CalendarContext'
import PeriodSummaryPopup from '@/components/PeriodSummaryPopup'
import TimelineView, { DragCreateData } from '@/components/TimelineView'
import ActivityList from '@/components/ActivityList'
import GhostEntryModal from '@/components/GhostEntryModal'
import QuickLogModal from '@/components/QuickLogModal'
import { Button } from '@/components/ui/button'
// Task completion happens exclusively in the post-session popup
import {
  ArrowLeft,
  Sun,
  Cloud,
  Moon,
  Loader2,
  Plus,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react'
import { toast as sonnerToast } from 'sonner'

const PERIOD_ICONS: Record<TimePeriod, typeof Sun> = {
  morning: Sun,
  afternoon: Cloud,
  evening: Moon,
}

const PERIOD_COLORS: Record<TimePeriod, { gradient: string; text: string; bg: string }> = {
  morning: {
    gradient: 'from-amber-500 via-orange-500 to-yellow-500',
    text: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  afternoon: {
    gradient: 'from-blue-500 via-cyan-500 to-teal-500',
    text: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  evening: {
    gradient: 'from-indigo-500 via-purple-500 to-pink-500',
    text: 'text-indigo-500',
    bg: 'bg-indigo-500/10',
  },
}

export default function LogPeriodPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const period = params.period as TimePeriod

  // Validate period - use fallback for hooks (redirect happens after hooks)
  const isValidPeriod = ['morning', 'afternoon', 'evening'].includes(period)
  const safePeriod: TimePeriod = isValidPeriod ? period : 'morning'

  const Icon = PERIOD_ICONS[safePeriod]
  const colors = PERIOD_COLORS[safePeriod]
  const label = PERIOD_LABELS[safePeriod]
  const range = PERIOD_TIME_RANGES[safePeriod]

  // Date handling - support yesterday's evening and arbitrary dates (YYYY-MM-DD)
  // Initialize empty for hydration safety, set on client
  const dateParam = searchParams.get('date')
  const isYesterday = dateParam === 'yesterday'
  const [selectedDate, setSelectedDate] = useState('')

  // Set selected date on client to avoid hydration mismatch
  useEffect(() => {
    if (!selectedDate) {
      if (isYesterday) {
        setSelectedDate(getYesterdayDateString())
      } else if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        setSelectedDate(dateParam)
      } else {
        setSelectedDate(getUserToday())
      }
    }
  }, [selectedDate, isYesterday, dateParam])

  // Navigate home preserving the date context
  const goHome = () => {
    const today = getUserToday()
    if (selectedDate && selectedDate !== today) {
      router.push(`/?date=${selectedDate}`)
    } else {
      router.push('/')
    }
  }

  // Edit window: only today and yesterday are editable
  const isLocked = (() => {
    if (!selectedDate) return false
    const today = getUserToday()
    const [y, m, d] = today.split('-').map(Number)
    const yesterdayDate = new Date(y, m - 1, d)
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterday = yesterdayDate.toISOString().split('T')[0]
    return selectedDate !== today && selectedDate !== yesterday
  })()

  // State
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showSummary, setShowSummary] = useState(false)
  const [summaryCommentary, setSummaryCommentary] = useState<string | null>(null)
  const [summaryInsight, setSummaryInsight] = useState<string | null>(null)
  const [summaryPrediction, setSummaryPrediction] = useState<string | null>(null)
  const [isSummaryLoading, setIsSummaryLoading] = useState(false)
  const [selectedGhostEvent, setSelectedGhostEvent] = useState<CalendarEvent | null>(null)
  const [toast, setToast] = useState<string | null>(null) // kept for legacy compat, not shown
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false)
  const [quickLogDragData, setQuickLogDragData] = useState<DragCreateData | null>(null)

  // Soft-delete: track entry IDs pending deletion (hidden from UI, deleted after toast expires)
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set())
  const deleteTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Calendar context for ghost events
  const { getEventsForDate, refreshCalendar, isLoading: isCalendarLoading } = useCalendar()
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncDone, setSyncDone] = useState(false)

  const handleSyncCalendar = async () => {
    setIsSyncing(true)
    setSyncDone(false)
    try {
      await refreshCalendar()
      setSyncDone(true)
      setTimeout(() => setSyncDone(false), 5000)
    } catch (err) {
      console.error('Failed to sync calendar:', err)
    } finally {
      setIsSyncing(false)
    }
  }

  const userId = session?.user?.id || session?.user?.email || ''

  // Fetch entries for this date
  const fetchEntries = useCallback(async () => {
    if (!userId || !selectedDate) return
    setIsLoading(true)

    try {
      const data = await apiFetchEntries({ date: selectedDate, status: 'confirmed', orderBy: 'start_time', orderAsc: true })
      setEntries(data)
    } catch (err) {
      console.error('Failed to fetch entries:', err)
    }
    setIsLoading(false)
  }, [userId, selectedDate])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  // Cleanup pending delete timers on unmount
  useEffect(() => {
    const timers = deleteTimersRef.current
    return () => {
      timers.forEach(timer => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Get period-relevant entries (excluding soft-deleted ones)
  const visibleEntries = entries.filter(e => !pendingDeletes.has(e.id))
  const periodEntries = getEntriesForPeriod(visibleEntries, period)
  const stats = getSessionStats(visibleEntries, period)

  // Get the last entry's end time for QuickLogModal auto-fill
  const lastEntryEndTime = useMemo(() => {
    if (visibleEntries.length === 0) return null
    return visibleEntries.reduce((latest, entry) => {
      if (!entry.end_time) return latest
      if (!latest) return entry.end_time
      return entry.end_time > latest ? entry.end_time : latest
    }, null as string | null)
  }, [visibleEntries])

  // Get period-relevant ghost events from calendar
  const calendarEvents = getEventsForDate(selectedDate).filter((e: CalendarEvent) => {
    if (e.isAllDay || !e.startTime) return false
    const hour = parseInt(e.startTime.split(':')[0])
    const flexRange = getFlexiblePeriodRange(period)
    return hour >= flexRange.start && hour < flexRange.end
  })

  // Filter out events that already have matching entries
  const ghostEvents = calendarEvents.filter((event: CalendarEvent) => {
    return !entries.some(entry => {
      if (!entry.start_time || !entry.end_time) return false
      const entryStart = timeToMinutes(entry.start_time)
      const entryEnd = timeToMinutes(entry.end_time)
      const eventStart = timeToMinutes(event.startTime)
      const eventEnd = timeToMinutes(event.endTime)
      const overlapStart = Math.max(entryStart, eventStart)
      const overlapEnd = Math.min(entryEnd, eventEnd)
      const overlap = Math.max(0, overlapEnd - overlapStart)
      const eventDuration = eventEnd - eventStart
      return eventDuration > 0 && overlap / eventDuration > 0.5
    })
  })


  // Handle "Done with period"
  const handleDone = async () => {
    // Save session completion
    try {
      await upsertSessionCompletion({
        date: selectedDate,
        period,
        entry_count: stats.entryCount,
        total_minutes: stats.totalMinutes,
        skipped: false,
      })
    } catch (err) {
      console.error('Failed to save session completion:', err)
    }

    // Show summary popup
    setShowSummary(true)
    setIsSummaryLoading(true)

    // Fetch AI commentary, insight, and prediction
    try {
      const response = await csrfFetch('/api/period-commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period,
          entries: periodEntries,
          date: selectedDate,
        }),
      })

      if (response.ok) {
        const { commentary, insight, prediction } = await response.json()
        setSummaryCommentary(commentary)
        setSummaryInsight(insight || null)
        setSummaryPrediction(prediction || null)
      }
    } catch (err) {
      console.error('Failed to fetch commentary:', err)
    } finally {
      setIsSummaryLoading(false)
    }
  }

  // Handle "Nothing to log" (skip)
  const handleSkip = async () => {
    try {
      await upsertSessionCompletion({
        date: selectedDate,
        period,
        entry_count: 0,
        total_minutes: 0,
        skipped: true,
      })
    } catch (err) {
      console.error('Failed to save skip:', err)
    }

    goHome()
  }

  // Handle summary close
  const handleSummaryClose = () => {
    setShowSummary(false)
    goHome()
  }

  // Delete entry with undo support
  const handleDeleteEntry = (entryId: string) => {
    const entry = entries.find(e => e.id === entryId)
    const entryName = entry?.activity || 'Entry'

    // Soft-delete: hide from UI immediately
    setPendingDeletes(prev => new Set(prev).add(entryId))

    // Set a timer for the actual deletion
    const timer = setTimeout(async () => {
      try {
        await deleteEntry(entryId)
        await fetchEntries()
      } catch (err) {
        console.error('Failed to delete entry:', err)
      } finally {
        setPendingDeletes(prev => {
          const next = new Set(prev)
          next.delete(entryId)
          return next
        })
        deleteTimersRef.current.delete(entryId)
      }
    }, 5000)

    deleteTimersRef.current.set(entryId, timer)

    // Show toast with undo button
    sonnerToast(`"${entryName}" deleted`, {
      action: {
        label: 'Undo',
        onClick: () => {
          // Cancel the pending deletion
          const pendingTimer = deleteTimersRef.current.get(entryId)
          if (pendingTimer) {
            clearTimeout(pendingTimer)
            deleteTimersRef.current.delete(entryId)
          }
          // Restore the entry in UI
          setPendingDeletes(prev => {
            const next = new Set(prev)
            next.delete(entryId)
            return next
          })
        },
      },
      duration: 5000,
    })
  }

  // Handle drag-to-create from timeline view
  const handleDragCreate = (data: DragCreateData) => {
    // Open QuickLogModal with drag data
    setQuickLogDragData(data)
    setIsQuickLogOpen(true)
  }

  // Handle ghost entry click from timeline
  const handleTimelineGhostClick = (event: CalendarEvent) => {
    setSelectedGhostEvent(event)
  }

  // Redirect if invalid period (after all hooks to satisfy Rules of Hooks)
  useEffect(() => {
    if (!isValidPeriod) {
      router.replace('/')
    }
  }, [isValidPeriod, router])

  // Wait for auth and selectedDate to be set (hydration safety)
  if (!isValidPeriod || status === 'loading' || !selectedDate) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    router.push('/login')
    return null
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Header */}
        <header className="mb-6">
          <button
            onClick={() => goHome()}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${colors.bg}`}>
                <Icon className={`h-6 w-6 ${colors.text}`} />
              </div>
              <div>
                <h1 className="text-xl font-bold">{label} Session</h1>
                <p className="text-sm text-muted-foreground">
                  {getPeriodStartTime(period)} - {getPeriodEndTime(period)}
                  {selectedDate && selectedDate !== getUserToday() && (
                    <> · {isYesterday ? 'Yesterday' : new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
                  )}
                </p>
              </div>
            </div>
            {/* Sync Calendar Button — only for editable days */}
            {!isLocked && (
              <button
                onClick={handleSyncCalendar}
                disabled={isSyncing || syncDone}
                className={`flex items-center gap-1.5 rounded-full px-3 py-2 transition-all duration-300 ${
                  syncDone
                    ? 'bg-green-500/15 border border-green-500/30'
                    : 'bg-secondary hover:bg-accent disabled:opacity-50'
                }`}
                aria-label="Sync calendar"
              >
                {syncDone ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-xs font-medium text-green-500">Synced!</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${isSyncing ? 'animate-spin' : ''}`} />
                    <span className="text-xs font-medium text-muted-foreground">{isSyncing ? 'Syncing...' : 'Sync Calendar'}</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Rollover indicator during 12-3AM */}
          {selectedDate === getUserToday() && getUserToday() !== getRealToday() && (
            <p className="mt-2 text-[11px] text-muted-foreground/60">
              Entries logged after midnight save to {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
          )}

          {/* Session stats */}
          {stats.entryCount > 0 && (
            <div className={`mt-4 rounded-lg ${colors.bg} p-3`}>
              <p className="text-sm">
                <span className="font-medium">{formatSessionDuration(stats.totalMinutes)}</span>
                {' '}logged across{' '}
                <span className="font-medium">{stats.entryCount}</span>
                {' '}{stats.entryCount === 1 ? 'activity' : 'activities'}
              </p>
            </div>
          )}
        </header>

        {/* Session content — Whoop-style cards for locked days, timeline for editable */}
        <section className="mb-6">
          {isLocked ? (
            <ActivityList entries={periodEntries} />
          ) : (
            <>
              <TimelineView
                entries={visibleEntries}
                calendarEvents={calendarEvents}
                isLoading={isLoading}
                onEntryDeleted={fetchEntries}
                onGhostEntryClick={handleTimelineGhostClick}
                onDragCreate={handleDragCreate}
                onShowToast={setToast}
                selectedDate={selectedDate}
                isToday={selectedDate === getUserToday()}
                isFutureDay={false}
                isPastDay={selectedDate !== "" && selectedDate !== getUserToday()}
                canLog={!isLocked}
                visibleStartHour={range.start}
                visibleEndHour={range.end}
              />
              <p className="text-xs text-muted-foreground text-center mt-2">
                Drag to create entries, tap calendar events to confirm
              </p>
            </>
          )}
        </section>

        {/* Action buttons — hidden for locked dates */}
        {!isLocked && (
          <div className="space-y-3">
            <Button
              onClick={handleDone}
              className={`w-full bg-gradient-to-r ${colors.gradient} text-white`}
              size="lg"
            >
              <CheckCircle2 className="h-5 w-5" />
              Done with {label}
            </Button>

            {periodEntries.length === 0 && (
              <button
                onClick={handleSkip}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground py-2"
              >
                Nothing to log for this session
              </button>
            )}
          </div>
        )}

        {isLocked && (
          <div className="rounded-lg bg-secondary/50 border border-border px-4 py-3 text-center">
            <p className="text-sm text-muted-foreground">This day is locked — entries can no longer be edited</p>
          </div>
        )}
      </div>

      {/* Floating Action Button — hidden for locked dates */}
      {!isLocked && (
        <button
          onClick={() => setIsQuickLogOpen(true)}
          className={`fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r ${colors.gradient} shadow-lg active:scale-95 transition-transform`}
          aria-label="Add activity"
        >
          <Plus className="h-6 w-6 text-white" />
        </button>
      )}

      {/* Period Summary Popup */}
      <PeriodSummaryPopup
        isOpen={showSummary}
        onClose={handleSummaryClose}
        period={period}
        entries={periodEntries}
        commentary={summaryCommentary}
        insight={summaryInsight}
        prediction={summaryPrediction}
        isLoading={isSummaryLoading}
        isEvening={period === 'evening'}
        onViewDayReview={() => {
          // TODO: Navigate to day in review
          handleSummaryClose()
        }}
      />

      {/* Quick Log Modal (for timeline drag-create, same as Calendar page) */}
      <QuickLogModal
        isOpen={isQuickLogOpen}
        onClose={() => {
          setIsQuickLogOpen(false)
          setQuickLogDragData(null)
        }}
        onEntryAdded={() => {
          fetchEntries()
          setQuickLogDragData(null)
        }}
        lastEntryEndTime={lastEntryEndTime}
        initialStartTime={quickLogDragData?.startTime}
        initialEndTime={quickLogDragData?.endTime}
        onShowToast={setToast}
        userId={userId}
        calendarEvents={calendarEvents}
        entries={visibleEntries}
        selectedDate={selectedDate}
        isFutureDay={false}
        isPastDay={selectedDate !== "" && selectedDate !== getUserToday()}
        disablePostSubmit={true}
      />

      {/* Ghost Entry Modal (for timeline view) */}
      <GhostEntryModal
        event={selectedGhostEvent}
        onClose={() => setSelectedGhostEvent(null)}
        onConfirm={() => {
          setSelectedGhostEvent(null)
          fetchEntries()
        }}
        onShowToast={setToast}
        userId={userId}
        selectedDate={selectedDate}
      />

      {/* Toast removed — no popups on entry add/confirm */}
    </div>
  )
}