'use client'

import React from 'react'
import { timeToMinutes } from '@/lib/time-utils'
import type { CoveredBlock } from '@/lib/overnight'
import { PIXELS_PER_MINUTE, MIN_BLOCK_HEIGHT } from './constants'

interface TimelineCoveredProps {
  block: CoveredBlock
  startHour: number
}

/** "Tuesday", from a YYYY-MM-DD read as a local date. */
function weekdayOf(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'long' })
}

/**
 * The part of a neighbouring day's overnight sleep that falls on this day.
 * It is counted on its own day, so here it is neutral, shown and nothing
 * more: it cannot be dragged or opened, and a press on it does not start a
 * new entry underneath.
 */
export default function TimelineCovered({ block, startHour }: TimelineCoveredProps) {
  const startMinutes = timeToMinutes(block.startTime)
  const endMinutes = timeToMinutes(block.endTime)
  const top = (startMinutes - startHour * 60) * PIXELS_PER_MINUTE
  const height = Math.max((endMinutes - startMinutes) * PIXELS_PER_MINUTE, MIN_BLOCK_HEIGHT)
  const isShort = height < 40
  const counted = `Counted on ${weekdayOf(block.homeDate)}`

  return (
    <div
      data-covered-block
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className="absolute left-1 right-1 overflow-hidden rounded-xl bg-secondary text-muted-foreground"
      style={{ top, height }}
    >
      <div className="flex h-full flex-col justify-center px-2 py-1">
        {isShort ? (
          <span className="truncate text-xs">
            <span className="font-medium">{block.activity}</span> · {counted}
          </span>
        ) : (
          <>
            <span className="truncate text-sm font-medium">{block.activity}</span>
            <span className="truncate text-xs">{counted}</span>
          </>
        )}
      </div>
    </div>
  )
}
