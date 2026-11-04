'use client'

import React from 'react'
import { formatDuration, formatTimeDisplay, timeToMinutes } from '@/lib/time-utils'
import { TimeEntry, isPendingEntryReadyToConfirm } from '@/lib/types'
import { Clock } from 'lucide-react'

export interface PlacedEntry extends TimeEntry {
  placedStartTime: string
  placedEndTime: string
  isEstimated: boolean
}

interface AdjustPreview {
  entryId: string
  startTime: string
  endTime: string
}

interface TimelineEntryProps {
  entry: PlacedEntry
  startHour: number
  adjustPreview: AdjustPreview | null
  overlappingEntryIds: Set<string>
  onMouseDown: (e: React.MouseEvent, entry: PlacedEntry) => void
  onTouchStart: (e: React.TouchEvent, entry: PlacedEntry) => void
  onClick?: (entry: PlacedEntry) => void
}

import { PIXELS_PER_MINUTE, MIN_BLOCK_HEIGHT, getCategoryColors } from './constants'

export default function TimelineEntry({
  entry,
  startHour,
  adjustPreview,
  overlappingEntryIds,
  onMouseDown,
  onTouchStart,
  onClick,
}: TimelineEntryProps) {
  const startMinutes = timeToMinutes(entry.placedStartTime)
  const endMinutes = timeToMinutes(entry.placedEndTime)
  const top = (startMinutes - startHour * 60) * PIXELS_PER_MINUTE
  const height = Math.max((endMinutes - startMinutes) * PIXELS_PER_MINUTE, MIN_BLOCK_HEIGHT)
  const colors = entry.category ? getCategoryColors(entry.category) : getCategoryColors('other')
  const isShort = height < 50
  const isPending = entry.status === 'pending'
  const isReadyToConfirm = isPending && isPendingEntryReadyToConfirm(entry)

  // Pending entries get ghost styling (with drag-to-adjust if they have times)
  if (isPending) {
    const pendingIsBeingAdjusted = adjustPreview?.entryId === entry.id
    const pendingDisplayStartTime = pendingIsBeingAdjusted ? adjustPreview.startTime : entry.placedStartTime
    const pendingDisplayEndTime = pendingIsBeingAdjusted ? adjustPreview.endTime : entry.placedEndTime
    const pendingDisplayStartMins = timeToMinutes(pendingDisplayStartTime)
    const pendingDisplayEndMins = timeToMinutes(pendingDisplayEndTime)
    const pendingDisplayTop = (pendingDisplayStartMins - startHour * 60) * PIXELS_PER_MINUTE
    const pendingDisplayHeight = Math.max((pendingDisplayEndMins - pendingDisplayStartMins) * PIXELS_PER_MINUTE, MIN_BLOCK_HEIGHT)
    const pendingDisplayDuration = pendingDisplayEndMins - pendingDisplayStartMins
    const hasTimes = !entry.isEstimated

    return (
      <div
        key={entry.id}
        data-entry-block
        data-pending
        onMouseDown={hasTimes ? (e) => onMouseDown(e, entry) : undefined}
        onTouchStart={hasTimes ? (e) => onTouchStart(e, entry) : undefined}
        onClick={!hasTimes ? (e) => {
          e.stopPropagation()
          onClick?.(entry)
        } : undefined}
        className={`absolute left-1 right-1 overflow-hidden rounded-lg border-2 border-dashed transition-all ${
          pendingIsBeingAdjusted
            ? 'z-30 shadow-xl ring-2 ring-primary/50 opacity-80'
            : 'hover:opacity-80 opacity-60'
        } ${
          isReadyToConfirm
            ? 'border-[#B5A07A]/80 bg-[#B5A07A]/50 dark:border-[#B5A07A]/60 dark:bg-[#B5A07A]/30'
            : 'border-zinc-400/60 bg-zinc-100/50 dark:border-zinc-500/40 dark:bg-zinc-700/30'
        } ${hasTimes ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
        style={{ top: pendingDisplayTop, height: pendingDisplayHeight }}
      >
        <div className={`flex h-full flex-col justify-center px-2 py-1 ${isReadyToConfirm ? 'text-[#B5A07A] dark:text-[#CBB894]' : 'text-zinc-600 dark:text-zinc-300'}`}>
          {isShort ? (
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 truncate text-xs font-medium">
                <Clock className="h-3 w-3 shrink-0" />
                {entry.activity}
              </span>
            </div>
          ) : (
            <>
              <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                {entry.activity}
              </span>
              <div className="mt-0.5 flex items-center gap-2 text-xs opacity-80">
                <span>{formatTimeDisplay(pendingDisplayStartTime)} - {formatTimeDisplay(pendingDisplayEndTime)}</span>
                <span>({pendingIsBeingAdjusted ? formatDuration(pendingDisplayDuration) : formatDuration(entry.duration_minutes)})</span>
              </div>
              {height > 70 && !pendingIsBeingAdjusted && (
                <span className="mt-1 text-xs font-medium">
                  {isReadyToConfirm ? 'Ready to confirm' : 'Planned'}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // Check if this entry is being adjusted
  const isBeingAdjusted = adjustPreview?.entryId === entry.id
  const displayStartTime = isBeingAdjusted ? adjustPreview.startTime : entry.placedStartTime
  const displayEndTime = isBeingAdjusted ? adjustPreview.endTime : entry.placedEndTime
  const displayStartMins = timeToMinutes(displayStartTime)
  const displayEndMins = timeToMinutes(displayEndTime)
  const displayTop = (displayStartMins - startHour * 60) * PIXELS_PER_MINUTE
  const displayHeight = Math.max((displayEndMins - displayStartMins) * PIXELS_PER_MINUTE, MIN_BLOCK_HEIGHT)
  const displayDuration = displayEndMins - displayStartMins

  // Check if this entry overlaps with a ghost (for side-by-side layout)
  const entryHasOverlap = overlappingEntryIds.has(entry.id)

  // Confirmed entries - normal rendering with drag-to-adjust
  return (
    <div
      key={entry.id}
      data-entry-block
      onMouseDown={(e) => onMouseDown(e, entry)}
      onTouchStart={(e) => onTouchStart(e, entry)}
      className={`absolute overflow-hidden rounded-xl border-l-4 shadow-sm transition-all ${
        isBeingAdjusted
          ? 'z-30 shadow-xl ring-2 ring-zinc-400/50 dark:ring-zinc-500/50'
          : 'hover:shadow-md'
      } ${colors.bg} ${colors.border} ${entry.isEstimated ? 'opacity-70 cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
      style={{
        top: displayTop,
        height: displayHeight,
        left: '4px',
        right: entryHasOverlap ? '50%' : '4px',
      }}
    >
      <div className={`flex h-full flex-col justify-center px-2 py-1 ${colors.text}`}>
        {isShort ? (
          <div className="flex items-center gap-2">
            <span className="truncate text-xs font-medium">
              {entry.isEstimated && <span className="opacity-70">~</span>}
              {entry.activity}
            </span>
          </div>
        ) : (
          <>
            <span className="flex items-center gap-1 truncate text-sm font-medium">
              {entry.isEstimated && (
                <span className="rounded bg-white/20 px-1 text-[10px] font-normal">est</span>
              )}
              {entry.activity}
            </span>
            <div className="mt-0.5 flex items-center gap-2 text-xs opacity-80">
              <span>
                {entry.isEstimated ? '~' : ''}{formatTimeDisplay(displayStartTime)} - {formatTimeDisplay(displayEndTime)}
              </span>
              <span>({isBeingAdjusted ? formatDuration(displayDuration) : formatDuration(entry.duration_minutes)})</span>
            </div>
            {entry.description && height > 70 && !isBeingAdjusted && (
              <span className="mt-1 truncate text-xs opacity-70">{entry.description}</span>
            )}
          </>
        )}
      </div>

      {/* Bottom resize handle — subtle bar to hint at drag-to-adjust */}
      {!entry.isEstimated && (
        <div className="absolute inset-x-0 bottom-0 h-3 flex items-center justify-center cursor-ns-resize">
          <div className="h-[2px] w-10 rounded-full bg-current opacity-15" />
        </div>
      )}
    </div>
  )
}