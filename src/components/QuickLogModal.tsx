'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { fetchEntries, createEntry, updateEntry, csrfFetch } from '@/lib/api'
import { getLocalDateString, getUserToday, TimeEntry, isEntryInFuture, PENDING_COMMENTARY, TimeCategory, CATEGORY_LABELS, TimePeriod, PERIOD_LABELS, getLoggingPeriod } from '@/lib/types'
import { getCurrentTime, calculateDuration, timeToMinutes, formatTimeDisplay } from '@/lib/time-utils'
import { parseTimeFromText, getHighlightedSegments, ParseResult } from '@/lib/time-parser'
import TimeRangePicker from './TimeRangePicker'
import { CalendarEvent } from './TimelineView'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, X, Zap, Calendar, Clock, Sparkles, TrendingUp, History, Plus, CheckCircle2 } from 'lucide-react'

interface ActivitySuggestion {
  activity: string
  category: TimeCategory | null
  suggestedDuration: number
  startTime: string
  endTime: string
  source: 'pattern' | 'recent'
  confidence: 'high' | 'medium'
}

interface QuickLogModalProps {
  isOpen: boolean
  onClose: () => void
  onEntryAdded: () => void
  lastEntryEndTime: string | null
  initialStartTime?: string
  initialEndTime?: string
  onShowToast: (message: string) => void
  userId: string
  calendarEvents?: CalendarEvent[]
  entries?: TimeEntry[]
  selectedDate?: string
  isFutureDay?: boolean
  isPastDay?: boolean
  onPeriodComplete?: (period: TimePeriod, periodEntries: TimeEntry[]) => void
  /** When true, skip the post-submit popup and just close after logging (for bulk logging in calendar) */
  disablePostSubmit?: boolean
}

