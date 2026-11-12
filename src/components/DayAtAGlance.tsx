'use client'

import { ChevronDown } from 'lucide-react'
import { getAggregatedCategory, type TimeEntry } from '@/lib/types'
import { AGGREGATED_HEX } from '@/lib/palette'
import { timeToMinutes } from '@/lib/time-utils'

/**
 * The day as one band, closed.
 *
 * The grid used to be the only way to see a day: 1080 pixels of mostly
 * empty night in a 500-pixel window, always open, dominating the screen
 * whether or not you were editing anything. This is the resting state —
 * the shape of the day at a glance, a line of text about it, and a tap to
 * open the grid when you actually want to move something.
 */

const DAY_MINUTES = 24 * 60
const TICKS = [6, 12, 18]

export interface GlanceBlock {
  id: string
  startMinutes: number
  endMinutes: number
  colour: string
  /** Planned but not yet lived: drawn hollow. */
  outlined?: boolean
  /** Proposed and not yet accepted: hollow, with a wash of its colour. */
  proposed?: boolean
}

/** Entries, calendar events and planned tasks as one set of bands. */
export function blocksForGlance({
  entries,
  events = [],
  planned = [],
}: {
  entries: TimeEntry[]
  events?: { id: string; startTime: string; endTime: string }[]
  planned?: { id: string; committed_start: string; committed_end: string }[]
}): GlanceBlock[] {
  const blocks: GlanceBlock[] = []

  for (const entry of entries) {
    if (!entry.start_time) continue
    const start = timeToMinutes(entry.start_time)
    const end = entry.end_time ? timeToMinutes(entry.end_time) : start + entry.duration_minutes
    if (end <= start) continue
    blocks.push({
      id: `entry-${entry.id}`,
      startMinutes: start,
      endMinutes: end,
      colour: AGGREGATED_HEX[entry.category ? getAggregatedCategory(entry.category) : 'escape'],
    })
  }

  for (const event of events) {
    const start = timeToMinutes(event.startTime)
    const end = timeToMinutes(event.endTime)
    if (end > start) {
      blocks.push({ id: `event-${event.id}`, startMinutes: start, endMinutes: end, colour: '#8B8680', outlined: true })
    }
  }

  for (const task of planned) {
    const start = timeToMinutes(task.committed_start)
    const end = timeToMinutes(task.committed_end)
    if (end > start) {
      blocks.push({ id: `plan-${task.id}`, startMinutes: start, endMinutes: end, colour: '#8B7E74', outlined: true })
    }
  }

  return blocks
}

export default function DayAtAGlance({
  blocks,
  summary,
  nowMinutes = null,
  onOpen,
}: {
  blocks: GlanceBlock[]
  /** One line about the day: "3 entries · 4h 15m" or "2 tasks scheduled". */
  summary: string
  nowMinutes?: number | null
  onOpen: () => void
}) {
  const percent = (minutes: number) => `${(minutes / DAY_MINUTES) * 100}%`

  return (
    <button
      onClick={onOpen}
      aria-label="Open the day grid"
      className="w-full rounded-xl border border-border bg-card p-4 text-left transition-all duration-150 hover:border-foreground/25 active:scale-[0.995]"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{summary}</span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          Open
          <ChevronDown className="h-3.5 w-3.5" />
        </span>
      </div>

      {/* The band itself */}
      <div className="relative h-10 w-full overflow-hidden rounded-lg bg-secondary/60">
        {blocks.map((block) => (
          <span
            key={block.id}
            className="absolute top-1 bottom-1 rounded-[3px]"
            style={{
              left: percent(block.startMinutes),
              width: `max(2px, ${(block.endMinutes - block.startMinutes) / DAY_MINUTES * 100}%)`,
              // 40 is a quarter alpha: enough to tell a proposal from a commitment.
              backgroundColor: block.proposed ? `${block.colour}40` : block.outlined ? 'transparent' : block.colour,
              border: block.outlined ? `1px dashed ${block.colour}` : undefined,
            }}
          />
        ))}

        {nowMinutes !== null && (
          <span
            className="absolute top-0 bottom-0 w-px bg-foreground/70"
            style={{ left: percent(nowMinutes) }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Just enough scale to read it by */}
      <div className="relative mt-1 h-3">
        {TICKS.map((hour) => (
          <span
            key={hour}
            className="absolute text-xs text-muted-foreground -translate-x-1/2"
            style={{ left: percent(hour * 60) }}
          >
            {hour === 12 ? 'noon' : `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}`}
          </span>
        ))}
      </div>
    </button>
  )
}
