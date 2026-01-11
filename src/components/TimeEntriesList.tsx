'use client'

import { useState } from 'react'
import { TimeEntry, CATEGORY_LABELS, TimeCategory } from '@/lib/types'
import TimeEntryModal from './TimeEntryModal'

interface TimeEntriesListProps {
  entries: TimeEntry[]
  isLoading: boolean
  onEntryDeleted: () => void
}

const CATEGORY_COLORS: Record<TimeCategory, string> = {
  deep_work: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  meetings: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  admin: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300',
  learning: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  exercise: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  rest: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  relationships: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  distraction: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  other: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

export default function TimeEntriesList({ entries, isLoading, onEntryDeleted }: TimeEntriesListProps) {
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null)
  const totalMinutes = entries.reduce((sum, entry) => sum + entry.duration_minutes, 0)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600"></div>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-zinc-500 dark:text-zinc-400">No entries for today yet.</p>
        <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">Add your first time entry above.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
        <span>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
        <span className="font-medium">Total: {formatDuration(totalMinutes)}</span>
      </div>

      <ul className="space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.id}
            onClick={() => setSelectedEntry(entry)}
            className="cursor-pointer rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-blue-600 dark:hover:bg-blue-900/10"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {entry.activity}
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[entry.category]}`}>
                    {CATEGORY_LABELS[entry.category]}
                  </span>
                </div>
                {entry.description && (
                  <p className="mt-1 truncate text-sm text-zinc-500 dark:text-zinc-400">
                    {entry.description}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                  {formatDuration(entry.duration_minutes)}
                </span>
                <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {selectedEntry && (
        <TimeEntryModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onUpdate={() => {
            setSelectedEntry(null)
            onEntryDeleted()
          }}
          onDelete={() => {
            setSelectedEntry(null)
            onEntryDeleted()
          }}
        />
      )}
    </div>
  )
}
