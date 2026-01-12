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
