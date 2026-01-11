'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface TimeEntryFormProps {
  onEntryAdded: () => void
}

export default function TimeEntryForm({ onEntryAdded }: TimeEntryFormProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [activity, setActivity] = useState('')
  const [duration, setDuration] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      // Get category from OpenAI
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
      const { error: insertError } = await supabase.from('time_entries').insert({
        user_id: 'default_user',
        date,
        activity,
        category,
        duration_minutes: parseInt(duration, 10),
        description: description || null,
      })

      if (insertError) {
        throw new Error(insertError.message)
      }

      // Reset form
      setActivity('')
      setDuration('')
      setDescription('')
      onEntryAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Date
          </label>
          <input
            type="date"
            id="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <div>
          <label htmlFor="duration" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Duration (minutes)
          </label>
          <input
            type="number"
            id="duration"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            min="1"
            required
            placeholder="30"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="activity" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Activity
          </label>
          <input
            type="text"
            id="activity"
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            required
            placeholder="e.g., Writing code for auth feature, Team standup, Reading documentation..."
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Category will be auto-assigned based on your activity
          </p>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="description" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Notes <span className="text-zinc-400">(optional)</span>
          </label>
          <input
            type="text"
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Any additional details..."
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-zinc-900"
      >
        {isSubmitting ? 'Categorizing & Saving...' : 'Add Entry'}
      </button>
    </form>
  )
}
