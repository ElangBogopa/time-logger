'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { fetchEntries as apiFetchEntries, createEntry, deleteEntry, upsertSessionCompletion } from '@/lib/api'
import {
  TimePeriod,
  TimeEntry,
  PERIOD_LABELS,
  PERIOD_TIME_RANGES,
  getLocalDateString,
  getUserToday,
  PENDING_COMMENTARY,
} from '@/lib/types'
import {
  getEntriesForPeriod,
  getSessionStats,
  formatSessionDuration,
  getPeriodStartTime,
  getPeriodEndTime,
  getFlexiblePeriodRange,
  getYesterdayDateString,
  canLogYesterdayEvening,
  findFirstGapInPeriod,
} from '@/lib/session-utils'
import { getCurrentTime, calculateDuration, timeToMinutes } from '@/lib/time-utils'
import { parseTimeFromText, ParseResult } from '@/lib/time-parser'
import { formatTimeDisplay } from '@/lib/time-utils'
import { useCalendar, CalendarEvent } from '@/contexts/CalendarContext'
import TimeRangePicker from '@/components/TimeRangePicker'
import PeriodSummaryPopup from '@/components/PeriodSummaryPopup'
import TimelineView, { DragCreateData } from '@/components/TimelineView'
import GhostEntryModal from '@/components/GhostEntryModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  Sun,
  Cloud,
  Moon,
  Loader2,
  Calendar,
  Plus,
  CheckCircle2,
  Clock,
  Trash2,
  Sparkles,
  List,
  LayoutGrid,
  TrendingUp,
  History,
  X,
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

  // Date handling - support yesterday's evening
  // Initialize empty for hydration safety, set on client
  const isYesterday = searchParams.get('date') === 'yesterday'
  const [selectedDate, setSelectedDate] = useState('')

  // Set selected date on client to avoid hydration mismatch
  useEffect(() => {
    if (!selectedDate) {
      setSelectedDate(isYesterday ? getYesterdayDateString() : getUserToday())
    }
  }, [selectedDate, isYesterday])

  // State
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activity, setActivity] = useState('')
  const [notes, setNotes] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  const [summaryCommentary, setSummaryCommentary] = useState<string | null>(null)
  const [isSummaryLoading, setIsSummaryLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'form' | 'timeline'>('form')
  const [selectedGhostEvent, setSelectedGhostEvent] = useState<CalendarEvent | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Soft-delete: track entry IDs pending deletion (hidden from UI, deleted after toast expires)
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set())
  const deleteTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Smart suggestions state
  interface ActivitySuggestion {
    activity: string
    category: string | null
    suggestedDuration: number
    startTime: string
    endTime: string
    source: 'pattern' | 'recent'
    confidence: 'high' | 'medium'
  }
  const [suggestions, setSuggestions] = useState<ActivitySuggestion[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)

  // Auto-parse state
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [isAutoParseApplied, setIsAutoParseApplied] = useState(false)
  const [showHighlightedInput, setShowHighlightedInput] = useState(false)
  // Store original times before parsing, for revert on dismiss
  const [originalTimes, setOriginalTimes] = useState<{ startTime: string; endTime: string } | null>(null)

  // Calendar context for ghost events
  const { getEventsForDate } = useCalendar()

  const userId = session?.user?.id || session?.user?.email || ''

  // Fetch entries for this date
  const fetchEntries = useCallback(async () => {
    if (!userId) return
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

  // Initialize times based on period and existing entries - find first gap
  useEffect(() => {
    // Get current time for constraining suggestions
    const now = new Date()
    const currentMins = now.getHours() * 60 + now.getMinutes()

    // Find the first available gap in this period
    const gap = findFirstGapInPeriod(entries, period, 60, currentMins)

    if (gap) {
      setStartTime(gap.startTime)
      setEndTime(gap.endTime)
    } else {
      // No gaps available, default to period start with 1 hour
      const hour = range.start
      setStartTime(`${hour.toString().padStart(2, '0')}:00`)
      setEndTime(`${Math.min(hour + 1, range.end).toString().padStart(2, '0')}:00`)
    }
  }, [entries, period, range])

  // Fetch smart suggestions
  const fetchSuggestions = useCallback(async () => {
    if (!userId) return

    setIsLoadingSuggestions(true)
    try {
      const currentTime = getCurrentTime()
      const date = selectedDate || getUserToday()

      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentTime, date }),
      })

      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.suggestions || [])
      }
    } catch (err) {
      console.error('Failed to fetch suggestions:', err)
    } finally {
      setIsLoadingSuggestions(false)
    }
  }, [userId, selectedDate])

  // Fetch suggestions on mount
  useEffect(() => {
    fetchSuggestions()
  }, [fetchSuggestions])

  // Real-time parsing as user types - NO auto-apply, just show the suggestion chip
  useEffect(() => {
    if (!activity || activity.trim().length < 2) {
      setParseResult(null)
      setShowHighlightedInput(false)
      return
    }

    const currentTime = getCurrentTime()
    const result = parseTimeFromText(activity, currentTime)
    setParseResult(result)

    // Show the suggestion chip if any time pattern is detected
    // User must click "Apply" to use the parsed times
    if (result.hasTimePattern && !isAutoParseApplied) {
      setShowHighlightedInput(true)
      // Save original times for revert (only once when chip first appears)
      if (!originalTimes && startTime && endTime) {
        setOriginalTimes({ startTime, endTime })
      }
    } else {
      setShowHighlightedInput(false)
    }
  }, [activity, isAutoParseApplied, startTime, endTime, originalTimes])

  // Compute what times would be applied based on parse result
  const computedParseTimes = useMemo(() => {
    if (!parseResult || !parseResult.hasTimePattern || !startTime) return null

    const totalDuration = parseResult.detections
      .filter(d => d.type === 'duration')
      .reduce((sum, d) => sum + (d.durationMinutes || 0), 0)
    const hasDuration = totalDuration > 0

    if (hasDuration) {
      // Has duration: use current startTime + duration
      const [hours, mins] = startTime.split(':').map(Number)
      const startMins = hours * 60 + mins
      const endMins = startMins + totalDuration
      const endHours = Math.floor(endMins / 60) % 24
      const endMinsPart = endMins % 60
      return {
        startTime: startTime,
        endTime: `${endHours.toString().padStart(2, '0')}:${endMinsPart.toString().padStart(2, '0')}`
      }
    } else if (parseResult.startTime && parseResult.endTime) {
      // Has explicit or activity-based time range: use parsed times
      return {
        startTime: parseResult.startTime,
        endTime: parseResult.endTime
      }
    } else if (parseResult.startTime) {
      // Has just start time: use it with current end time
      return {
        startTime: parseResult.startTime,
        endTime: endTime
      }
    }
    return null
  }, [parseResult, startTime, endTime])

  // Apply parsed times from the detected pattern
  const handleApplyParsedTimes = () => {
    if (!computedParseTimes) return

    setStartTime(computedParseTimes.startTime)
    setEndTime(computedParseTimes.endTime)

    // Update activity to cleaned version (without time expressions) only if it has content
    if (parseResult && parseResult.cleanedActivity.trim()) {
      setActivity(parseResult.cleanedActivity)
    }
    // If cleaned activity is empty, keep the original activity text

    setIsAutoParseApplied(true)
    setShowHighlightedInput(false)
    setOriginalTimes(null)
  }

  // Dismiss the parsed detection and revert to original times
  const handleDismissParsedTimes = () => {
    // Revert to original times if we have them
    if (originalTimes) {
      setStartTime(originalTimes.startTime)
      setEndTime(originalTimes.endTime)
    }
    setShowHighlightedInput(false)
    setIsAutoParseApplied(true) // Mark as "handled" so chip doesn't reappear
    setOriginalTimes(null)
  }

  // Apply a suggestion
  const handleSuggestionSelect = (suggestion: ActivitySuggestion) => {
    setActivity(suggestion.activity)
    setStartTime(suggestion.startTime)
    setEndTime(suggestion.endTime)
    setNotes('')
  }

  // Get period-relevant entries (excluding soft-deleted ones)
  const visibleEntries = entries.filter(e => !pendingDeletes.has(e.id))
  const periodEntries = getEntriesForPeriod(visibleEntries, period)
  const stats = getSessionStats(visibleEntries, period)

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

  const duration = calculateDuration(startTime, endTime)

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activity.trim() || duration <= 0) {
      setError('Please enter an activity and valid time range')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      // Check for overlapping entries
      const newStart = timeToMinutes(startTime)
      const newEnd = timeToMinutes(endTime)

      const overlapping = entries.find(entry => {
        if (!entry.start_time || !entry.end_time) return false
        const entryStart = timeToMinutes(entry.start_time)
        const entryEnd = timeToMinutes(entry.end_time)
        const overlapStart = Math.max(newStart, entryStart)
        const overlapEnd = Math.min(newEnd, entryEnd)
        const overlap = Math.max(0, overlapEnd - overlapStart)
        return overlap > (newEnd - newStart) * 0.5
      })

      if (overlapping) {
        setError(`This overlaps with "${overlapping.activity}"`)
        setIsSubmitting(false)
        return
      }

      // Categorize with AI
      const categoryResponse = await fetch('/api/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity }),
      })

      if (!categoryResponse.ok) {
        throw new Error('Failed to categorize')
      }

      const { category } = await categoryResponse.json()

      // Insert entry
      await createEntry({
        date: selectedDate,
        activity,
        category,
        duration_minutes: duration,
        start_time: startTime,
        end_time: endTime,
        description: notes || null,
        commentary: 'Logged',
        status: 'confirmed',
      })

      // Refresh and reset form
      await fetchEntries()
      setActivity('')
      setNotes('')
      setStartTime(endTime)
      setEndTime(getCurrentTime())
      setError(null)

      // Focus input for next entry
      setTimeout(() => inputRef.current?.focus(), 100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle ghost event confirmation
  const handleConfirmGhost = async (event: CalendarEvent) => {
    setActivity(event.title)
    setStartTime(event.startTime)
    setEndTime(event.endTime)
    setTimeout(() => inputRef.current?.focus(), 100)
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

    // Fetch AI commentary
    try {
      const response = await fetch('/api/period-commentary', {
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

    router.push('/')
  }

  // Handle summary close
  const handleSummaryClose = () => {
    setShowSummary(false)
    router.push('/')
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
    setStartTime(data.startTime)
    setEndTime(data.endTime)
    setViewMode('form')
    // Focus the activity input after switching to form view
    setTimeout(() => inputRef.current?.focus(), 100)
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
            onClick={() => router.push('/')}
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
                  {isYesterday && ' (Yesterday)'}
                </p>
              </div>
            </div>

            {/* View mode toggle */}
            <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
              <button
                onClick={() => setViewMode('form')}
                className={`p-2 transition-colors ${
                  viewMode === 'form'
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-label="List view"
                title="List view"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`p-2 transition-colors ${
                  viewMode === 'timeline'
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-label="Timeline view"
                title="Timeline view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>

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

        {/* Form View */}
        {viewMode === 'form' && (
          <>
            {/* Ghost calendar events */}
            {ghostEvents.length > 0 && (
              <section className="mb-6">
                <h2 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  From your calendar
                </h2>
                <div className="space-y-2">
                  {ghostEvents.map((event: CalendarEvent) => (
                    <button
                      key={event.id}
                      onClick={() => handleConfirmGhost(event)}
                      className="w-full rounded-lg border border-dashed border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-3 text-left hover:border-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors"
                    >
                      <p className="font-medium text-sm">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.startTime} - {event.endTime}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Logged entries */}
            {periodEntries.length > 0 && (
              <section className="mb-6">
                <h2 className="text-sm font-medium text-muted-foreground mb-2">
                  Logged this {label.toLowerCase()}
                </h2>
                <div className="space-y-2">
                  {periodEntries.map(entry => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-lg border bg-card p-3"
                    >
                      <div>
                        <p className="font-medium text-sm">{entry.activity}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.start_time} - {entry.end_time} ({entry.duration_minutes}m)
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="p-1.5 text-zinc-400 hover:text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30"
                        aria-label="Delete entry"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Entry form */}
            <section className="mb-6">
              <h2 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add activity
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-card p-4">
                {/* Smart suggestions chips */}
                {!activity && suggestions.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Sparkles className="h-3 w-3" />
                      <span>Suggestions</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSuggestionSelect(suggestion)}
                          className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:border-primary hover:bg-primary/5 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-primary"
                        >
                          {suggestion.source === 'pattern' ? (
                            <TrendingUp className="h-3 w-3 text-green-500" />
                          ) : (
                            <History className="h-3 w-3 text-blue-500" />
                          )}
                          <span className="font-medium">{suggestion.activity}</span>
                          <span className="text-muted-foreground">
                            {Math.round(suggestion.suggestedDuration / 60) > 0
                              ? `${Math.round(suggestion.suggestedDuration / 60)}h`
                              : `${suggestion.suggestedDuration}m`}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="activity">What did you do?</Label>
                  <Input
                    ref={inputRef}
                    id="activity"
                    value={activity}
                    onChange={(e) => {
                      setActivity(e.target.value)
                      setIsAutoParseApplied(false)
                      setOriginalTimes(null) // Reset so new parse can save new original times
                    }}
                    placeholder='e.g., "coded for 2 hours" or "meeting 2pm to 3pm"'
                  />

                  {/* Auto-parse preview chip */}
                  {showHighlightedInput && parseResult && parseResult.hasTimePattern && !isAutoParseApplied && computedParseTimes && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                      <Sparkles className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-primary font-medium">Detected time info</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {parseResult.detections.map(d => d.matchedText).join(', ')}
                          <span className="ml-1">→ {formatTimeDisplay(computedParseTimes.startTime)} - {formatTimeDisplay(computedParseTimes.endTime)}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={handleApplyParsedTimes}
                          className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          onClick={handleDismissParsedTimes}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Dismiss"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Applied confirmation */}
                  {isAutoParseApplied && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Times applied from your input
                    </p>
                  )}

                  {/* Help text when empty */}
                  {!activity && (
                    <p className="text-xs text-muted-foreground">
                      Tip: Type naturally like &quot;coded for 2 hours&quot; or &quot;meeting 2pm to 3pm&quot;
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Time</Label>
                  <TimeRangePicker
                    startTime={startTime}
                    endTime={endTime}
                    onStartTimeChange={setStartTime}
                    onEndTimeChange={setEndTime}
                    variant="quicklog"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Input
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any details..."
                  />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button
                  type="submit"
                  disabled={isSubmitting || !activity.trim() || duration <= 0}
                  className={`w-full bg-gradient-to-r ${colors.gradient} text-white`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Add Entry
                    </>
                  )}
                </Button>
              </form>
            </section>
          </>
        )}

        {/* Timeline View */}
        {viewMode === 'timeline' && (
          <section className="mb-6">
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
              isPastDay={isYesterday}
              canLog={true}
              visibleStartHour={range.start}
              visibleEndHour={range.end}
            />
            <p className="text-xs text-muted-foreground text-center mt-2">
              Drag to create entries, tap calendar events to confirm
            </p>
          </section>
        )}

        {/* Action buttons */}
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
      </div>

      {/* Period Summary Popup */}
      <PeriodSummaryPopup
        isOpen={showSummary}
        onClose={handleSummaryClose}
        period={period}
        entries={periodEntries}
        commentary={summaryCommentary}
        isLoading={isSummaryLoading}
        isEvening={period === 'evening'}
        onViewDayReview={() => {
          // TODO: Navigate to day in review
          handleSummaryClose()
        }}
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

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
