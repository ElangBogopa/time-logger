import { timeToMinutes, minutesToTime, formatTimeDisplay, formatDuration } from '@/lib/time-utils'
import { MIN_BLOCK_HEIGHT, PIXELS_PER_MINUTE } from './constants'

interface DragPreviewProps {
  startTime: string
  endTime: string | null
  startHour: number
  isDragging: boolean
  isTouchDragging: boolean
}

export function DragPreview({ startTime, endTime, startHour, isDragging, isTouchDragging }: DragPreviewProps) {
  // Show preview for either mouse or touch dragging
  if ((!isDragging && !isTouchDragging) || !startTime) {
    return null
  }

  let previewStart = startTime
  let previewEnd = endTime || startTime

  // Check if user has dragged beyond threshold (different start/end times)
  const hasDraggedBeyondThreshold = endTime && endTime !== startTime

  // Swap if dragged upward
  if (timeToMinutes(previewEnd) < timeToMinutes(previewStart)) {
    const temp = previewStart
    previewStart = previewEnd
    previewEnd = temp
  }

  // Calculate duration
  const startMins = timeToMinutes(previewStart)
  let endMins = timeToMinutes(previewEnd)

  // If just clicked (not dragged), show 30-min preview; if dragged, ensure at least 15 min
  if (!hasDraggedBeyondThreshold) {
    endMins = startMins + 30
    previewEnd = minutesToTime(endMins)
  } else if (endMins - startMins < 15) {
    endMins = startMins + 15
    previewEnd = minutesToTime(endMins)
  }

  const top = (startMins - startHour * 60) * PIXELS_PER_MINUTE
  const height = (endMins - startMins) * PIXELS_PER_MINUTE
  const duration = endMins - startMins

  return (
    <div
      className="absolute left-1 right-1 z-20 overflow-hidden rounded-xl border border-[#6B8CAE]/50 bg-[#6B8CAE]/20 backdrop-blur-sm shadow-sm pointer-events-none transition-all duration-75"
      style={{ top, height: Math.max(height, MIN_BLOCK_HEIGHT) }}
    >
      <div className="flex h-full flex-col items-center justify-center px-2 py-1 text-[#6B8CAE]">
        <span className="text-sm font-medium">
          {formatTimeDisplay(previewStart)} - {formatTimeDisplay(previewEnd)}
        </span>
        <span className="text-xs opacity-80">
          {formatDuration(duration)}
        </span>
      </div>
    </div>
  )
}