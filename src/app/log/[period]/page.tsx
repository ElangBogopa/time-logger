'use client'

import { Suspense, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { fetchEntries as apiFetchEntries, deleteEntry, upsertSessionCompletion, csrfFetch, createEntries, categorizeActivities } from '@/lib/api'
import { findRepeatCandidate, entriesForRepeat, type RepeatCandidate } from '@/lib/repeat-session'
import { PERIOD_CLASSES } from '@/lib/palette'
import { findUnaccountedGaps } from '@/lib/gaps'
import { unconfirmedEvents } from '@/lib/calendar-match'
import NextUp from '@/components/NextUp'
import { getCachedEntries, setCachedEntries } from '@/hooks/useSessionData'
import { TimePeriod, TimeEntry, PERIOD_LABELS, PERIOD_TIME_RANGES, getUserToday, getRealToday, getUserCurrentHour, shiftDateString } from '@/lib/types'
import {
  getEntriesForPeriod,
  getSessionStats,
  formatSessionDuration,
  getPeriodStartTime,
  getPeriodEndTime,
  getFlexiblePeriodRange,
  getYesterdayDateString,
} from '@/lib/session-utils'
import { timeToMinutes, formatTimeDisplay } from '@/lib/time-utils'
import { useCalendar, CalendarEvent } from '@/contexts/CalendarContext'
import PeriodSummaryPopup from '@/components/PeriodSummaryPopup'
import TimeEntryModal from '@/components/TimeEntryModal'
import ActivityList from '@/components/ActivityList'
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
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDashed,
  CalendarCheck,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'
import { toast as sonnerToast } from 'sonner'

const PERIOD_ICONS: Record<TimePeriod, typeof Sun> = {
  morning: Sun,
  afternoon: Cloud,
  evening: Moon,
}

const PERIOD_COLORS: Record<TimePeriod, { text: string; bg: string }> = {
  morning: { text: PERIOD_CLASSES.morning.icon, bg: PERIOD_CLASSES.morning.tint },
  afternoon: { text: PERIOD_CLASSES.afternoon.icon, bg: PERIOD_CLASSES.afternoon.tint },
  evening: { text: PERIOD_CLASSES.evening.icon, bg: PERIOD_CLASSES.evening.tint },
}

function LogPeriodContent() {
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
  // Initialize eagerly so cache lookup works on first render (no skeleton flash)
  const dateParam = searchParams.get('date')
  const isYesterday = dateParam === 'yesterday'
  const [selectedDate, setSelectedDate] = useState(() => {
    if (typeof window === 'undefined') return '' // SSR safety
    if (isYesterday) return getYesterdayDateString()
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return dateParam
    return getUserToday()
  })

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
    const yesterday = shiftDateString(today, -1)
    return selectedDate !== today && selectedDate !== yesterday
  })()

  // A session that has not begun cannot be finished. At 5:35pm the evening
  // could be closed: "Evening Complete · 0m · Great evening! You stayed on
  // track", a green tick on the dashboard, and an offer of a day review that
  // was still locked.
  const isClockToday = selectedDate === getUserToday() && getUserToday() === getRealToday()
  const hasStarted = !isClockToday || getUserCurrentHour() >= range.start
  // The day review opens at 9pm on the day itself, and is open for any day after.
  const isReviewOpen = !isClockToday || getUserCurrentHour() >= 21

  // State — initialize from shared cache if available (instant render, no skeleton flash)
  const cachedEntries = selectedDate ? getCachedEntries(selectedDate) : null
  const [entries, setEntries] = useState<TimeEntry[]>(cachedEntries ?? [])
  const [isLoading, setIsLoading] = useState(!cachedEntries)
  const [showSummary, setShowSummary] = useState(false)
  const [summaryCommentary, setSummaryCommentary] = useState<string | null>(null)
  const [isSummaryLoading, setIsSummaryLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null) // kept for legacy compat, not shown
  const [repeatCandidate, setRepeatCandidate] = useState<RepeatCandidate | null>(null)
  const [isRepeating, setIsRepeating] = useState(false)
  // 'all', or the id of the one event being confirmed
  const [confirming, setConfirming] = useState<string | null>(null)
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false)
  /** The time range a gap row hands to the quick-log sheet. */
  const [quickLogRange, setQuickLogRange] = useState<{ startTime: string; endTime: string } | null>(null)

  // Soft-delete: track entry IDs pending deletion (hidden from UI, deleted after toast expires)
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set())
  const deleteTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Calendar context for ghost events
  const { getEventsForDate, refreshCalendar } = useCalendar()
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

  // Fetch entries for this date — uses cache for instant render, then revalidates
  const fetchEntries = useCallback(async () => {
    if (!userId || !selectedDate) return

    // Show cached data instantly if available (no loading skeleton)
    const cached = getCachedEntries(selectedDate)
    if (cached) {
      setEntries(cached)
      setIsLoading(false)
    } else {
      setIsLoading(true)
    }

    try {
      const data = await apiFetchEntries({ date: selectedDate, status: 'confirmed', orderBy: 'start_time', orderAsc: true })
      setEntries(data)
      setCachedEntries(selectedDate, data)
    } catch (err) {
      console.error('Failed to fetch entries:', err)
    }
    setIsLoading(false)
  }, [userId, selectedDate])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  // A session with nothing in it can usually be copied from a recent day:
  // most days have the same shape. Only looked up while the session is
  // empty, and only from entries already stored, so it costs one request and
  // no model calls.
  const hasEntriesForPeriod = getEntriesForPeriod(entries, period).length > 0
  useEffect(() => {
    if (isLocked || !userId || !selectedDate || hasEntriesForPeriod) {
      setRepeatCandidate(null)
      return
    }
    let cancelled = false
    apiFetchEntries({
      dateFrom: shiftDateString(selectedDate, -14),
      dateTo: shiftDateString(selectedDate, -1),
      status: 'confirmed',
    })
      .then((recent) => {
        if (!cancelled) setRepeatCandidate(findRepeatCandidate(recent, safePeriod, selectedDate))
      })
      .catch(() => {
        if (!cancelled) setRepeatCandidate(null)
      })
    return () => {
      cancelled = true
    }
  }, [userId, selectedDate, safePeriod, isLocked, hasEntriesForPeriod])

  const handleRepeatSession = async () => {
    if (!repeatCandidate || isRepeating) return
    setIsRepeating(true)
    try {
      const created = await createEntries(entriesForRepeat(repeatCandidate, selectedDate))
      await fetchEntries()
      sonnerToast.success(
        `Logged ${created.length} ${created.length === 1 ? 'activity' : 'activities'} from ${repeatCandidate.label}`
      )
    } catch (err) {
      console.error('Failed to repeat session:', err)
      sonnerToast.error('Could not copy that session')
    } finally {
      setIsRepeating(false)
    }
  }

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

  // Events nothing has answered yet (see lib/calendar-match.ts)
  const ghostEvents = unconfirmedEvents(calendarEvents, entries)

  // A meeting that has not finished cannot be confirmed: confirming
  // categorises it and counts it towards the day, and it has not happened.
  const hasEnded = (event: CalendarEvent) => {
    if (selectedDate !== getUserToday()) return true
    // Past midnight the app's "today" is still yesterday, and all of it is over.
    if (getUserToday() !== getRealToday()) return true
    return timeToMinutes(event.endTime) <= getUserCurrentHour() * 60 + new Date().getMinutes()
  }
  const confirmableGhosts = ghostEvents.filter(hasEnded)

  /**
   * Confirm every calendar event in this session at once.
   *
   * One categorise call for the lot and one insert, where confirming them
   * one at a time was two model calls and four requests each. No per-entry
   * commentary: a bulk confirm would generate a remark for each, which is
   * both expensive and noise — the session and day commentary still cover
   * them.
   */
  const confirmGhosts = async (events: CalendarEvent[], marker: string) => {
    if (events.length === 0 || confirming) return
    setConfirming(marker)
    try {
      const titles = events.map((event) => event.title)
      const categories = await categorizeActivities(titles).catch(() => [])

      const created = await createEntries(
        events.map((event, i) => ({
          date: selectedDate,
          activity: event.title,
          category: categories[i] ?? null,
          duration_minutes: Math.max(
            5,
            timeToMinutes(event.endTime) - timeToMinutes(event.startTime)
          ),
          start_time: event.startTime,
          end_time: event.endTime,
        }))
      )

      await fetchEntries()
      sonnerToast.success(`Confirmed ${created.length} calendar ${created.length === 1 ? 'event' : 'events'}`)
    } catch (err) {
      console.error('Failed to confirm calendar events:', err)
      sonnerToast.error('Could not confirm those events')
    } finally {
      setConfirming(null)
    }
  }

  /**
   * The stretches of this session with nothing in them. Answering a row is
   * one tap; the alternative is the hold-and-drag gesture on the timeline,
   * which needs five conditions to line up (see lib/gaps.ts).
   */
  const gaps = useMemo(() => {
    if (isLocked || !selectedDate) return []
    const isToday = selectedDate === getUserToday()
    const currentHour = getUserCurrentHour()
    return findUnaccountedGaps({
      entries: periodEntries,
      events: calendarEvents,
      periodStart: range.start,
      periodEnd: range.end,
      // On today, never ask about time that has not happened yet.
      nowMinutes: isToday ? currentHour * 60 + new Date().getMinutes() : null,
    })
  }, [isLocked, selectedDate, periodEntries, calendarEvents, range.start, range.end])

  const handleFillGap = (startTime: string, endTime: string) => {
    setQuickLogRange({ startTime, endTime })
    setIsQuickLogOpen(true)
  }

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

    // Fetch the session commentary
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
        const { commentary } = await response.json()
        setSummaryCommentary(commentary)
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
    <div className="min-h-screen bg-background pb-40">
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
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                  syncDone
                    ? 'bg-[#7D9B8A]/15 border border-[#7D9B8A]/30'
                    : 'bg-secondary hover:bg-accent disabled:opacity-50'
                }`}
                aria-label={syncDone ? 'Calendar synced' : isSyncing ? 'Syncing calendar' : 'Sync calendar'}
                title="Sync calendar"
              >
                {/* An icon, not a labelled pill: at phone width the pill's
                    two words wrapped and pushed the session title onto two
                    lines as well. */}
                {syncDone ? (
                  <CheckCircle2 className="h-4 w-4 text-[#7D9B8A]" />
                ) : (
                  <RefreshCw className={`h-4 w-4 text-muted-foreground ${isSyncing ? 'animate-spin' : ''}`} />
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

        {/* One tap to re-log a day that looked the same */}
        {!isLocked && hasStarted && repeatCandidate && (
          <section className="mb-4 rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="eyebrow mb-1">Same as {repeatCandidate.label}</h2>
                <p className="text-sm text-muted-foreground">
                  {repeatCandidate.entries.map((entry) => entry.activity).join(' · ')}
                </p>
              </div>
              <RotateCcw className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleRepeatSession}
              disabled={isRepeating}
            >
              {isRepeating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Log {repeatCandidate.entries.length}{' '}
                  {repeatCandidate.entries.length === 1 ? 'activity' : 'activities'} again ·{' '}
                  {formatSessionDuration(repeatCandidate.totalMinutes)}
                </>
              )}
            </Button>
          </section>
        )}

        {/* Calendar events nothing has answered yet. This row used to appear
            only for two or more, so a session with a single meeting — the
            usual case — showed no sign of it except a gap that began at an
            unexplained hour. */}
        {!isLocked && ghostEvents.length > 0 && (
          <section className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="eyebrow">From your calendar</h2>
              {confirmableGhosts.length > 1 && (
                <button
                  onClick={() => confirmGhosts(confirmableGhosts, 'all')}
                  disabled={confirming !== null}
                  className="flex min-h-9 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {confirming === 'all' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Confirm all {confirmableGhosts.length}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {ghostEvents.map((event) => {
                const ended = hasEnded(event)
                return (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-4 py-3"
                  >
                    <CalendarCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatTimeDisplay(event.startTime)} – {formatTimeDisplay(event.endTime)}
                      </p>
                    </div>
                    {ended ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => confirmGhosts([event], event.id)}
                        disabled={confirming !== null}
                        aria-label={`Confirm ${event.title}`}
                      >
                        {confirming === event.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="h-4 w-4" />
                            Confirm
                          </>
                        )}
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground shrink-0">Upcoming</span>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* What was planned for this session. The session knew about the
            plan only in the popup after "Done"; at 6pm it offered "Same as
            yesterday" and said nothing of the run planned for six. */}
        {!isLocked && selectedDate && (
          <NextUp date={selectedDate} entries={entries} period={period} onChanged={fetchEntries} />
        )}

        {/* Unaccounted time — one tap each */}
        {gaps.length > 0 && (
          <section className="mb-4">
            <h2 className="eyebrow mb-2">Unaccounted</h2>
            <div className="space-y-2">
              {gaps.map((gap) => (
                <button
                  key={gap.startTime}
                  onClick={() => handleFillGap(gap.startTime, gap.endTime)}
                  className="w-full flex items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-4 py-3 text-left transition-all duration-150 hover:border-foreground/25 hover:bg-card active:scale-[0.99]"
                >
                  <CircleDashed className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {formatTimeDisplay(gap.startTime)} – {formatTimeDisplay(gap.endTime)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatSessionDuration(gap.durationMinutes)} unaccounted
                    </p>
                  </div>
                  <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* What the session holds. This was the drag timeline, which is a
            canvas: hold still, hold again, do not move, now drag. Capture
            wants a list and one tap, so the canvas moved to /calendar and
            kept the jobs it is good at — ghosts, precise times, planning
            ahead. */}
        <section className="mb-6">
          {isLoading && periodEntries.length === 0 ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[66px] rounded-xl border border-border bg-card animate-pulse" />
              ))}
            </div>
          ) : (
            <ActivityList
              entries={periodEntries}
              onEntryClick={isLocked ? undefined : setEditingEntry}
              emptyMessage={
                isLocked
                  ? 'No activities logged for this session'
                  : 'Nothing logged yet. Add the first thing you did.'
              }
            />
          )}
          {!isLocked && (
            <button
              onClick={() => router.push(`/calendar?date=${selectedDate}`)}
              className="mt-3 flex w-full items-center justify-center gap-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Open the calendar to drag, resize or plan ahead
            </button>
          )}
        </section>

        {/* Action buttons — hidden for locked dates, and until the session
            has begun. "Done" needs something to be done with: an empty
            session has one honest action, which is to say it was empty. */}
        {!isLocked && !hasStarted && (
          <p className="rounded-lg bg-secondary/50 border border-border px-4 py-3 text-center text-sm text-muted-foreground">
            {label} starts at {formatTimeDisplay(`${String(range.start).padStart(2, '0')}:00`)}. You can
            wrap it up once it has begun.
          </p>
        )}

        {!isLocked && hasStarted && (
          <div className="space-y-3">
            {periodEntries.length > 0 ? (
              <Button
                onClick={handleDone}
                className="w-full"
                size="lg"
              >
                <CheckCircle2 className="h-5 w-5" />
                Done with {label}
              </Button>
            ) : (
              <Button onClick={handleSkip} variant="outline" className="w-full" size="lg">
                Nothing to log for this session
              </Button>
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
          className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform"
          aria-label="Add activity"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Period Summary Popup */}
      <PeriodSummaryPopup
        isOpen={showSummary}
        onClose={handleSummaryClose}
        period={period}
        date={selectedDate}
        entries={periodEntries}
        commentary={summaryCommentary}
        isLoading={isSummaryLoading}
        isEvening={period === 'evening' && isReviewOpen}
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
          setQuickLogRange(null)
        }}
        onEntryAdded={() => {
          fetchEntries()
          setQuickLogRange(null)
        }}
        lastEntryEndTime={lastEntryEndTime}
        initialStartTime={quickLogRange?.startTime}
        initialEndTime={quickLogRange?.endTime}
        onShowToast={setToast}
        userId={userId}
        calendarEvents={calendarEvents}
        entries={visibleEntries}
        selectedDate={selectedDate}
        isFutureDay={false}
        isPastDay={selectedDate !== "" && selectedDate !== getUserToday()}
        disablePostSubmit={true}
      />

      {/* Editing one activity — the timeline used to own this modal */}
      {editingEntry && (
        <TimeEntryModal
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onUpdate={() => {
            setEditingEntry(null)
            fetchEntries()
          }}
          onDelete={() => {
            setEditingEntry(null)
            fetchEntries()
          }}
        />
      )}

      {/* The per-ghost confirm modal went with the timeline: in this view
          calendar events are confirmed as a set, and one at a time on the
          calendar itself. */}

      {/* Toast removed — no popups on entry add/confirm */}
    </div>
  )
}

export default function LogPeriodPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    }>
      <LogPeriodContent />
    </Suspense>
  )
}