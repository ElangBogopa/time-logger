'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { TimeEntry, TimeCategory, CATEGORY_LABELS, CATEGORIES } from '@/lib/types'

interface TimeEntryModalProps {
  entry: TimeEntry
  onClose: () => void
  onUpdate: () => void
  onDelete: () => void
  promptAddTimes?: boolean
}

const CATEGORY_COLORS: Record<TimeCategory, string> = {
  deep_work: 'bg-[#64748b]/20 text-[#475569] dark:bg-[#64748b]/30 dark:text-[#94a3b8]',
  meetings: 'bg-[#8b7aa8]/20 text-[#6b5a88] dark:bg-[#8b7aa8]/30 dark:text-[#b8a8d8]',
  admin: 'bg-[#9ca3af]/20 text-[#6b7280] dark:bg-[#9ca3af]/30 dark:text-[#d1d5db]',
  learning: 'bg-[#5d9a9a]/20 text-[#4a7a7a] dark:bg-[#5d9a9a]/30 dark:text-[#8dcaca]',
  exercise: 'bg-[#6b9080]/20 text-[#4a6b5a] dark:bg-[#6b9080]/30 dark:text-[#9bc0b0]',
  rest: 'bg-[#a8a4ce]/20 text-[#6864ae] dark:bg-[#a8a4ce]/30 dark:text-[#c8c4ee]',
  meals: 'bg-[#b8a088]/20 text-[#8a7058] dark:bg-[#b8a088]/30 dark:text-[#d8c0a8]',
  self_care: 'bg-[#8fa387]/20 text-[#5f7357] dark:bg-[#8fa387]/30 dark:text-[#bfc3a7]',
  relationships: 'bg-[#b08d8d]/20 text-[#806060] dark:bg-[#b08d8d]/30 dark:text-[#d0adad]',
  distraction: 'bg-[#c97e7e]/20 text-[#995e5e] dark:bg-[#c97e7e]/30 dark:text-[#e9aeae]',
  other: 'bg-[#71717a]/20 text-[#52525b] dark:bg-[#71717a]/30 dark:text-[#a1a1aa]',
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours > 1 ? 's' : ''}`
}

function formatTime(time: string | null): string {
  if (!time) return '-'
  const [hours, minutes] = time.split(':')
  const h = parseInt(hours, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function TimeEntryModal({ entry, onClose, onUpdate, onDelete, promptAddTimes = false }: TimeEntryModalProps) {
  const [isEditing, setIsEditing] = useState(promptAddTimes)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTimesPrompt, setShowTimesPrompt] = useState(promptAddTimes && !entry.start_time && !entry.end_time)

  // Edit form state
  const [date, setDate] = useState(entry.date)
  const [activity, setActivity] = useState(entry.activity)
  const [category, setCategory] = useState<TimeCategory>(entry.category)
  const [startTime, setStartTime] = useState(entry.start_time || '')
  const [endTime, setEndTime] = useState(entry.end_time || '')
  const [duration, setDuration] = useState(String(entry.duration_minutes))
  const [description, setDescription] = useState(entry.description || '')

  const isDurationAutoCalculated = startTime !== '' && endTime !== ''

  // Auto-calculate duration when start and end times change
  useEffect(() => {
    if (startTime && endTime) {
      const [startHours, startMinutes] = startTime.split(':').map(Number)
      const [endHours, endMinutes] = endTime.split(':').map(Number)

      const startTotalMinutes = startHours * 60 + startMinutes
      const endTotalMinutes = endHours * 60 + endMinutes

      let durationMinutes = endTotalMinutes - startTotalMinutes

      if (durationMinutes < 0) {
        durationMinutes += 24 * 60
      }

      if (durationMinutes > 0) {
        setDuration(String(durationMinutes))
      }
    }
  }, [startTime, endTime])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const handleSave = async () => {
    setError(null)
    setIsSaving(true)

    try {
      const updatedEntry = {
        date,
        activity,
        category,
        duration_minutes: parseInt(duration, 10),
        start_time: startTime || null,
        end_time: endTime || null,
        description: description || null,
      }

      const { error: updateError } = await supabase
        .from('time_entries')
        .update(updatedEntry)
        .eq('id', entry.id)

      if (updateError) {
        throw new Error(updateError.message)
      }

      // Fetch all entries for the day to provide context for commentary
      const { data: dayEntries } = await supabase
        .from('time_entries')
        .select('*')
        .eq('date', date)
        .eq('user_id', entry.user_id)
        .order('created_at', { ascending: true })

      // Regenerate commentary with updated details
      try {
        const commentaryResponse = await fetch('/api/commentary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entry: { ...entry, ...updatedEntry },
            dayEntries: dayEntries || [],
          }),
        })

        if (commentaryResponse.ok) {
          const { commentary } = await commentaryResponse.json()

          await supabase
            .from('time_entries')
            .update({ commentary })
            .eq('id', entry.id)
        }
      } catch {
        // Commentary regeneration failed, but entry was updated
        console.error('Failed to regenerate commentary')
      }

      setIsEditing(false)
      onUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setError(null)

    try {
      const { error: deleteError } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', entry.id)

      if (deleteError) {
        throw new Error(deleteError.message)
      }

      onDelete()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry')
      setIsDeleting(false)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setDate(entry.date)
    setActivity(entry.activity)
    setCategory(entry.category)
    setStartTime(entry.start_time || '')
    setEndTime(entry.end_time || '')
    setDuration(String(entry.duration_minutes))
    setDescription(entry.description || '')
    setError(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {isEditing ? 'Edit Entry' : 'Entry Details'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
          {isEditing ? (
            <div className="space-y-4">
              {/* Add Times Prompt */}
              {showTimesPrompt && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">⏰</span>
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Add start and end times?
                      </p>
                      <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
                        This entry was placed on the timeline using estimated times. Add actual times for more accurate tracking.
                      </p>
                      <button
                        onClick={() => setShowTimesPrompt(false)}
                        className="mt-2 text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                />
              </div>

              {/* Activity */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Activity
                </label>
                <input
                  type="text"
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TimeCategory)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start & End Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                  />
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Duration (minutes)
                  {isDurationAutoCalculated && (
                    <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">Auto-calculated</span>
                  )}
                </label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  min="1"
                  disabled={isDurationAutoCalculated}
                  className={`mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 ${
                    isDurationAutoCalculated ? 'bg-zinc-100 dark:bg-zinc-600 cursor-not-allowed' : ''
                  }`}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Notes
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Activity & Category */}
              <div>
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  {entry.activity}
                </h3>
                <span className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-medium ${CATEGORY_COLORS[entry.category]}`}>
                  {CATEGORY_LABELS[entry.category]}
                </span>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900/50">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Date
                  </p>
                  <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
                    {formatDate(entry.date)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Duration
                  </p>
                  <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
                    {formatDuration(entry.duration_minutes)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Start Time
                  </p>
                  <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
                    {formatTime(entry.start_time)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    End Time
                  </p>
                  <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
                    {formatTime(entry.end_time)}
                  </p>
                </div>
              </div>

              {/* Notes */}
              {entry.description && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Notes
                  </p>
                  <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                    {entry.description}
                  </p>
                </div>
              )}

              {/* AI Commentary */}
              {entry.commentary && (
                <div className="rounded-lg border border-zinc-200 bg-gradient-to-br from-zinc-50 to-zinc-100 p-4 dark:border-zinc-700 dark:from-zinc-800 dark:to-zinc-900">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Commentary
                  </p>
                  <p className="mt-2 text-sm italic text-zinc-700 dark:text-zinc-300">
                    "{entry.commentary}"
                  </p>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-200 px-6 py-4 dark:border-zinc-700">
          {isEditing ? (
            <>
              <button
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-lg px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Edit
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