export default function QuickLogModal({ isOpen, onClose, onEntryAdded, lastEntryEndTime, initialStartTime, initialEndTime, onShowToast, userId, calendarEvents = [], entries = [], selectedDate, isFutureDay = false, isPastDay = false, onPeriodComplete, disablePostSubmit = false }: QuickLogModalProps) {
  const [activity, setActivity] = useState('')
  const [notes, setNotes] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissedSuggestion, setDismissedSuggestion] = useState<string | null>(null)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Smart suggestions state
  const [suggestions, setSuggestions] = useState<ActivitySuggestion[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)

  // Auto-parse state - Todoist-style real-time parsing
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [isAutoParseApplied, setIsAutoParseApplied] = useState(false)
  const [showHighlightedInput, setShowHighlightedInput] = useState(false)
  // Store original times before parsing, for revert on dismiss
  const [originalTimes, setOriginalTimes] = useState<{ startTime: string; endTime: string } | null>(null)

  // Post-submit state - shows "Log another" vs "Done with period" options
  const [showPostSubmit, setShowPostSubmit] = useState(false)
  const [lastLoggedActivity, setLastLoggedActivity] = useState<string>('')
  const [isDoneLoading, setIsDoneLoading] = useState(false)

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

    const hasDragTimes = initialStartTime && initialEndTime

    // Show the suggestion chip if any time pattern is detected
    // User must click "Apply" to use the parsed times
    if (result.hasTimePattern && !isAutoParseApplied) {
      // If we have drag times and no explicit time input, don't show suggestion
      if (hasDragTimes) {
        const hasExplicitTimeRange = /\b(am|pm|o'clock|oclock|\d{1,2}:\d{2}|\d{1,2}\s*to\s*\d{1,2}|from\s+\d|until\s+\d|till\s+\d|at\s+\d)\b/i.test(activity)
        const hasDuration = result.detections.some(d => d.type === 'duration')
        if (!hasDuration && !hasExplicitTimeRange) {
          setShowHighlightedInput(false)
          return
        }
      }
      setShowHighlightedInput(true)
      // Save original times for revert (only once when chip first appears)
      if (!originalTimes && startTime && endTime) {
        setOriginalTimes({ startTime, endTime })
      }
    } else {
      setShowHighlightedInput(false)
    }
  }, [activity, initialStartTime, initialEndTime, isAutoParseApplied, startTime, endTime, originalTimes])

  // Fetch smart suggestions when modal opens
  const fetchSuggestions = useCallback(async () => {
    if (!userId || isFutureDay) return

    setIsLoadingSuggestions(true)
    try {
      const currentTime = getCurrentTime()
      const date = selectedDate || getUserToday()

      const response = await csrfFetch('/api/suggestions', {
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
  }, [userId, selectedDate, isFutureDay])

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

  // Find the most recent unconfirmed calendar event that has ended
  // Only show suggestions for TODAY, not future or past days
  const suggestedEvent = useMemo(() => {
    // Don't show calendar suggestions on future or past days
    if (isFutureDay || isPastDay) return null

    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    // Filter to events that have ended and aren't already logged
    const endedUnconfirmed = calendarEvents.filter(event => {
      // Check if event has ended
      const eventEndMinutes = timeToMinutes(event.endTime)
      if (eventEndMinutes > currentMinutes) return false

      // Check if this event is dismissed
      if (dismissedSuggestion === event.id) return false

      // Check if there's already a logged entry that overlaps significantly
      const hasMatchingEntry = entries.some(entry => {
        if (!entry.start_time || !entry.end_time) return false
        const entryStart = timeToMinutes(entry.start_time)
        const entryEnd = timeToMinutes(entry.end_time)
        const eventStart = timeToMinutes(event.startTime)
        const eventEnd = timeToMinutes(event.endTime)

        // Check for significant overlap (>50%)
        const overlapStart = Math.max(entryStart, eventStart)
        const overlapEnd = Math.min(entryEnd, eventEnd)
        const overlapDuration = Math.max(0, overlapEnd - overlapStart)
        const eventDuration = eventEnd - eventStart
        return eventDuration > 0 && overlapDuration / eventDuration > 0.5
      })

      return !hasMatchingEntry
    })

    // Return the most recent one (latest end time)
    if (endedUnconfirmed.length === 0) return null
    return endedUnconfirmed.reduce((latest, event) => {
      const latestEnd = timeToMinutes(latest.endTime)
      const eventEnd = timeToMinutes(event.endTime)
      return eventEnd > latestEnd ? event : latest
    })
  }, [calendarEvents, entries, dismissedSuggestion, isFutureDay, isPastDay])

  // Track if we've initialized times for this modal session
  const timesInitialized = useRef(false)

  // Reset form fields when modal opens
  useEffect(() => {
    if (isOpen) {
      setActivity('')
      setNotes('')
      setError(null)
      setDismissedSuggestion(null)
      setSuggestions([])
      setParseResult(null)
      setIsAutoParseApplied(false)
      setShowHighlightedInput(false)
      setOriginalTimes(null)
      setShowPostSubmit(false)
      setLastLoggedActivity('')
      setIsInputFocused(false)
      timesInitialized.current = false // Reset flag when modal opens
      // Focus the activity input after a brief delay
      setTimeout(() => inputRef.current?.focus(), 100)
      // Fetch smart suggestions
      fetchSuggestions()
    }
  }, [isOpen, fetchSuggestions])

  // Set times when modal opens or when initial times arrive
  // This handles the timing issue where drag times may arrive after modal opens
  useEffect(() => {
    if (!isOpen) return
    if (timesInitialized.current) return // Don't re-initialize once set

    // If we have drag-created times, use them
    if (initialStartTime && initialEndTime) {
      setStartTime(initialStartTime)
      setEndTime(initialEndTime)
      timesInitialized.current = true
    } else if (!initialStartTime && !initialEndTime) {
      // No drag times expected, use default behavior
      if (isFutureDay) {
        // Future day: default to 9:00 AM start, 10:00 AM end (1 hour block)
        // Or use first ghost calendar event time if available
        const firstGhostEvent = calendarEvents.length > 0
          ? calendarEvents.reduce((earliest, event) => {
              return timeToMinutes(event.startTime) < timeToMinutes(earliest.startTime) ? event : earliest
            }, calendarEvents[0])
          : null

        if (firstGhostEvent) {
          setStartTime(firstGhostEvent.startTime)
          setEndTime(firstGhostEvent.endTime)
        } else {
          setStartTime('09:00')
          setEndTime('10:00')
        }
      } else if (isPastDay) {
        // Past day: default to 9:00 AM start, 10:00 AM end (1 hour block)
        // User will adjust times to what actually happened
        setStartTime('09:00')
        setEndTime('10:00')
      } else {
        // Today: default to current time as end, last entry end as start
        setEndTime(getCurrentTime())
        setStartTime(lastEntryEndTime || '')
      }
      timesInitialized.current = true
    }
    // If initialStartTime/initialEndTime are undefined but might arrive later,
    // don't mark as initialized yet - wait for them
  }, [isOpen, initialStartTime, initialEndTime, lastEntryEndTime, isFutureDay, isPastDay, calendarEvents])

  const handleSuggestionClick = () => {
    if (suggestedEvent) {
      setActivity(suggestedEvent.title)
      setStartTime(suggestedEvent.startTime)
      setEndTime(suggestedEvent.endTime)
      setNotes('')
    }
  }

  const duration = calculateDuration(startTime, endTime)

  // Detect if start time is in the future (for today only)
  const isFutureStartTime = useMemo(() => {
    if (isFutureDay || isPastDay) return false // Only relevant for today
    if (!startTime) return false
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const startMinutes = timeToMinutes(startTime)
    return startMinutes > currentMinutes
  }, [startTime, isFutureDay, isPastDay])

  // Planning mode: either on a future day OR start time is in the future (for today)
  // Past days are NEVER planning mode - they're always confirmed
  const isPlanningMode = isFutureDay || isFutureStartTime

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!activity.trim()) {
      setError(isPlanningMode ? 'Please describe what you\'re planning' : 'Please describe what you just finished')
      return
    }

    if (duration <= 0) {
      setError('Please set a valid start time')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const today = getUserToday()
      const entryDate = selectedDate || today

      // Check for duplicate/overlapping entries first
      const existingEntries = await fetchEntries({ date: entryDate, fields: 'id,start_time,end_time,activity' })

      if (existingEntries.length > 0 && startTime && endTime) {
        const newStart = timeToMinutes(startTime)
        const newEnd = timeToMinutes(endTime)

        const overlappingEntry = existingEntries.find(entry => {
          if (!entry.start_time || !entry.end_time) return false
          const entryStart = timeToMinutes(entry.start_time)
          const entryEnd = timeToMinutes(entry.end_time)

          // Check for significant overlap (>50%)
          const overlapStart = Math.max(newStart, entryStart)
          const overlapEnd = Math.min(newEnd, entryEnd)
          const overlapDuration = Math.max(0, overlapEnd - overlapStart)
          const newDuration = newEnd - newStart

          return newDuration > 0 && overlapDuration / newDuration > 0.5
        })

        if (overlappingEntry) {
          setError(`This time overlaps with "${overlappingEntry.activity}". Adjust times or delete the existing entry.`)
          setIsSubmitting(false)
          return
        }
      }

      if (isPlanningMode) {
        // Future/planned entry - save as pending without AI categorization/commentary
        await createEntry({
          date: entryDate,
          activity,
          category: null, // No category until confirmed
          duration_minutes: duration,
          start_time: startTime,
          end_time: endTime,
          description: notes || null,
          commentary: PENDING_COMMENTARY.planned, // Static message
          status: 'pending',
        })

        onEntryAdded()
        // For future/planned entries, just close (no period summary for planning)
        onClose()
        onShowToast('Planned! Confirm this entry after it happens.')
      } else {
        // Past/current entry - normal flow with AI categorization + commentary
        const categoryResponse = await csrfFetch('/api/categorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activity }),
        })

        if (!categoryResponse.ok) {
          throw new Error('Failed to categorize activity')
        }

        const { category } = await categoryResponse.json()

        const insertedEntry = await createEntry({
          date: entryDate,
          activity,
          category,
          duration_minutes: duration,
          start_time: startTime,
          end_time: endTime,
          description: notes || null,
          status: 'confirmed',
        })

        // Skip per-entry commentary - we'll show period summary instead
        // Just save a placeholder commentary for the entry
        await updateEntry(insertedEntry.id, { commentary: 'Logged' })

        onEntryAdded()

        // If disablePostSubmit (calendar bulk logging), just close silently
        if (disablePostSubmit) {
          onClose()
          return
        }

        // Show post-submit options instead of closing
        setLastLoggedActivity(activity)
        setShowPostSubmit(true)
        // Reset form for potential next entry
        setActivity('')
        setNotes('')
        setError(null)
        setParseResult(null)
        setIsAutoParseApplied(false)
        setShowHighlightedInput(false)
        // Set start time to end of last entry for next entry
        setStartTime(endTime)
        setEndTime(getCurrentTime())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get current logging period
  const currentPeriod = getLoggingPeriod()
  const periodLabel = PERIOD_LABELS[currentPeriod]

  // Handle "Log another" - reset to form view
  const handleLogAnother = () => {
    setShowPostSubmit(false)
    setLastLoggedActivity('')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  // Handle "Done with period" - trigger period summary
  const handleDoneWithPeriod = async () => {
    setIsDoneLoading(true)
    
    try {
      // Fetch all entries for this period today
      const today = selectedDate || getUserToday()
      const periodRange = {
        morning: { start: 0, end: 12 },
        afternoon: { start: 12, end: 18 },
        evening: { start: 18, end: 24 },
      }[currentPeriod]

      // Get entries that fall within this period
      const allEntries = await fetchEntries({ date: today, status: 'confirmed' })

      const periodEntries = allEntries.filter(entry => {
        if (!entry.start_time) return false
        const hour = parseInt(entry.start_time.split(':')[0])
        return hour >= periodRange.start && hour < periodRange.end
      })

      console.log('[Period Summary] Current period:', currentPeriod)
      console.log('[Period Summary] Period range:', periodRange)
      console.log('[Period Summary] All entries:', allEntries?.length, allEntries?.map(e => ({ activity: e.activity, start: e.start_time, duration: e.duration_minutes })))
      console.log('[Period Summary] Filtered entries:', periodEntries.length, periodEntries.map(e => ({ activity: e.activity, start: e.start_time, duration: e.duration_minutes })))

      onClose()

      // Trigger period summary
      if (onPeriodComplete && periodEntries.length > 0) {
        onPeriodComplete(currentPeriod, periodEntries)
      }
    } catch (error) {
      console.error('Error fetching period entries:', error)
      // Still close the modal even if there's an error
      onClose()
    } finally {
      setIsDoneLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md" showCloseButton={!isSubmitting && !showPostSubmit}>
        {showPostSubmit ? (
          // Post-submit state - show options
          <>
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col items-center py-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10 mb-4">
                <CheckCircle2 className="h-7 w-7 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Entry logged!</h3>
              <p className="text-sm text-muted-foreground text-center">
                &ldquo;{lastLoggedActivity}&rdquo;
              </p>
            </div>

            <div className="space-y-3">
              <Button
                type="button"
                onClick={handleLogAnother}
                variant="outline"
                className="w-full"
              >
                <Plus className="h-4 w-4" />
                Log another activity
              </Button>

              <Button
                type="button"
                onClick={handleDoneWithPeriod}
                disabled={isDoneLoading}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
              >
                {isDoneLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Finishing up...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Done with {periodLabel.toLowerCase()}
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Finishing will show your {periodLabel.toLowerCase()} summary
              </p>
            </div>
          </>
        ) : (
          // Normal form view
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {isPlanningMode ? (
                  <>
                    <Clock className="h-5 w-5 text-blue-500" />
                    Plan Ahead
                  </>
                ) : isPastDay ? (
                  <>
                    <Clock className="h-5 w-5 text-zinc-500" />
                    Add Past Entry
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5 text-amber-500" />
                    Quick Log
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {isPlanningMode
                  ? 'Schedule an activity for the future with planned start and end times'
                  : isPastDay
                    ? 'Add an entry for an activity that happened in the past'
                    : 'Log an activity you just completed with duration and notes'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
          {/* Smart suggestions chips - only show when input is focused AND empty */}
          {isInputFocused && !activity && suggestions.length > 0 && (
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

          {/* Calendar suggestion chip - also only when input focused AND empty */}
          {isInputFocused && suggestedEvent && !activity && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 px-3 py-2 border border-blue-500/20">
              <button
                type="button"
                onClick={handleSuggestionClick}
                className="flex flex-1 items-center gap-2 text-left text-sm text-blue-400 hover:text-blue-300"
              >
                <Calendar className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">
                  <span className="font-medium">{suggestedEvent.title}</span>
                  <span className="text-blue-500"> ended at {formatTimeDisplay(suggestedEvent.endTime)}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDismissedSuggestion(suggestedEvent.id)}
                className="shrink-0 rounded p-0.5 text-blue-500 hover:bg-blue-500/20 hover:text-blue-400"
                aria-label="Dismiss suggestion"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Activity - main input with auto-parse highlighting */}
          <div className="space-y-2">
            <Label htmlFor="quick-activity">
              {isPlanningMode ? 'What are you planning to do?' : isPastDay ? 'What did you do?' : 'What did you just finish?'}
            </Label>
            <div className="relative">
              <Input
                ref={inputRef}
                id="quick-activity"
                value={activity}
                onChange={(e) => {
                  setActivity(e.target.value)
                  setIsAutoParseApplied(false) // Reset when user types
                  setOriginalTimes(null) // Reset so new parse can save new original times
                }}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => {
                  // Small delay to allow clicking suggestions before blur hides them
                  setTimeout(() => setIsInputFocused(false), 150)
                }}
                placeholder={isPlanningMode ? 'e.g., Team standup meeting' : 'e.g., "coded for 2 hours" or "lunch 12-1pm"'}
              />
              {/* Highlighted overlay showing detected time patterns */}
              {showHighlightedInput && parseResult && !isAutoParseApplied && (
                <div className="absolute inset-0 pointer-events-none px-3 py-2 text-sm overflow-hidden">
                  <span className="invisible">{activity}</span>
                </div>
              )}
            </div>

            {/* Auto-parse preview chip - shows detected times */}
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

          {/* Time Range Picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Time</Label>
              {!isPlanningMode && lastEntryEndTime && (
                <span className="text-xs text-muted-foreground">(start from last entry)</span>
              )}
            </div>
            <TimeRangePicker
              startTime={startTime}
              endTime={endTime}
              onStartTimeChange={setStartTime}
              onEndTimeChange={setEndTime}
              variant="quicklog"
            />
          </div>

          {/* Optional notes */}
          <div className="space-y-2">
            <Label htmlFor="quick-notes">
              Notes <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="quick-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any quick details..."
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            disabled={isSubmitting || !activity.trim() || duration <= 0}
            className={`w-full text-white ${
              isPlanningMode
                ? 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600'
                : isPastDay
                  ? 'bg-gradient-to-r from-zinc-500 to-zinc-600 hover:from-zinc-600 hover:to-zinc-700'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isPlanningMode ? 'Planning...' : isPastDay ? 'Adding...' : 'Logging...'}
              </>
            ) : isPlanningMode ? (
              <>
                <Clock className="h-4 w-4" />
                Plan it
              </>
            ) : isPastDay ? (
              <>
                Add Entry
                <Clock className="h-4 w-4" />
              </>
            ) : (
              <>
                Log it
                <Zap className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
