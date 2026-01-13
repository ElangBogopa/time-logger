'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { getLocalDateString, TimeEntry, isEntryInFuture, PENDING_COMMENTARY } from '@/lib/types'
import { getCurrentTime, calculateDuration, timeToMinutes, formatTimeDisplay } from '@/lib/time-utils'
import TimeRangePicker from './TimeRangePicker'
import { CalendarEvent } from './TimelineView'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, X, Zap, Calendar, Clock } from 'lucide-react'

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
}

export default function QuickLogModal({ isOpen, onClose, onEntryAdded, lastEntryEndTime, initialStartTime, initialEndTime, onShowToast, userId, calendarEvents = [], entries = [], selectedDate, isFutureDay = false, isPastDay = false }: QuickLogModalProps) {
  const [activity, setActivity] = useState('')
  const [notes, setNotes] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissedSuggestion, setDismissedSuggestion] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
      timesInitialized.current = false // Reset flag when modal opens
      // Focus the activity input after a brief delay
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

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
      const today = getLocalDateString()
      const entryDate = selectedDate || today

      if (isPlanningMode) {
        // Future/planned entry - save as pending without AI categorization/commentary
        const newEntry = {
          user_id: userId,
          date: entryDate,
          activity,
          category: null, // No category until confirmed
          duration_minutes: duration,
          start_time: startTime,
          end_time: endTime,
          description: notes || null,
          commentary: PENDING_COMMENTARY.planned, // Static message
          status: 'pending',
        }

        const { error: insertError } = await supabase
          .from('time_entries')
          .insert(newEntry)

        if (insertError) {
          throw new Error(insertError.message)
        }

        onEntryAdded()
        onClose()
        onShowToast('Planned! Confirm this entry after it happens.')
      } else {
        // Past/current entry - normal flow with AI categorization + commentary
        const categoryResponse = await fetch('/api/categorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activity }),
        })

        if (!categoryResponse.ok) {
          throw new Error('Failed to categorize activity')
        }

        const { category } = await categoryResponse.json()

        const newEntry = {
          user_id: userId,
          date: entryDate,
          activity,
          category,
          duration_minutes: duration,
          start_time: startTime,
          end_time: endTime,
          description: notes || null,
          status: 'confirmed',
        }

        const { data: insertedEntry, error: insertError } = await supabase
          .from('time_entries')
          .insert(newEntry)
          .select()
          .single()

        if (insertError) {
          throw new Error(insertError.message)
        }

        // Generate commentary
        let generatedCommentary: string | null = null
        try {
          const { data: dayEntries } = await supabase
            .from('time_entries')
            .select('*')
            .eq('date', entryDate)
            .eq('user_id', userId)
            .order('created_at', { ascending: true })

          const commentaryResponse = await fetch('/api/commentary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entry: insertedEntry,
              dayEntries: dayEntries || [],
            }),
          })

          if (commentaryResponse.ok) {
            const { commentary } = await commentaryResponse.json()
            generatedCommentary = commentary

            await supabase
              .from('time_entries')
              .update({ commentary })
              .eq('id', insertedEntry.id)
          } else {
            generatedCommentary = null // Mark as failed
          }
        } catch {
          generatedCommentary = null // Mark as failed
        }

        onEntryAdded()
        onClose()
        // Show different toast based on whether commentary generated
        if (generatedCommentary) {
          onShowToast(generatedCommentary)
        } else {
          onShowToast('Entry logged! (AI commentary unavailable)')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md" showCloseButton={!isSubmitting}>
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
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Calendar suggestion chip */}
          {suggestedEvent && !activity && (
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

          {/* Activity - main input */}
          <div className="space-y-2">
            <Label htmlFor="quick-activity">
              {isPlanningMode ? 'What are you planning to do?' : isPastDay ? 'What did you do?' : 'What did you just finish?'}
            </Label>
            <Input
              ref={inputRef}
              id="quick-activity"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              placeholder={isPlanningMode ? 'e.g., Team standup meeting' : 'e.g., Code review for auth PR'}
            />
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
      </DialogContent>
    </Dialog>
  )
}
