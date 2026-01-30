'use client'

import {
  TimeEntry,
  TimeCategory,
  CATEGORY_LABELS,
  getAggregatedCategory,
  AggregatedCategory,
} from '@/lib/types'
import {
  Brain,
  Briefcase,
  Dumbbell,
  Heart,
  Users,
  Tv,
  HelpCircle,
} from 'lucide-react'

/**
 * Whoop-style activity list for locked (past) days.
 * Replaces the timeline calendar view with a clean card layout.
 */

// Aggregated category → hex color for the pill
const AGG_HEX: Record<AggregatedCategory, string> = {
  focus: '#3b82f6',   // blue-500
  ops: '#64748b',     // slate-500
  body: '#22c55e',    // green-500
  recovery: '#f59e0b', // amber-500
  connection: '#ec4899', // pink-500
  escape: '#71717a',  // zinc-500
}

// Aggregated category → icon
const AGG_ICONS: Record<AggregatedCategory, React.ElementType> = {
  focus: Brain,
  ops: Briefcase,
  body: Dumbbell,
  recovery: Heart,
  connection: Users,
  escape: Tv,
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}:${String(m).padStart(2, '0')}`
}

function formatTime(time: string | null): string {
  if (!time) return '--'
  const [hStr, mStr] = time.split(':')
  const h = parseInt(hStr, 10)
  const m = mStr || '00'
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour12}:${m} ${period}`
}

interface ActivityListProps {
  entries: TimeEntry[]
}

export default function ActivityList({ entries }: ActivityListProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">No activities logged for this session</p>
      </div>
    )
  }

  // Sort by start_time
  const sorted = [...entries].sort((a, b) => {
    if (!a.start_time || !b.start_time) return 0
    return a.start_time.localeCompare(b.start_time)
  })

  return (
    <div className="space-y-2">
      {sorted.map((entry) => {
        const aggCat = entry.category ? getAggregatedCategory(entry.category) : 'escape'
        const color = AGG_HEX[aggCat]
        const Icon = AGG_ICONS[aggCat] || HelpCircle
        const label = entry.activity || (entry.category ? CATEGORY_LABELS[entry.category] : 'Activity')

        return (
          <div
            key={entry.id}
            className="flex items-center gap-3 rounded-xl bg-card border border-border px-3 py-3"
          >
            {/* Duration pill */}
            <div
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 min-w-[72px] justify-center"
              style={{ backgroundColor: color }}
            >
              <Icon className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white tabular-nums">
                {formatDuration(entry.duration_minutes)}
              </span>
            </div>

            {/* Activity name */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate uppercase tracking-wide">
                {label}
              </p>
              {entry.category && (
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {CATEGORY_LABELS[entry.category]}
                </p>
              )}
            </div>

            {/* Time range + vertical bar */}
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatTime(entry.start_time)}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatTime(entry.end_time)}
                </p>
              </div>
              {/* Vertical color bar */}
              <div
                className="w-[3px] h-8 rounded-full"
                style={{ backgroundColor: color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
