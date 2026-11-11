'use client'

import { TimeEntry, CATEGORY_LABELS, getAggregatedCategory, AggregatedCategory } from '@/lib/types'
import { formatDuration } from '@/lib/time-utils'
import { AGGREGATED_HEX } from '@/lib/palette'
import {
  Brain,
  Briefcase,
  Dumbbell,
  Heart,
  Users,
  Tv,
  HelpCircle,
  Sparkles,
} from 'lucide-react'

/**
 * The session's activities as cards.
 *
 * This is now the capture surface for every day, not just locked ones: the
 * drag timeline moved to /calendar, where precision is the point. Here you
 * read the day and tap a card to change one.
 *
 * The colours used to be a sixth private copy of the aggregated palette, in
 * bright Tailwind 500 hexes — written as raw hex, which is how they
 * survived the sweep that removed the utility classes.
 */

// Aggregated category → icon
const AGG_ICONS: Record<AggregatedCategory, React.ElementType> = {
  focus: Brain,
  ops: Briefcase,
  body: Dumbbell,
  recovery: Heart,
  connection: Users,
  escape: Tv,
  faith: Sparkles,
}

/** A card, interactive only when there is something to open. */
function Row({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const className =
    'w-full flex items-center gap-3 rounded-xl bg-card border border-border px-3 py-3 text-left'
  if (!onClick) return <div className={className}>{children}</div>
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${className} transition-all duration-150 hover:border-foreground/25 active:scale-[0.99]`}
    >
      {children}
    </button>
  )
}

// Durations come from the one formatter in time-utils. This file had its
// own, which wrote "2:28" beside rows reading "1h" — a clock time and a
// length in the same column.

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
  /** Omitted on a locked day, where there is nothing to change. */
  onEntryClick?: (entry: TimeEntry) => void
  emptyMessage?: string
}

export default function ActivityList({ entries, onEntryClick, emptyMessage }: ActivityListProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {emptyMessage ?? 'No activities logged for this session'}
        </p>
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
        const color = AGGREGATED_HEX[aggCat]
        const Icon = AGG_ICONS[aggCat] || HelpCircle
        const label = entry.activity || (entry.category ? CATEGORY_LABELS[entry.category] : 'Activity')

        return (
          <Row
            key={entry.id}
            onClick={onEntryClick ? () => onEntryClick(entry) : undefined}
          >
            {/* Duration pill */}
            <div
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 min-w-[84px] justify-center whitespace-nowrap"
              style={{ backgroundColor: color }}
            >
              <Icon className="h-3.5 w-3.5 text-white" />
              <span className="text-sm font-bold text-white tabular-nums">
                {formatDuration(entry.duration_minutes)}
              </span>
            </div>

            {/* Activity name */}
            <div className="flex-1 min-w-0">
              {/* As typed. It was upper-cased and letter-spaced, which
                  shouted the user's own words back and cut them short. */}
              <p className="text-sm font-medium text-foreground truncate">
                {label}
              </p>
              {entry.category && (
                <p className="field-label">
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
          </Row>
        )
      })}
    </div>
  )
}
