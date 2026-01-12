'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { CalendarEvent } from './TimelineView'
import TimeRangePicker from './TimeRangePicker'

interface GhostEntryModalProps {
  event: CalendarEvent | null
  onClose: () => void
  onConfirm: () => void
  onShowToast: (message: string) => void
  userId: string
  selectedDate: string
}

function formatTimeDisplay(time: string): string {
  if (!time) return ''
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function calculateDuration(start: string, end: string): number {
  if (!start || !end) return 0
  const startMins = timeToMinutes(start)
  let endMins = timeToMinutes(end)
  if (endMins <= startMins) endMins += 24 * 60
  return endMins - startMins
}

export default function GhostEntryModal({
  event,
  onClose,
  onConfirm,
  onShowToast,
  userId,
  selectedDate,
}: GhostEntryModalProps) {
  const [activity, setActivity] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize form when event changes
  useEffect(() => {
    if (event) {
      setActivity(event.title)
      setStartTime(event.startTime)
      setEndTime(event.endTime)
      setNotes('')
      setError(null)
    }
  }, [event])

  // Check if event has ended
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const endMinutes = endTime ? timeToMinutes(endTime) : 0
  const hasEnded = endMinutes <= currentMinutes || endMinutes > 23 * 60 + 45 // Past or near midnight

  const duration = calculateDuration(startTime, endTime)

  const handleConfirm = async () => {
    if (!activity.trim()) {
      setError('Please enter an activity name')
      return
    }

    if (duration <= 0) {
      setError('Please set valid start and end times')
      return
    }

    if (!hasEnded) {
      setError('You can only confirm entries after they end')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      // Get category from AI
      const categoryResponse = await fetch('/api/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity }),
      })

      let category = 'other'
      if (categoryResponse.ok) {
        const categoryData = await categoryResponse.json()
        category = categoryData.category
      }

      // Save to Supabase
      const newEntry = {
        user_id: userId,
        date: selectedDate,
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
          .eq('date', selectedDate)
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

      onConfirm()
      onShowToast(generatedCommentary || 'Calendar event confirmed!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entry')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose()
    }
    if (event) {
      document.addEventListener('keydown', handleEscape)
    }
    return () => document.removeEventListener('keydown', handleEscape)
  }, [event, isSubmitting, onClose])

  if (!event) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !isSubmitting && onClose()}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 bg-blue-50 px-5 py-4 dark:border-zinc-700 dark:bg-blue-900/20">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Confirm Calendar Event
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 p-5">
          {/* Activity */}
          <div>
            <label htmlFor="ghost-activity" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Activity
            </label>
            <input
              type="text"
              id="ghost-activity"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
            />
          </div>

          {/* Time Range */}
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Time
            </label>
            <TimeRangePicker
              startTime={startTime}
              endTime={endTime}
              onStartTimeChange={setStartTime}
              onEndTimeChange={setEndTime}
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="ghost-notes" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Notes <span className="text-zinc-400">(optional)</span>
            </label>
            <input
              type="text"
              id="ghost-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any details to add..."
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
            />
          </div>

          {/* Info/Warning */}
          {!hasEnded && (
            <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                You can confirm this entry after {formatTimeDisplay(endTime)}
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-100 p-4 dark:border-zinc-700">
          <button
            onClick={handleConfirm}
            disabled={!hasEnded || isSubmitting || !activity.trim() || duration <= 0}
            className={`w-full rounded-xl py-3 text-sm font-semibold transition-colors ${
              hasEnded && !isSubmitting && activity.trim() && duration > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'cursor-not-allowed bg-zinc-200 text-zinc-400 dark:bg-zinc-700 dark:text-zinc-500'
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Confirming...
              </span>
            ) : hasEnded ? (
              'Confirm Entry'
            ) : (
              `Available after ${formatTimeDisplay(endTime)}`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
