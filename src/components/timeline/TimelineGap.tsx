'use client'

import React from 'react'
import { formatDuration, minutesToTime, timeToMinutes } from '@/lib/time-utils'
import { Plus } from 'lucide-react'

export interface TimeGap {
  startMinutes: number
  endMinutes: number
  startTime: string
  endTime: string
  durationMinutes: number
}

interface TimelineGapProps {
  gap: TimeGap
  startHour: number
  onDragCreate: (data: { startTime: string; endTime: string }) => void
}

const PIXELS_PER_MINUTE = 1.5
const MIN_BLOCK_HEIGHT = 24

export default function TimelineGap({ gap, startHour, onDragCreate }: TimelineGapProps) {
  const top = (gap.startMinutes - startHour * 60) * PIXELS_PER_MINUTE
  const height = Math.max(gap.durationMinutes * PIXELS_PER_MINUTE, MIN_BLOCK_HEIGHT)

  // When tapped, auto-set to 1 hour (or the full gap if shorter than 1 hour)
  const handleQuickAdd = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const startMins = timeToMinutes(gap.startTime)
    const maxEndMins = timeToMinutes(gap.endTime)
    const endMins = Math.min(startMins + 60, maxEndMins) // 1 hour or gap end
    onDragCreate({ startTime: gap.startTime, endTime: minutesToTime(endMins) })
  }

  // Container is pointer-events-none so long-press/drag passes through to timeline
  // Only the small pill button captures taps
  return (
    <div
      key={`gap-${gap.startTime}-${gap.endTime}`}
      className="absolute left-1 right-1 flex items-center justify-center pointer-events-none"
      style={{ top, height }}
    >
      <button
        data-gap-block
        onClick={handleQuickAdd}
        onTouchEnd={(e) => {
          // Prevent the touch from also firing a click + prevent long-press passthrough issues
          e.stopPropagation()
        }}
        className="pointer-events-auto flex items-center gap-1 px-2.5 py-1 rounded-full border border-dotted border-zinc-400/30 dark:border-zinc-500/25 bg-secondary/50 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/50 hover:border-zinc-400/50 dark:hover:border-zinc-400/30 active:scale-95 transition-all text-zinc-400 dark:text-zinc-500 hover:text-zinc-500 dark:hover:text-zinc-400"
      >
        <Plus className="h-3 w-3 shrink-0" />
        <span className="text-[10px] font-medium whitespace-nowrap">
          {formatDuration(gap.durationMinutes)}
        </span>
      </button>
    </div>
  )
}