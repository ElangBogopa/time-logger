'use client'

import { useState } from 'react'
import { TimeEntry, CATEGORY_LABELS, TimeCategory } from '@/lib/types'
import { formatDuration } from '@/lib/time-utils'
import TimeEntryModal from './TimeEntryModal'
import { Skeleton } from '@/components/ui/skeleton'
import { ClipboardList } from 'lucide-react'

interface TimeEntriesListProps {
  entries: TimeEntry[]
  isLoading: boolean
  onEntryDeleted: () => void
}

const CATEGORY_COLORS: Record<TimeCategory, string> = {
  // Productive
  deep_work: 'bg-[#3b82f6]/20 text-[#2563eb] dark:bg-[#3b82f6]/30 dark:text-[#60a5fa]',
  shallow_work: 'bg-[#64748b]/20 text-[#475569] dark:bg-[#64748b]/30 dark:text-[#94a3b8]',
  meetings: 'bg-[#8b7aa8]/20 text-[#6b5a88] dark:bg-[#8b7aa8]/30 dark:text-[#b8a8d8]',
  learning: 'bg-[#0891b2]/20 text-[#0e7490] dark:bg-[#0891b2]/30 dark:text-[#22d3ee]',
  creating: 'bg-[#7c3aed]/20 text-[#6d28d9] dark:bg-[#7c3aed]/30 dark:text-[#a78bfa]',
  // Maintenance
  admin: 'bg-[#9ca3af]/20 text-[#6b7280] dark:bg-[#9ca3af]/30 dark:text-[#d1d5db]',
  errands: 'bg-[#78716c]/20 text-[#57534e] dark:bg-[#78716c]/30 dark:text-[#a8a29e]',
  chores: 'bg-[#a1a1aa]/20 text-[#71717a] dark:bg-[#a1a1aa]/30 dark:text-[#d4d4d8]',
  commute: 'bg-[#737373]/20 text-[#525252] dark:bg-[#737373]/30 dark:text-[#a3a3a3]',
  // Body
  exercise: 'bg-[#22c55e]/20 text-[#16a34a] dark:bg-[#22c55e]/30 dark:text-[#4ade80]',
  movement: 'bg-[#86efac]/20 text-[#22c55e] dark:bg-[#86efac]/30 dark:text-[#bbf7d0]',
  meals: 'bg-[#f59e0b]/20 text-[#d97706] dark:bg-[#f59e0b]/30 dark:text-[#fbbf24]',
  sleep: 'bg-[#1e3a5f]/20 text-[#172554] dark:bg-[#1e3a5f]/30 dark:text-[#3b82f6]',
  // Mind
  rest: 'bg-[#a8a4ce]/20 text-[#6864ae] dark:bg-[#a8a4ce]/30 dark:text-[#c8c4ee]',
  self_care: 'bg-[#c4b5fd]/20 text-[#7c3aed] dark:bg-[#c4b5fd]/30 dark:text-[#ddd6fe]',
  // Connection
  social: 'bg-[#ec4899]/20 text-[#db2777] dark:bg-[#ec4899]/30 dark:text-[#f472b6]',
  calls: 'bg-[#f472b6]/20 text-[#ec4899] dark:bg-[#f472b6]/30 dark:text-[#f9a8d4]',
  // Leisure
  entertainment: 'bg-[#71717a]/20 text-[#52525b] dark:bg-[#71717a]/30 dark:text-[#a1a1aa]',
  // Fallback
  other: 'bg-[#52525b]/20 text-[#3f3f46] dark:bg-[#52525b]/30 dark:text-[#71717a]',
}

export default function TimeEntriesList({ entries, isLoading, onEntryDeleted }: TimeEntriesListProps) {
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null)
  const totalMinutes = entries.reduce((sum, entry) => sum + entry.duration_minutes, 0)

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <ClipboardList className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
        </div>
        <div>
          <p className="font-medium text-zinc-700 dark:text-zinc-300">No entries yet</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Use Quick Log or drag on the timeline to add entries
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
        <span>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
        <span className="font-medium">Total: {formatDuration(totalMinutes)}</span>
      </div>

      <ul className="space-y-2" role="list" aria-label="Time entries for today">
        {entries.map((entry) => (
          <li
            key={entry.id}
            onClick={() => setSelectedEntry(entry)}
            onKeyDown={(e) => e.key === 'Enter' && setSelectedEntry(entry)}
            tabIndex={0}
            role="button"
            aria-label={`${entry.activity}, ${formatDuration(entry.duration_minutes)}, ${entry.category ? CATEGORY_LABELS[entry.category] : 'Pending'}. Click to view details.`}
            className="cursor-pointer rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-blue-600 dark:hover:bg-blue-900/10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {entry.activity}
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${entry.category ? CATEGORY_COLORS[entry.category] : 'bg-zinc-500/20 text-zinc-400'}`}>
                    {entry.category ? CATEGORY_LABELS[entry.category] : 'Pending'}
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
                <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
