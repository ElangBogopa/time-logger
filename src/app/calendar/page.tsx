'use client'

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { fetchEntries, csrfFetch } from '@/lib/api'
import { getCachedEntries, setCachedEntries } from '@/hooks/useSessionData'
import { TimeEntry, getAggregatedCategory, getLocalDateString, isDateLoggable, VIEWING_PAST_MESSAGE } from '@/lib/types'
import TimelineView, { DragCreateData } from '@/components/TimelineView'
import type { CommittedTask } from '@/components/timeline/TimelineCommitted'
import CommitTimeModal from '@/components/CommitTimeModal'
import { comparePlanToActual, type PlanOutcome } from '@/lib/plan-adherence'
import DayAtAGlance, { blocksForGlance } from '@/components/DayAtAGlance'
import TimeEntryModal from '@/components/TimeEntryModal'
import { AGGREGATED_HEX } from '@/lib/palette'
import { dayWindow, isWholeDay } from '@/lib/day-window'
import { formatDuration, formatTimeDisplay } from '@/lib/time-utils'

/** A row of daily_plans: a task for a date, with a time once you give it one. */
interface PlanTask {
  id: string
  title: string
  date: string
  committed_start: string | null
  committed_end: string | null
  completed: boolean
}
import { useCalendar, CalendarEvent } from '@/contexts/CalendarContext'
import QuickLogModal from '@/components/QuickLogModal'
import Toast from '@/components/Toast'
import GhostEntryModal from '@/components/GhostEntryModal'
import { Button } from '@/components/ui/button'
import CalendarPicker from '@/components/CalendarPicker'
import WeekStrip from '@/components/WeekStrip'
import ErrorBoundary from '@/components/ErrorBoundary'
import { Calendar, ChevronLeft, ChevronRight, ChevronUp, Loader2, RefreshCw, Clock, X, Plus, CalendarClock } from 'lucide-react'
import { Input } from '@/components/ui/input'

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
  // Initialize date eagerly so cache lookups work on first render (no skeleton flash)
  const [selectedDate, setSelectedDate] = useState(() => {
    if (typeof window === 'undefined') return '' // SSR safety
    const dateParam = searchParams.get('date')
    return dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : getLocalDateString()
  })
  const cachedEntries = selectedDate ? getCachedEntries(selectedDate) : null
  const [entries, setEntries] = useState<TimeEntry[]>(cachedEntries ?? [])
  const [isLoading, setIsLoading] = useState(!cachedEntries)
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false)
  const [selectedGhostEvent, setSelectedGhostEvent] = useState<CalendarEvent | null>(null)
  const [toast, setToast] = useState<{ message: string } | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [dragCreateData, setDragCreateData] = useState<DragCreateData | null>(null)
  const [showCalendarPicker, setShowCalendarPicker] = useState(false)
  const [taskFromParam, setTaskFromParam] = useState<string | null>(null)
  const [planIdFromParam, setPlanIdFromParam] = useState<string | null>(null)

  // Read ?task= and ?planId= params (from "View calendar" in commit modal)
  useEffect(() => {
    const taskParam = searchParams.get('task')
    const planIdParam = searchParams.get('planId')
    if (taskParam) {
      setTaskFromParam(taskParam)
      if (planIdParam) setPlanIdFromParam(planIdParam)
      // Clean up URL params but keep state
      window.history.replaceState(null, '', selectedDate ? `/calendar?date=${selectedDate}` : '/calendar')
    }
  }, [searchParams, selectedDate])
  const [committedTasks, setCommittedTasks] = useState<CommittedTask[]>([])
  /** Tasks for this date with no time yet — the tray you plan from. */
  const [unscheduledTasks, setUnscheduledTasks] = useState<PlanTask[]>([])
  const [schedulingTask, setSchedulingTask] = useState<PlanTask | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  /** The grid is the editing surface, not the resting state. */
  const [isGridOpen, setIsGridOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
  const [showWholeDay, setShowWholeDay] = useState(false)
  const [isAddingTask, setIsAddingTask] = useState(false)

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

  /**
   * What became of each plan on this day. Plan and actual already sit on
   * this one grid — this is the comparison between them, so a block that
   * did not survive the day stops looking like one that did.
   */
  const planOutcomes = useMemo(() => {
    const now = new Date()
    const comparisons = comparePlanToActual({
      plans: committedTasks.map((task) => ({
        id: task.id,
        title: task.title,
        completed: task.completed,
        committed_start: task.committed_start,
        committed_end: task.committed_end,
      })),
      entries,
      nowMinutes: isToday ? now.getHours() * 60 + now.getMinutes() : isFutureDay ? 0 : null,
    })
    return Object.fromEntries(comparisons.map((c) => [c.id, c.outcome])) as Record<string, PlanOutcome>
  }, [committedTasks, entries, isToday, isFutureDay])

  /** The day drawn as one band, for the closed state. */
  const glanceBlocks = useMemo(
    () =>
      blocksForGlance({
        entries,
        events: calendarEvents,
        planned: committedTasks.map((t) => ({
          id: t.id,
          committed_start: t.committed_start,
          committed_end: t.committed_end,
        })),
      }),
    [entries, calendarEvents, committedTasks]
  )

  const nowMinutes = useMemo(() => {
    if (!isToday) return null
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes()
  }, [isToday])

  /** Only the hours worth drawing, unless asked for all of them. */
  const gridWindow = useMemo(() => {
    if (showWholeDay) return { startHour: 0, endHour: 24 }
    return dayWindow({
      blocks: glanceBlocks.map((b) => ({ startMinutes: b.startMinutes, endMinutes: b.endMinutes })),
      nowMinutes,
    })
  }, [glanceBlocks, nowMinutes, showWholeDay])

  /**
   * Everything on the day, in order, for the closed state. A band on its own
   * is a shape; this is the shape with names on it, and each row goes to the
   * thing that can change it.
   */
  const dayItems = useMemo(() => {
    type Item = {
      key: string
      start: string
      end: string
      title: string
      colour: string
      kind: 'entry' | 'plan' | 'event'
      onOpen: () => void
    }
    const items: Item[] = []

    for (const entry of entries) {
      if (!entry.start_time) continue
      items.push({
        key: `entry-${entry.id}`,
        start: entry.start_time,
        end: entry.end_time || entry.start_time,
        title: entry.activity,
        colour: AGGREGATED_HEX[entry.category ? getAggregatedCategory(entry.category) : 'escape'],
        kind: 'entry',
        onOpen: () => setEditingEntry(entry),
      })
    }

    for (const task of committedTasks) {
      items.push({
        key: `plan-${task.id}`,
        start: task.committed_start,
        end: task.committed_end,
        title: task.title,
        colour: '#8B7E74',
        kind: 'plan',
        onOpen: () =>
          setSchedulingTask({
            id: task.id,
            title: task.title,
            date: task.date,
            committed_start: task.committed_start,
            committed_end: task.committed_end,
            completed: task.completed,
          }),
      })
    }

    for (const event of calendarEvents) {
      items.push({
        key: `event-${event.id}`,
        start: event.startTime,
        end: event.endTime,
        title: event.title,
        colour: '#8B8680',
        kind: 'event',
        onOpen: () => setSelectedGhostEvent(event),
      })
    }

    return items.sort((a, b) => a.start.localeCompare(b.start))
  }, [entries, committedTasks, calendarEvents])

  const glanceSummary = useMemo(() => {
    const logged = entries.reduce((sum, e) => sum + e.duration_minutes, 0)
    if (isFutureDay) {
      return committedTasks.length > 0
        ? `${committedTasks.length} ${committedTasks.length === 1 ? 'task' : 'tasks'} scheduled`
        : 'Nothing scheduled yet'
    }
    if (entries.length === 0) return 'Nothing logged yet'
    return `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} · ${formatDuration(logged)}`
  }, [entries, committedTasks, isFutureDay])

  // Check if logging is allowed for the selected date
  const canLog = isDateLoggable(selectedDate)

  /** Give a task a time. The grid draws it as soon as it has one. */
  const handleCommitTask = async (planId: string, start: string, end: string) => {
    await csrfFetch('/api/plans', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: planId, committed_start: start, committed_end: end }),
    })
    setSchedulingTask(null)
    fetchEntriesForDate()
  }

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault()
    const title = newTaskTitle.trim()
    if (!title || isAddingTask) return
    setIsAddingTask(true)
    try {
      await csrfFetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, title }),
      })
      setNewTaskTitle('')
      fetchEntriesForDate()
    } catch (err) {
      console.error('Failed to add task:', err)
    } finally {
      setIsAddingTask(false)
    }
  }

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

    // Use cache for instant render, then revalidate
    const cached = getCachedEntries(selectedDate)
    if (cached) {
      setEntries(cached)
      setIsLoading(false)
    } else {
      setIsLoading(true)
    }

    try {
      const [data, plansRes] = await Promise.all([
        fetchEntries({ date: selectedDate }),
        fetch(`/api/plans?date=${selectedDate}`),
      ])
      setEntries(data)
      setCachedEntries(selectedDate, data)

      // A task either has a time, and belongs on the grid, or it does not
      // yet, and belongs in the tray waiting to be given one.
      if (plansRes.ok) {
        const { plans } = await plansRes.json()
        const all: PlanTask[] = plans || []
        setCommittedTasks(
          all
            .filter((p) => p.committed_start && p.committed_end)
            .map((p) => ({
              id: p.id,
              title: p.title,
              date: p.date,
              committed_start: p.committed_start,
              committed_end: p.committed_end,
              completed: p.completed,
            })) as CommittedTask[]
        )
        setUnscheduledTasks(all.filter((p) => !p.committed_start || !p.committed_end))
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
              {/* The screen has two jobs, and says which one it is doing:
                  a future date is a plan, today and the past are a record. */}
              <h1 className="page-title text-foreground flex items-center gap-2">
                {isFutureDay ? <CalendarClock className="h-5 w-5" /> : <Calendar className="h-5 w-5" />}
                {isFutureDay ? `Plan ${dateDisplay.label}` : 'Calendar'}
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
            <div className={`flex items-center ${taskFromParam ? 'justify-center' : 'justify-between'}`}>
              {!taskFromParam && (
                <button
                  onClick={handlePrevDay}
                  className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  aria-label="Previous day"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}

              {taskFromParam ? (
                <div className="flex flex-col items-center px-4 py-1">
                  <span className="text-lg font-semibold">{dateDisplay.label}</span>
                  <span className="text-sm text-muted-foreground">{dateDisplay.date}</span>
                </div>
              ) : (
                <button
                  onClick={() => setShowCalendarPicker(!showCalendarPicker)}
                  className="flex flex-col items-center px-4 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <span className="text-lg font-semibold">{dateDisplay.label}</span>
                  <span className="text-sm text-muted-foreground">{dateDisplay.date}</span>
                </button>
              )}

              {!taskFromParam && (
                <button
                  onClick={handleNextDay}
                  className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  aria-label="Next day"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
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

          {/* Week Strip — hidden when planning a specific task (date already set) */}
          {!taskFromParam && (
            <div className="mb-4">
              <WeekStrip
                selectedDate={selectedDate}
                onDateSelect={handleDateChange}
                datesWithEntries={entries.map(e => e.date)}
              />
            </div>
          )}

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
            <div className="mb-3 space-y-2">
              <div className="flex items-center justify-between rounded-xl border border-[#8B7E74]/30 bg-[#8B7E74]/10 px-4 py-2.5">
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
              <button
                onClick={() => router.back()}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to tasks
              </button>
            </div>
          )}

          {/* The tray: tasks for this day with no time yet. Tapping one
              gives it a time and it moves onto the grid. Until now the only
              way to do that was a modal inside a goal's page, and the result
              landed on a calendar reachable only from Settings. */}
          {!isPastDay && (
            <section className="mb-4 rounded-xl border border-border bg-card p-4">
              <h2 className="eyebrow mb-3">
                {isFutureDay ? 'What matters tomorrow' : 'To schedule'}
              </h2>

              {unscheduledTasks.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {unscheduledTasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => setSchedulingTask(task)}
                      className="flex items-center gap-1.5 rounded-full border border-dashed border-border bg-secondary/50 px-3 py-1.5 text-sm text-foreground transition-all duration-150 hover:border-foreground/25 active:scale-[0.98]"
                    >
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {task.title}
                    </button>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddTask} className="flex gap-2">
                <Input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder={isFutureDay ? 'Add something for tomorrow' : 'Add a task for today'}
                  className="flex-1"
                />
                <Button type="submit" variant="outline" size="icon" disabled={!newTaskTitle.trim() || isAddingTask}>
                  {isAddingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </form>

              {unscheduledTasks.length === 0 && committedTasks.length > 0 && (
                <p className="text-xs text-muted-foreground mt-3">
                  Everything planned for this day has a time.
                </p>
              )}
            </section>
          )}

          {/* Closed by default: the day as a band, with the grid a tap away.
              The grid was always open, 1080px of mostly empty night in a
              500px window, whether or not anything was being edited. */}
          {!isGridOpen ? (
            <section>
              <DayAtAGlance
                blocks={glanceBlocks}
                summary={glanceSummary}
                nowMinutes={nowMinutes}
                onOpen={() => setIsGridOpen(true)}
              />

              {dayItems.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {dayItems.map((item) => (
                    <button
                      key={item.key}
                      onClick={item.onOpen}
                      className="w-full flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-all duration-150 hover:border-foreground/25 active:scale-[0.995]"
                    >
                      <span
                        className="h-8 w-1 shrink-0 rounded-full"
                        style={{
                          backgroundColor: item.kind === 'entry' ? item.colour : 'transparent',
                          border: item.kind === 'entry' ? undefined : `1px dashed ${item.colour}`,
                        }}
                      />
                      <span className="text-[11px] tabular-nums text-muted-foreground w-[92px] shrink-0">
                        {formatTimeDisplay(item.start)}
                      </span>
                      <span className="flex-1 min-w-0 truncate text-sm text-foreground">{item.title}</span>
                      {item.kind !== 'entry' && (
                        <span className="field-label shrink-0">
                          {item.kind === 'plan' ? 'planned' : 'calendar'}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </section>
          ) : (
          <section>
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setShowWholeDay((v) => !v)}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {showWholeDay || isWholeDay(gridWindow)
                  ? `Showing all 24 hours`
                  : `Showing ${gridWindow.startHour}:00–${gridWindow.endHour}:00 · show the whole day`}
              </button>
              <button
                onClick={() => setIsGridOpen(false)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Close
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
            </div>
            <TimelineView
              key={refreshKey}
              entries={entries}
              calendarEvents={calendarEvents}
              committedTasks={committedTasks}
              planOutcomes={planOutcomes}
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
              visibleStartHour={gridWindow.startHour}
              visibleEndHour={gridWindow.endHour}
            />
          </section>
          )}
        </div>

        {schedulingTask && (
          <CommitTimeModal
            isOpen={true}
            onClose={() => setSchedulingTask(null)}
            onCommit={(start, end) => handleCommitTask(schedulingTask.id, start, end)}
            taskTitle={schedulingTask.title}
            date={selectedDate}
            planId={schedulingTask.id}
            existingStart={schedulingTask.committed_start}
            existingEnd={schedulingTask.committed_end}
          />
        )}

        {editingEntry && (
          <TimeEntryModal
            entry={editingEntry}
            onClose={() => setEditingEntry(null)}
            onUpdate={() => {
              setEditingEntry(null)
              fetchEntriesForDate()
            }}
            onDelete={() => {
              setEditingEntry(null)
              fetchEntriesForDate()
            }}
          />
        )}

        <QuickLogModal
          isOpen={isQuickLogOpen}
          onClose={() => {
            setIsQuickLogOpen(false)
            setDragCreateData(null)
          }}
          onEntryAdded={() => {
            fetchEntriesForDate()
            // If this entry was created from a goal task, update the plan's committed times
            if (planIdFromParam && dragCreateData) {
              csrfFetch('/api/plans', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: planIdFromParam,
                  committed_start: dragCreateData.startTime,
                  committed_end: dragCreateData.endTime,
                }),
              }).catch(err => console.error('Failed to update plan committed times:', err))
              setPlanIdFromParam(null) // Only update once
            }
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
