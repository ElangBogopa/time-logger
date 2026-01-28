'use client'

import React from 'react'
import { formatDuration, formatTimeDisplay, timeToMinutes } from '@/lib/time-utils'
import { HelpCircle } from 'lucide-react'

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
  const isShort = height < 50

  return (
    <div
      key={`gap-${gap.startTime}-${gap.endTime}`}
      data-gap-block
      onClick={(e) => {
        e.stopPropagation()
        onDragCreate({ startTime: gap.startTime, endTime: gap.endTime })
      }}
      className="absolute left-1 right-1 overflow-hidden rounded-lg border border-dotted border-zinc-500/20 dark:border-zinc-500/15 bg-transparent hover:bg-zinc-500/5 dark:hover:bg-zinc-400/5 hover:border-zinc-500/30 dark:hover:border-zinc-400/20 transition-all cursor-pointer group"
      style={{ top, height }}
    >
      <div className="flex h-full flex-col items-center justify-center px-2 py-1 text-zinc-400 dark:text-zinc-500 opacity-60 group-hover:opacity-100 transition-opacity">
        {isShort ? (
          <div className="flex items-center gap-1">
            <HelpCircle className="h-3 w-3 shrink-0" />
            <span className="text-[10px]">{formatDuration(gap.durationMinutes)} unlogged</span>
          </div>
        ) : (
          <>
            <HelpCircle className="h-4 w-4 mb-0.5" />
            <span className="text-xs font-medium">
              {formatDuration(gap.durationMinutes)} unlogged
            </span>
            <span className="text-[10px] mt-0.5">
              {formatTimeDisplay(gap.startTime)} – {formatTimeDisplay(gap.endTime)}
            </span>
            {height > 70 && (
              <span className="text-[10px] mt-1 opacity-0 group-hover:opacity-70 transition-opacity">
                Tap to log
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}