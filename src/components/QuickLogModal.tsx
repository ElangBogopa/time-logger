'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { getLocalDateString, TimeEntry } from '@/lib/types'
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
import { Loader2, X, Zap, Calendar } from 'lucide-react'

interface QuickLogModalProps {
  isOpen: boolean
  onClose: () => void
  onEntryAdded: () => void
  lastEntryEndTime: string | null
  onShowToast: (message: string) => void
  userId: string
  calendarEvents?: CalendarEvent[]
  entries?: TimeEntry[]
}

function getCurrentTime(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function calculateDuration(start: string, end: string): number {
  if (!start || !end) return 0
  const [startHours, startMinutes] = start.split(':').map(Number)
  const [endHours, endMinutes] = end.split(':').map(Number)

  let startTotal = startHours * 60 + startMinutes
  let endTotal = endHours * 60 + endMinutes

  // Handle crossing midnight
  if (endTotal < startTotal) {
    endTotal += 24 * 60
  }

  return endTotal - startTotal
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function formatTimeDisplay(time: string): string {
  if (!time) return ''
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`
}

export default function QuickLogModal({ isOpen, onClose, onEntryAdded, lastEntryEndTime, onShowToast, userId, calendarEvents = [], entries = [] }: QuickLogModalProps) {
  const [activity, setActivity] = useState('')
  const [notes, setNotes] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissedSuggestion, setDismissedSuggestion] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Find the most recent unconfirmed calendar event that has ended
  const suggestedEvent = useMemo(() => {
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
  }, [calendarEvents, entries, dismissedSuggestion])

  // Reset and auto-fill when modal opens
  useEffect(() => {
    if (isOpen) {
      setActivity('')
      setNotes('')
      setEndTime(getCurrentTime())
      setStartTime(lastEntryEndTime || '')
      setError(null)
      setDismissedSuggestion(null)
      // Focus the activity input after a brief delay
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, lastEntryEndTime])

  const handleSuggestionClick = () => {
    if (suggestedEvent) {
      setActivity(suggestedEvent.title)
      setStartTime(suggestedEvent.startTime)
      setEndTime(suggestedEvent.endTime)
      setNotes('')
    }
  }

  const duration = calculateDuration(startTime, endTime)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!activity.trim()) {
      setError('Please describe what you just finished')
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

      // Get category from AI
      const categoryResponse = await fetch('/api/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity }),
      })

      if (!categoryResponse.ok) {
        throw new Error('Failed to categorize activity')
      }

      const { category } = await categoryResponse.json()

      // Save to Supabase
      const newEntry = {
        user_id: userId,
        date: today,
        activity,
        category,
        duration_minutes: duration,
        start_time: startTime,
        end_time: endTime,
        description: notes || null,
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
          .eq('date', today)
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
        }
      } catch {
        console.error('Failed to generate commentary')
      }

      onEntryAdded()

      // Close modal and show toast
      onClose()
      onShowToast(generatedCommentary || 'Logged! Keep up the momentum.')
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
            <Zap className="h-5 w-5 text-amber-500" />
            Quick Log
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
            <Label htmlFor="quick-activity">What did you just finish?</Label>
            <Input
              ref={inputRef}
              id="quick-activity"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              placeholder="e.g., Code review for auth PR"
            />
          </div>

          {/* Time Range Picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Time</Label>
              {lastEntryEndTime && (
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
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Logging...
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
