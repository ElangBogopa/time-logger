'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getLocalDateString } from '@/lib/types'
import Toast from './Toast'

interface QuickLogModalProps {
  isOpen: boolean
  onClose: () => void
  onEntryAdded: () => void
  lastEntryEndTime: string | null
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

function formatDuration(minutes: number): string {
  if (minutes <= 0) return ''
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

export default function QuickLogModal({ isOpen, onClose, onEntryAdded, lastEntryEndTime }: QuickLogModalProps) {
  const [activity, setActivity] = useState('')
  const [notes, setNotes] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset and auto-fill when modal opens
  useEffect(() => {
    if (isOpen) {
      setActivity('')
      setNotes('')
      setEndTime(getCurrentTime())
      setStartTime(lastEntryEndTime || '')
      setError(null)
      // Focus the activity input after a brief delay
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, lastEntryEndTime])

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
        user_id: 'default_user',
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
          .eq('user_id', 'default_user')
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

      setToast({
        message: generatedCommentary || 'Logged! Keep up the momentum.',
      })

      onEntryAdded()

      // Close after brief delay to show success
      setTimeout(() => {
        onClose()
      }, 300)
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
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={() => !isSubmitting && onClose()}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-24 z-50 mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-800 sm:inset-x-auto">
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

          {/* Time row */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label htmlFor="quick-start" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Started
                {lastEntryEndTime && (
                  <span className="ml-1 text-xs text-zinc-400">(from last entry)</span>
                )}
              </label>
              <input
                type="time"
                id="quick-start"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="quick-end" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Finished
              </label>
              <input
                type="time"
                id="quick-end"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
              />
            </div>
            {duration > 0 && (
              <div className="pb-2">
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {formatDuration(duration)}
                </span>
              </div>
            )}
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

      {toast && (
        <Toast
          title="Logged!"
          message={toast.message}
          onClose={() => setToast(null)}
          duration={4000}
        />
      )}
    </>
  )
}
