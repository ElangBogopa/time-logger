'use client'

import React from 'react'
import { formatDuration, timeToMinutes } from '@/lib/time-utils'
import { X } from 'lucide-react'

export interface CalendarEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  date: string
  isAllDay: boolean
}

interface TimelineGhostProps {
  event: CalendarEvent
  startHour: number
  isDismissed: boolean
  isToday: boolean
  overlappingGhostIds: Set<string>
  onMouseDown: (e: React.MouseEvent, event: CalendarEvent) => void
  onTouchStart: (e: React.TouchEvent, event: CalendarEvent) => void
  onTouchEnd?: (e: React.TouchEvent) => void
  onDismiss: (eventId: string) => void
}

import { PIXELS_PER_MINUTE, MIN_BLOCK_HEIGHT } from './constants'

export default function TimelineGhost({
  event,
  startHour,
  isDismissed,
  isToday,
  overlappingGhostIds,
  onMouseDown,
  onTouchStart,
  onTouchEnd,
  onDismiss,
}: TimelineGhostProps) {
  const startMinutes = timeToMinutes(event.startTime)
  const endMinutes = timeToMinutes(event.endTime)
  const durationMinutes = endMinutes - startMinutes
  const top = (startMinutes - startHour * 60) * PIXELS_PER_MINUTE
  const height = Math.max(durationMinutes * PIXELS_PER_MINUTE, MIN_BLOCK_HEIGHT)
  const isShort = height < 50

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const hasEnded = !isToday || currentMinutes >= endMinutes

  // Check if this ghost overlaps with an entry (for side-by-side layout)
  const ghostHasOverlap = overlappingGhostIds.has(event.id)

  return (
    <div
      key={`ghost-${event.id}`}
      data-ghost-block
      onMouseDown={(e) => {
        if (isDismissed) return
        onMouseDown(e, event)
      }}
      onTouchStart={(e) => {
        if (isDismissed) return
        onTouchStart(e, event)
      }}
      onTouchEnd={(e) => {
        if (isDismissed) return
        onTouchEnd?.(e)
      }}
      className={`absolute overflow-hidden rounded-xl border-2 border-dotted transition-all ${
        isDismissed
          ? 'border-zinc-400/30 bg-zinc-200/20 opacity-40 dark:border-zinc-600/20 dark:bg-zinc-800/10'
          : 'border-zinc-400/40 bg-zinc-500/10 hover:border-zinc-400/60 hover:bg-zinc-500/15 dark:border-zinc-500/30 dark:bg-zinc-700/20 dark:hover:border-zinc-400/40'
      } cursor-pointer`}
      style={{
        top,
        height,
        left: ghostHasOverlap ? '50%' : '4px',
        right: '4px',
      }}
    >
      <div className={`flex h-full flex-col justify-center px-2 py-1 ${
        isDismissed
          ? 'text-zinc-500 dark:text-zinc-500'
          : 'text-zinc-600 dark:text-zinc-400 opacity-80'
      }`}>
        {isShort ? (
          <div className="flex items-center justify-between gap-1">
            <span className="flex items-center gap-1 truncate text-xs font-medium">
              <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {event.title}
            </span>
            {!isDismissed && (
              <button
                onMouseDown={(e) => {
                  e.stopPropagation()
                  onDismiss(event.id)
                }}
                onTouchStart={(e) => {
                  e.stopPropagation()
                  onDismiss(event.id)
                }}
                className="shrink-0 rounded p-0.5 opacity-50 hover:bg-zinc-500/20 hover:opacity-80"
                aria-label="Dismiss"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-1">
              <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {event.title}
              </span>
              {!isDismissed && (
                <button
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    onDismiss(event.id)
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation()
                    onDismiss(event.id)
                  }}
                  className="shrink-0 rounded p-0.5 opacity-50 hover:bg-zinc-500/20 hover:opacity-80"
                  aria-label="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs opacity-80">
              <span>{event.startTime} - {event.endTime}</span>
              <span>({formatDuration(durationMinutes)})</span>
            </div>
            {height > 70 && (
              <span className="mt-1 text-xs opacity-70">
                {isDismissed ? 'Dismissed' : ghostHasOverlap ? 'Already logged → Tap to dismiss' : hasEnded ? 'Tap to confirm' : 'Pending...'}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}