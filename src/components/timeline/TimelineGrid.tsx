'use client'

import React from 'react'
import { formatHour } from '@/lib/time-utils'

interface TimelineGridProps {
  startHour: number
  endHour: number
  timelineHeight: number
  isDragging: boolean
  isTouchDragging: boolean
  isAdjustingEntry: boolean
  onMouseDown: (e: React.MouseEvent) => void
  onTouchStart: (e: React.TouchEvent) => void
  onDragCreate?: boolean
  children?: React.ReactNode
}

import { HOUR_HEIGHT } from './constants'

export default function TimelineGrid({
  startHour,
  endHour,
  timelineHeight,
  isDragging,
  isTouchDragging,
  isAdjustingEntry,
  onMouseDown,
  onTouchStart,
  onDragCreate = true,
  children,
}: TimelineGridProps) {
  // Memoize hours array
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i)

  return (
    <div className="relative flex overflow-hidden" style={{ height: timelineHeight }}>
      {/* Hour labels */}
      <div className="sticky left-0 z-10 w-14 shrink-0 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
        {hours.map((hour) => (
          <div
            key={hour}
            className="absolute left-0 right-0 flex items-start justify-end pr-2"
            style={{ top: (hour - startHour) * HOUR_HEIGHT - 8 }}
          >
            <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
              {formatHour(hour)}
            </span>
          </div>
        ))}
      </div>

      {/* Timeline grid and entries */}
      <div
        className={`relative flex-1 ${onDragCreate ? 'cursor-crosshair' : ''} ${isDragging || isTouchDragging || isAdjustingEntry ? 'select-none' : ''}`}
        style={{ touchAction: isTouchDragging || isAdjustingEntry ? 'none' : 'auto' }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        {/* Hour grid lines */}
        {hours.map((hour) => (
          <div
            key={hour}
            className="absolute left-0 right-0 border-t border-zinc-100 dark:border-zinc-700/50"
            style={{ top: (hour - startHour) * HOUR_HEIGHT }}
          />
        ))}

        {/* Half-hour grid lines */}
        {hours.slice(0, -1).map((hour) => (
          <div
            key={`${hour}-half`}
            className="absolute left-0 right-0 border-t border-dashed border-zinc-100 dark:border-zinc-700/30"
            style={{ top: (hour - startHour) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
          />
        ))}

        {children}
      </div>
    </div>
  )
}