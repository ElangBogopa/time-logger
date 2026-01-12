'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { getLocalDateString, TimeEntry } from '@/lib/types'
import TimeRangePicker from './TimeRangePicker'
import { CalendarEvent } from './TimelineView'

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

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, isSubmitting, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !isSubmitting && onClose()}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            <span className="text-xl">⚡</span> Quick Log
          </h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Calendar suggestion chip */}
          {suggestedEvent && !activity && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 dark:bg-blue-900/20">
              <button
                type="button"
                onClick={handleSuggestionClick}
                className="flex flex-1 items-center gap-2 text-left text-sm text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
              >
                <span className="text-base">📅</span>
                <span className="flex-1 truncate">
                  <span className="font-medium">{suggestedEvent.title}</span>
                  <span className="text-blue-600 dark:text-blue-400"> ended at {formatTimeDisplay(suggestedEvent.endTime)}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDismissedSuggestion(suggestedEvent.id)}
                className="shrink-0 rounded p-0.5 text-blue-400 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-800 dark:hover:text-blue-300"
                aria-label="Dismiss suggestion"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Activity - main input */}
          <div>
            <label htmlFor="quick-activity" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              What did you just finish?
            </label>
            <input
              ref={inputRef}
              type="text"
              id="quick-activity"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              placeholder="e.g., Code review for auth PR"
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
            />
          </div>

          {/* Time Range Picker */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Time
              </label>
              {lastEntryEndTime && (
                <span className="text-xs text-zinc-400">(start from last entry)</span>
              )}
            </div>
            <TimeRangePicker
              startTime={startTime}
              endTime={endTime}
              onStartTimeChange={setStartTime}
              onEndTimeChange={setEndTime}
            />
          </div>

          {/* Optional notes */}
          <div>
            <label htmlFor="quick-notes" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Notes <span className="text-zinc-400">(optional)</span>
            </label>
            <input
              type="text"
              id="quick-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any quick details..."
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !activity.trim() || duration <= 0}
            className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:from-amber-600 hover:to-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-zinc-800"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Logging...
              </span>
            ) : (
              'Log it ⚡'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
