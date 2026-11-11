'use client'

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { fetchEntries, csrfFetch } from '@/lib/api'
import { unconfirmedEvents } from '@/lib/calendar-match'
import { getCachedEntries, setCachedEntries } from '@/hooks/useSessionData'
import { TimeEntry, getAggregatedCategory, getLocalDateString, shiftDateString, isDateLoggable, VIEWING_PAST_MESSAGE } from '@/lib/types'
import TimelineView, { DragCreateData } from '@/components/TimelineView'
import type { CommittedTask } from '@/components/timeline/TimelineCommitted'
import CommitTimeModal from '@/components/CommitTimeModal'
import SourceSheet from '@/components/SourceSheet'
import { comparePlanToActual, type PlanOutcome } from '@/lib/plan-adherence'
import DayAtAGlance, { blocksForGlance } from '@/components/DayAtAGlance'
import TimeEntryModal from '@/components/TimeEntryModal'
import { AGGREGATED_HEX, METRIC_TEXT_HEX } from '@/lib/palette'
import { dayWindow, isWholeDay } from '@/lib/day-window'
import { suggestTimes, rankSlots, defaultDuration, type Suggestion, type Busy } from '@/lib/suggest-times'
import { usualFor, usualWakeMinutes, recurringActivities } from '@/lib/habits'
import { useHabitHistory } from '@/hooks/useHabitHistory'
import { calcBody, calcFocus, calcSocial, type EntryRow } from '@/lib/metrics-calc'
import type { TimeCategory } from '@/lib/types'
import { categorizeActivities } from '@/lib/api'
import { formatDuration, formatTimeDisplay, timeToMinutes, minutesToTime } from '@/lib/time-utils'

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
import { Calendar, ChevronLeft, ChevronRight, ChevronUp, Loader2, RefreshCw, Clock, X, Plus, CalendarClock, Sparkles } from 'lucide-react'
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
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  /** The library entry behind the suggestion whose "why?" was tapped. */
  const [whySource, setWhySource] = useState<string | null>(null)
  const [unplaced, setUnplaced] = useState<{ title: string; reason: string }[]>([])
  const [isSuggesting, setIsSuggesting] = useState(false)
  /**
   * What the categoriser said each task is, by task id. Plans are stored
   * without a category, so this is kept for the session: it is what lets a
   * proposal be drawn in its colour and the plan be scored before it is lived.
   */
  const [taskCategories, setTaskCategories] = useState<Record<string, TimeCategory | null>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      return JSON.parse(sessionStorage.getItem('plan-task-categories') || '{}')
    } catch {
      return {}
    }
  })
  const rememberCategories = useCallback((found: Record<string, TimeCategory | null>) => {
    setTaskCategories((current) => {
      const next = { ...current, ...found }
      try {
        sessionStorage.setItem('plan-task-categories', JSON.stringify(next))
      } catch {
        /* storage is a convenience */
      }
      return next
    })
  }, [])

  // The last four weeks of the log: where "your usual hour" comes from.
  const history = useHabitHistory(status === 'authenticated')

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
      }).concat(
        // Proposals, drawn on the day before they are accepted, each in the
        // colour of the ring it would feed — so the shape of the day being
        // offered can be seen, not just read as a list of times.
        (suggestions ?? []).map((s) => {
          const category = taskCategories[s.taskId]
          return {
            id: `proposed-${s.taskId}`,
            startMinutes: s.startMinutes,
            endMinutes: s.endMinutes,
            colour: category ? AGGREGATED_HEX[getAggregatedCategory(category)] : '#8B7E74',
            outlined: true,
            proposed: true,
          }
        })
      ),
    [entries, calendarEvents, committedTasks, suggestions, taskCategories]
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

    // A confirmed meeting is already in the list as its entry; listing the
    // calendar's copy beside it showed the same hour twice.
    for (const event of unconfirmedEvents(calendarEvents, entries)) {
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
    // While proposals are drawn on the band, say what they are: it read
    // "Nothing scheduled yet" above three blocks.
    if (suggestions && suggestions.length > 0) {
      return `${suggestions.length} proposed · not saved until you accept`
    }
    if (isFutureDay) {
      return committedTasks.length > 0
        ? `${committedTasks.length} ${committedTasks.length === 1 ? 'task' : 'tasks'} scheduled`
        : 'Nothing scheduled yet'
    }
    if (entries.length === 0) return 'Nothing logged yet'
    return `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} · ${formatDuration(logged)}`
  }, [entries, committedTasks, isFutureDay, suggestions])

  /**
   * Fit the untimed tasks around everything already in the day.
   *
   * The categoriser decides what kind of thing each task is — one batched
   * call for the whole tray — and lib/suggest-times.ts does the placing,
   * never over a calendar event and never without a reason.
   */
  /** Everything already in the day: logged, on the calendar, or planned. */
  const busyBlocks = useMemo<Busy[]>(
    () => [
      ...entries
        .filter((e) => e.start_time)
        .map((e) => ({
          startMinutes: timeToMinutes(e.start_time!),
          endMinutes: e.end_time
            ? timeToMinutes(e.end_time)
            : timeToMinutes(e.start_time!) + e.duration_minutes,
        })),
      ...calendarEvents.map((e) => ({
        startMinutes: timeToMinutes(e.startTime),
        endMinutes: timeToMinutes(e.endTime),
      })),
      ...committedTasks.map((t) => ({
        startMinutes: timeToMinutes(t.committed_start),
        endMinutes: timeToMinutes(t.committed_end),
      })),
    ],
    [entries, calendarEvents, committedTasks]
  )

  /**
   * The day starts when you do. Half an hour after you usually get up, and
   * never before five; six, as before, until the log has a few mornings in it.
   */
  const earliestMinutes = useMemo(() => {
    const wake = usualWakeMinutes(history)
    return wake === null ? 6 * 60 : Math.max(5 * 60, wake + 30)
  }, [history])
  const searchFrom = Math.max(earliestMinutes, nowMinutes ?? earliestMinutes)

  const handleSuggestTimes = async () => {
    if (unscheduledTasks.length === 0 || isSuggesting) return
    setIsSuggesting(true)
    try {
      // One model call for everything not yet categorised this session —
      // the tasks to place, and the ones already placed, so the whole plan
      // can be scored.
      const unknown = [...unscheduledTasks, ...committedTasks].filter((t) => !(t.id in taskCategories))
      const found: Record<string, TimeCategory | null> = {}
      if (unknown.length > 0) {
        const categories = await categorizeActivities(unknown.map((t) => t.title)).catch(() => [])
        unknown.forEach((task, i) => {
          found[task.id] = categories[i] ?? null
        })
        rememberCategories(found)
      }
      const categoryOf = (id: string) => found[id] ?? taskCategories[id] ?? null

      const result = suggestTimes({
        tasks: unscheduledTasks.map((task) => {
          const category = categoryOf(task.id)
          const usual = usualFor(task.title, category, history)
          return {
            id: task.id,
            title: task.title,
            category,
            // Your own length and hour for this, where the log has them.
            durationMinutes: usual?.durationMinutes,
            usualStartMinutes: usual?.startMinutes ?? null,
          }
        }),
        busy: busyBlocks,
        nowMinutes,
        earliestMinutes,
      })

      setSuggestions(result.suggestions)
      setUnplaced(result.unplaced.map((u) => ({ title: u.title, reason: u.reason })))
    } catch (err) {
      console.error('Failed to suggest times:', err)
    } finally {
      setIsSuggesting(false)
    }
  }

  /** Everything a suggestion must stay clear of: the day, and the other suggestions. */
  const takenAround = (taskId: string): Busy[] => [
    ...busyBlocks,
    ...(suggestions ?? [])
      .filter((s) => s.taskId !== taskId)
      .map((s) => ({ startMinutes: s.startMinutes, endMinutes: s.endMinutes })),
  ]

  const slotsFor = (suggestion: Suggestion, duration: number) => {
    const task = unscheduledTasks.find((t) => t.id === suggestion.taskId)
    const category = taskCategories[suggestion.taskId] ?? null
    const usual = task ? usualFor(task.title, category, history) : null
    return rankSlots({
      duration,
      category,
      usualStartMinutes: usual?.startMinutes ?? null,
      taken: takenAround(suggestion.taskId),
      from: searchFrom,
    })
  }

  const replaceSuggestion = (taskId: string, next: Partial<Suggestion>) =>
    setSuggestions((current) =>
      (current ?? [])
        .map((s) => (s.taskId === taskId ? { ...s, ...next } : s))
        .sort((a, b) => a.startMinutes - b.startMinutes)
    )

  const placeAt = (start: number, duration: number) => ({
    startMinutes: start,
    endMinutes: start + duration,
    startTime: minutesToTime(start),
    endTime: minutesToTime(start + duration),
    durationMinutes: duration,
  })

  /**
   * Where the time sheet opens for a task with no time yet: your usual hour
   * and length for it, or the best free place the research offers. It
   * opened on 9–10am for everything, meetings or no meetings.
   */
  const sheetDefaults = (task: PlanTask): { defaultStart?: string; defaultEnd?: string } => {
    if (task.committed_start) return {}
    const category = taskCategories[task.id] ?? null
    const usual = usualFor(task.title, category, history)
    const duration = usual?.durationMinutes ?? defaultDuration(category)
    const slot = rankSlots({
      duration,
      category,
      usualStartMinutes: usual?.startMinutes ?? null,
      taken: busyBlocks,
      from: searchFrom,
      limit: 1,
    })[0]
    if (!slot) return {}
    return { defaultStart: minutesToTime(slot.start), defaultEnd: minutesToTime(slot.start + duration) }
  }

  /** "Another time": step to the next-best place this could go. */
  const offerAnotherTime = (suggestion: Suggestion) => {
    const slots = slotsFor(suggestion, suggestion.durationMinutes)
    const others = slots.filter((slot) => slot.start !== suggestion.startMinutes)
    if (others.length === 0) {
      showToast('There is no other free time for that today')
      return
    }
    // Step through in ranked order, coming back round to the best.
    const index = slots.findIndex((slot) => slot.start === suggestion.startMinutes)
    const next = slots[(index + 1) % slots.length] ?? others[0]
    const slot = next.start === suggestion.startMinutes ? others[0] : next
    replaceSuggestion(suggestion.taskId, {
      ...placeAt(slot.start, suggestion.durationMinutes),
      reason: slot.reason,
      source: slot.source,
      basis: slot.basis,
    })
  }

  /** Change how long a suggestion is, moving it only if it no longer fits. */
  const resizeSuggestion = (suggestion: Suggestion, duration: number) => {
    const taken = takenAround(suggestion.taskId)
    const end = suggestion.startMinutes + duration
    const fits = end <= 22 * 60 && !taken.some((b) => suggestion.startMinutes < b.endMinutes && end > b.startMinutes)
    if (fits) {
      replaceSuggestion(suggestion.taskId, placeAt(suggestion.startMinutes, duration))
      return
    }
    const slot = slotsFor(suggestion, duration)[0]
    if (!slot) {
      showToast('There is no room for that length today')
      return
    }
    replaceSuggestion(suggestion.taskId, {
      ...placeAt(slot.start, duration),
      reason: slot.reason,
      source: slot.source,
      basis: slot.basis,
    })
  }

  const acceptSuggestion = async (suggestion: Suggestion) => {
    await handleCommitTask(suggestion.taskId, suggestion.startTime, suggestion.endTime)
    setSuggestions((current) => current?.filter((s) => s.taskId !== suggestion.taskId) ?? null)
  }

  const acceptAllSuggestions = async () => {
    if (!suggestions) return
    for (const suggestion of suggestions) {
      await csrfFetch('/api/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: suggestion.taskId,
          committed_start: suggestion.startTime,
          committed_end: suggestion.endTime,
        }),
      })
    }
    setSuggestions(null)
    setUnplaced([])
    fetchEntriesForDate()
  }

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

  /** Take the time off a task: it goes back to the tray, unscheduled. */
  const handleUnscheduleTask = async (planId: string) => {
    await csrfFetch('/api/plans', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: planId, committed_start: null, committed_end: null }),
    })
    setSchedulingTask(null)
    fetchEntriesForDate()
  }

  /** Remove a task from the day. Until this, only the goal page could. */
  const handleDeleteTask = async (planId: string) => {
    const res = await csrfFetch(`/api/plans?id=${planId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete task')
    setSchedulingTask(null)
    setSuggestions((current) => current?.filter((s) => s.taskId !== planId) ?? null)
    fetchEntriesForDate()
  }

  /** Add a task to the day. A category already known from the log is kept, saving the model a call. */
  const addTask = async (title: string, category?: TimeCategory) => {
    if (!title || isAddingTask) return
    setIsAddingTask(true)
    try {
      const res = await csrfFetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, title }),
      })
      if (category) {
        const { plan } = (await res.json().catch(() => ({}))) as { plan?: { id: string } }
        if (plan?.id) rememberCategories({ [plan.id]: category })
      }
      setNewTaskTitle('')
      // A new task changes what there is to place: any proposal is stale.
      setSuggestions(null)
      setUnplaced([])
      fetchEntriesForDate()
    } catch (err) {
      console.error('Failed to add task:', err)
    } finally {
      setIsAddingTask(false)
    }
  }

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault()
    addTask(newTaskTitle.trim())
  }

  /**
   * What you do often, offered for this day in one tap. The thesis of the
   * app is that the gym and the call home have no owner; making you type
   * them again every evening was not much of an answer to that.
   */
  const recurring = useMemo(
    () =>
      recurringActivities(history, {
        forDate: selectedDate,
        alreadyPlanned: [...unscheduledTasks, ...committedTasks].map((t) => t.title),
      }),
    [history, selectedDate, unscheduledTasks, committedTasks]
  )

  /**
   * The plan on the app's one scale, before it is lived: what is logged,
   * what the calendar holds, what is planned and what is proposed. It
   * counts only what is on this page, which is the point — a plan with
   * nothing for Heart shows a Heart of nothing while it can still be fixed.
   */
  const forecast = useMemo(() => {
    if (isPastDay) return null
    const rows: EntryRow[] = []
    const add = (category: string, minutes: number, activity: string) =>
      rows.push({ category, duration_minutes: minutes, date: selectedDate, activity })

    for (const entry of entries) {
      if (entry.category) add(entry.category, entry.duration_minutes, entry.activity)
    }
    for (const event of unconfirmedEvents(calendarEvents, entries)) {
      add('meetings', timeToMinutes(event.endTime) - timeToMinutes(event.startTime), event.title)
    }

    let planned = 0
    for (const task of committedTasks) {
      const category = taskCategories[task.id]
      // Already done and in the log: counted above as its entry.
      if (!category || planOutcomes[task.id] === 'kept' || planOutcomes[task.id] === 'moved') continue
      add(category, timeToMinutes(task.committed_end) - timeToMinutes(task.committed_start), task.title)
      planned++
    }
    for (const suggestion of suggestions ?? []) {
      const category = taskCategories[suggestion.taskId]
      if (!category) continue
      add(category, suggestion.durationMinutes, suggestion.title)
      planned++
    }

    if (planned === 0) return null
    return { body: calcBody(rows), focus: calcFocus(rows), social: calcSocial(rows) }
  }, [isPastDay, entries, calendarEvents, committedTasks, suggestions, taskCategories, planOutcomes, selectedDate])

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

  /**
   * Every change of day goes through here. The day lives in the URL so that
   * leaving the planner and coming Back returns to the day you were
   * planning — it used to return to today — and proposals made for one day
   * do not follow you to another.
   */
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate)
    setSuggestions(null)
    setUnplaced([])
    window.history.replaceState(
      null,
      '',
      newDate === getLocalDateString() ? '/calendar' : `/calendar?date=${newDate}`
    )
  }

  const handlePrevDay = () => handleDateChange(shiftDateString(selectedDate, -1))

  const handleNextDay = () => handleDateChange(shiftDateString(selectedDate, 1))

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

              {recurring.length > 0 && (
                <div className="mt-3">
                  <p className="field-label mb-1.5">You often do</p>
                  <div className="flex flex-wrap gap-2">
                    {recurring.map((item) => (
                      <button
                        key={item.title}
                        onClick={() => addTask(item.title, item.category)}
                        disabled={isAddingTask}
                        aria-label={`Add ${item.title}`}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-border px-3.5 text-sm text-muted-foreground transition-all duration-150 hover:border-foreground/25 hover:text-foreground active:scale-[0.97] disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {item.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {unscheduledTasks.length > 0 && !suggestions && (
                <button
                  onClick={handleSuggestTimes}
                  disabled={isSuggesting}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-sm text-muted-foreground transition-all duration-150 hover:border-foreground/25 hover:text-foreground active:scale-[0.99]"
                >
                  {isSuggesting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Suggest times around my calendar
                    </>
                  )}
                </button>
              )}

              {/* Proposals. Nothing is committed until you say so, and each
                  one says why that hour — the reason is the point. */}
              {suggestions && suggestions.length > 0 && (
                <div className="mt-3 space-y-2">
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion.taskId}
                      className="rounded-lg border border-dashed border-border bg-secondary/40 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">{suggestion.title}</p>
                          <p className="text-[11px] tabular-nums text-muted-foreground mt-0.5">
                            {formatTimeDisplay(suggestion.startTime)} –{' '}
                            {formatTimeDisplay(suggestion.endTime)}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => acceptSuggestion(suggestion)}>
                          Accept
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-2">
                        {suggestion.reason}
                        {suggestion.source && (
                          <button
                            onClick={() => setWhySource(suggestion.source ?? null)}
                            className="ml-1 underline hover:no-underline"
                          >
                            why?
                          </button>
                        )}
                      </p>
                      {/* A proposal you can shape: how long, and — if this
                          hour is wrong — the next-best place it could go. */}
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-1 gap-y-2">
                        <div className="flex gap-1" role="group" aria-label={`Length of ${suggestion.title}`}>
                          {[30, 60, 90, 120].map((minutes) => {
                            const selected = suggestion.durationMinutes === minutes
                            return (
                              <button
                                key={minutes}
                                onClick={() => resizeSuggestion(suggestion, minutes)}
                                aria-pressed={selected}
                                className={`min-h-11 min-w-11 rounded-lg px-2 text-xs tabular-nums transition-colors ${
                                  selected
                                    ? 'bg-foreground text-background font-medium'
                                    : 'border border-border text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                {minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}
                              </button>
                            )
                          })}
                        </div>
                        <button
                          onClick={() => offerAnotherTime(suggestion)}
                          className="min-h-11 whitespace-nowrap rounded-lg px-1 text-xs text-muted-foreground underline hover:text-foreground hover:no-underline"
                        >
                          Another time
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center gap-2 pt-1">
                    <Button size="sm" className="flex-1" onClick={acceptAllSuggestions}>
                      Accept all
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSuggestions(null)
                        setUnplaced([])
                      }}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}

              {forecast && (
                <div className="mt-3 rounded-lg bg-secondary/40 px-3 py-2.5">
                  <p className="field-label">If the day goes to plan</p>
                  <p className="mt-1 text-sm font-medium tabular-nums" aria-label={`Body ${forecast.body}, Mind ${forecast.focus}, Heart ${forecast.social}`}>
                    <span style={{ color: METRIC_TEXT_HEX.body }}>Body {forecast.body}</span>
                    <span className="text-muted-foreground"> · </span>
                    <span style={{ color: METRIC_TEXT_HEX.focus }}>Mind {forecast.focus}</span>
                    <span className="text-muted-foreground"> · </span>
                    <span style={{ color: METRIC_TEXT_HEX.social }}>Heart {forecast.social}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Counting only what is on this page. Sleep, meals and anything unplanned add to it.
                  </p>
                </div>
              )}

              {unplaced.length > 0 && (
                <div className="mt-3 space-y-1">
                  {unplaced.map((item) => (
                    <p key={item.title} className="text-[11px] text-muted-foreground">
                      <span className="text-foreground">{item.title}</span> — {item.reason}
                    </p>
                  ))}
                </div>
              )}

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
            onUnschedule={() => handleUnscheduleTask(schedulingTask.id)}
            onDelete={() => handleDeleteTask(schedulingTask.id)}
            hideCalendarLink
            {...sheetDefaults(schedulingTask)}
          />
        )}

        <SourceSheet sourceId={whySource} onClose={() => setWhySource(null)} />

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
