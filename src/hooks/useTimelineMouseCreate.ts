import { useState, useRef, useEffect, useCallback } from 'react'
import { timeToMinutes, minutesToTime } from '@/lib/time-utils'

export interface DragCreateData {
  startTime: string
  endTime: string
}

export interface UseTimelineMouseCreateParams {
  scrollContainerRef: React.RefObject<HTMLDivElement>
  startHour: number
  onDragCreate?: (data: DragCreateData) => void
  yToTime: (clientY: number) => string
}

export interface UseTimelineMouseCreateReturn {
  isDragging: boolean
  dragPreviewStart: string | null
  dragPreviewEnd: string | null
  handleMouseDown: (e: React.MouseEvent) => void
}

const DRAG_THRESHOLD = 20 // pixels - minimum drag distance to count as intentional drag
import { PIXELS_PER_MINUTE } from '@/components/timeline/constants'

export function useTimelineMouseCreate({
  scrollContainerRef,
  startHour,
  onDragCreate,
  yToTime,
}: UseTimelineMouseCreateParams): UseTimelineMouseCreateReturn {
  const [isDragging, setIsDragging] = useState(false)
  const [dragPreviewStart, setDragPreviewStart] = useState<string | null>(null)
  const [dragPreviewEnd, setDragPreviewEnd] = useState<string | null>(null)

  // Use refs for tracking during drag to avoid stale closure issues
  const dragDataRef = useRef<{
    startTime: string
    endTime: string
    startY: number
    hasMoved: boolean
  } | null>(null)

  // MOUSE DOWN: Start drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only handle left click
    if (e.button !== 0) return

    // Don't start drag on existing entries, ghost blocks, or gap blocks
    const target = e.target as HTMLElement
    if (target.closest('[data-entry-block]') || target.closest('[data-ghost-block]') || target.closest('[data-gap-block]')) {
      return
    }

    // Allow drag on ALL days (past, today, future)
    if (!onDragCreate) {
      return
    }

    const time = yToTime(e.clientY)

    // Initialize drag data in ref
    dragDataRef.current = {
      startTime: time,
      endTime: time,
      startY: e.clientY,
      hasMoved: false
    }

    setIsDragging(true)
    setDragPreviewStart(time)
    setDragPreviewEnd(minutesToTime(timeToMinutes(time) + 30)) // Show 30-min preview initially
  }, [yToTime, onDragCreate])

  // MOUSE MOVE and MOUSE UP handlers
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragDataRef.current) return

      const deltaY = Math.abs(e.clientY - dragDataRef.current.startY)

      // Check if user has moved beyond threshold
      if (deltaY > DRAG_THRESHOLD) {
        dragDataRef.current.hasMoved = true

        // Calculate the current time at mouse position
        const currentTime = yToTime(e.clientY)
        dragDataRef.current.endTime = currentTime

        // Update preview - handle dragging up or down
        const startMins = timeToMinutes(dragDataRef.current.startTime)
        const endMins = timeToMinutes(currentTime)

        if (endMins >= startMins) {
          // Dragging down - start stays, end moves
          setDragPreviewStart(dragDataRef.current.startTime)
          setDragPreviewEnd(currentTime)
        } else {
          // Dragging up - swap for preview
          setDragPreviewStart(currentTime)
          setDragPreviewEnd(dragDataRef.current.startTime)
        }
      }
    }

    const handleMouseUp = () => {
      if (!dragDataRef.current) return

      const { startTime, endTime, hasMoved } = dragDataRef.current

      let finalStart: string
      let finalEnd: string

      if (hasMoved) {
        // User actually dragged - use the dragged range
        const startMins = timeToMinutes(startTime)
        const endMins = timeToMinutes(endTime)

        if (endMins >= startMins) {
          finalStart = startTime
          finalEnd = endTime
        } else {
          // Dragged upward - swap
          finalStart = endTime
          finalEnd = startTime
        }

        // Ensure minimum 15-minute duration for drags
        const duration = timeToMinutes(finalEnd) - timeToMinutes(finalStart)
        if (duration < 15) {
          finalEnd = minutesToTime(timeToMinutes(finalStart) + 15)
        }
      } else {
        // User just clicked - default to 30-minute duration
        finalStart = startTime
        finalEnd = minutesToTime(timeToMinutes(startTime) + 30)
      }

      // Call the callback to open Quick Log modal
      if (onDragCreate) {
        onDragCreate({ startTime: finalStart, endTime: finalEnd })
      }

      // Reset drag state
      dragDataRef.current = null
      setIsDragging(false)
      setDragPreviewStart(null)
      setDragPreviewEnd(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, onDragCreate, yToTime])

  // Cancel drag function - resets all drag state without creating entry
  const cancelDrag = useCallback(() => {
    dragDataRef.current = null
    setIsDragging(false)
    setDragPreviewStart(null)
    setDragPreviewEnd(null)
  }, [])

  // Escape key to cancel drag
  useEffect(() => {
    if (!isDragging) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancelDrag()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isDragging, cancelDrag])

  return {
    isDragging,
    dragPreviewStart,
    dragPreviewEnd,
    handleMouseDown,
  }
}