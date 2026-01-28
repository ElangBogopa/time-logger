import { useState, useRef, useEffect, useCallback } from 'react'
import { timeToMinutes, minutesToTime } from '@/lib/time-utils'

export interface DragCreateData {
  startTime: string
  endTime: string
}

export interface UseTimelineTouchCreateParams {
  scrollContainerRef: React.RefObject<HTMLDivElement>
  startHour: number
  onDragCreate?: (data: DragCreateData) => void
  yToTime: (clientY: number) => string
}

export interface UseTimelineTouchCreateReturn {
  isTouchActive: boolean
  isTouchDragging: boolean
  touchDragPreviewStart: string | null
  touchDragPreviewEnd: string | null
  handleTouchStart: (e: React.TouchEvent) => void
}

const DRAG_THRESHOLD = 20 // pixels - minimum drag distance to count as intentional drag (after hold confirmed)
const SCROLL_CANCEL_THRESHOLD = 5 // pixels - ANY movement this much means user is scrolling
const STILLNESS_CHECK_DELAY = 100 // ms - must be still this long before hold timer even starts
const TOUCH_HOLD_DELAY = 400 // ms - after stillness confirmed, hold this long to create entry

export function useTimelineTouchCreate({
  scrollContainerRef,
  startHour,
  onDragCreate,
  yToTime,
}: UseTimelineTouchCreateParams): UseTimelineTouchCreateReturn {
  // Touch-specific state
  const [isTouchActive, setIsTouchActive] = useState(false) // Track when any touch interaction is happening
  const [isTouchDragging, setIsTouchDragging] = useState(false)
  const [touchDragPreviewStart, setTouchDragPreviewStart] = useState<string | null>(null)
  const [touchDragPreviewEnd, setTouchDragPreviewEnd] = useState<string | null>(null)

  const touchStillnessTimerRef = useRef<NodeJS.Timeout | null>(null)
  const touchHoldTimerRef = useRef<NodeJS.Timeout | null>(null)
  const touchDataRef = useRef<{
    startTime: string
    endTime: string
    startY: number
    startClientY: number
    hasMoved: boolean
    isStillnessConfirmed: boolean
    isHoldConfirmed: boolean
  } | null>(null)

  // TOUCH START: Begin touch tracking with stillness check, then hold delay
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Don't start drag on existing entries, ghost blocks, or gap blocks
    const target = e.target as HTMLElement
    if (target.closest('[data-entry-block]') || target.closest('[data-ghost-block]') || target.closest('[data-gap-block]')) {
      return
    }

    // Allow drag on ALL days (past, today, future)
    if (!onDragCreate) {
      return
    }

    const touch = e.touches[0]
    const time = yToTime(touch.clientY)

    // Initialize touch data
    touchDataRef.current = {
      startTime: time,
      endTime: time,
      startY: touch.clientY,
      startClientY: touch.clientY,
      hasMoved: false,
      isStillnessConfirmed: false,
      isHoldConfirmed: false
    }

    // Mark touch as active so the useEffect adds listeners
    setIsTouchActive(true)

    // Phase 1: Check if user stays still for STILLNESS_CHECK_DELAY
    // If they move during this time, they're scrolling - abort everything
    touchStillnessTimerRef.current = setTimeout(() => {
      if (touchDataRef.current && !touchDataRef.current.hasMoved) {
        // User stayed still - now start the actual hold timer
        touchDataRef.current.isStillnessConfirmed = true

        // Phase 2: Hold timer - if they continue holding, enter drag mode
        touchHoldTimerRef.current = setTimeout(() => {
          if (touchDataRef.current && !touchDataRef.current.hasMoved) {
            touchDataRef.current.isHoldConfirmed = true
            setIsTouchDragging(true)
            setTouchDragPreviewStart(touchDataRef.current.startTime)
            setTouchDragPreviewEnd(minutesToTime(timeToMinutes(touchDataRef.current.startTime) + 30))

            // Haptic feedback if supported
            if (navigator.vibrate) {
              navigator.vibrate(50)
            }
          }
        }, TOUCH_HOLD_DELAY)
      }
    }, STILLNESS_CHECK_DELAY)
  }, [yToTime, onDragCreate])

  // TOUCH MOVE and TOUCH END handlers
  useEffect(() => {
    // Only add listeners when touch is active (either tracking or dragging)
    if (!isTouchActive && !isTouchDragging) return

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchDataRef.current) return

      const touch = e.touches[0]
      const deltaY = Math.abs(touch.clientY - touchDataRef.current.startClientY)

      // If user moved before hold was confirmed, cancel all timers and let scroll happen
      if (!touchDataRef.current.isHoldConfirmed) {
        if (deltaY > SCROLL_CANCEL_THRESHOLD) {
          // User is scrolling - cancel both timers immediately
          if (touchStillnessTimerRef.current) {
            clearTimeout(touchStillnessTimerRef.current)
            touchStillnessTimerRef.current = null
          }
          if (touchHoldTimerRef.current) {
            clearTimeout(touchHoldTimerRef.current)
            touchHoldTimerRef.current = null
          }
          touchDataRef.current.hasMoved = true
        }
        return // Let default scroll happen
      }

      // Hold was confirmed - this is a drag-to-create operation
      e.preventDefault() // Prevent scrolling

      touchDataRef.current.hasMoved = true

      // Calculate the current time at touch position
      const currentTime = yToTime(touch.clientY)
      touchDataRef.current.endTime = currentTime

      // Update preview - handle dragging up or down
      const startMins = timeToMinutes(touchDataRef.current.startTime)
      const endMins = timeToMinutes(currentTime)

      if (endMins >= startMins) {
        setTouchDragPreviewStart(touchDataRef.current.startTime)
        setTouchDragPreviewEnd(currentTime)
      } else {
        setTouchDragPreviewStart(currentTime)
        setTouchDragPreviewEnd(touchDataRef.current.startTime)
      }
    }

    const handleTouchEnd = () => {
      // Clear both timers
      if (touchStillnessTimerRef.current) {
        clearTimeout(touchStillnessTimerRef.current)
        touchStillnessTimerRef.current = null
      }
      if (touchHoldTimerRef.current) {
        clearTimeout(touchHoldTimerRef.current)
        touchHoldTimerRef.current = null
      }

      if (!touchDataRef.current) return

      const { startTime, endTime, isHoldConfirmed, hasMoved } = touchDataRef.current

      // Only create entry if hold was confirmed (user held long enough to enter drag mode)
      if (isHoldConfirmed) {
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
          // User just held (didn't drag) - default to 30-minute duration
          finalStart = startTime
          finalEnd = minutesToTime(timeToMinutes(startTime) + 30)
        }

        // Call the callback to open Quick Log modal
        if (onDragCreate) {
          onDragCreate({ startTime: finalStart, endTime: finalEnd })
        }
      }

      // Reset touch state
      touchDataRef.current = null
      setIsTouchActive(false)
      setIsTouchDragging(false)
      setTouchDragPreviewStart(null)
      setTouchDragPreviewEnd(null)
    }

    const handleTouchCancel = () => {
      // Clear both timers
      if (touchStillnessTimerRef.current) {
        clearTimeout(touchStillnessTimerRef.current)
        touchStillnessTimerRef.current = null
      }
      if (touchHoldTimerRef.current) {
        clearTimeout(touchHoldTimerRef.current)
        touchHoldTimerRef.current = null
      }

      // Reset touch state
      touchDataRef.current = null
      setIsTouchActive(false)
      setIsTouchDragging(false)
      setTouchDragPreviewStart(null)
      setTouchDragPreviewEnd(null)
    }

    // Use passive: false for touchmove to allow preventDefault
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)
    window.addEventListener('touchcancel', handleTouchCancel)

    return () => {
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchCancel)
    }
  }, [isTouchActive, isTouchDragging, onDragCreate, yToTime])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (touchStillnessTimerRef.current) {
        clearTimeout(touchStillnessTimerRef.current)
      }
      if (touchHoldTimerRef.current) {
        clearTimeout(touchHoldTimerRef.current)
      }
    }
  }, [])

  // Cancel drag function - resets all drag state without creating entry
  const cancelDrag = useCallback(() => {
    // Clear touch drag state
    if (touchStillnessTimerRef.current) {
      clearTimeout(touchStillnessTimerRef.current)
      touchStillnessTimerRef.current = null
    }
    if (touchHoldTimerRef.current) {
      clearTimeout(touchHoldTimerRef.current)
      touchHoldTimerRef.current = null
    }
    touchDataRef.current = null
    setIsTouchActive(false)
    setIsTouchDragging(false)
    setTouchDragPreviewStart(null)
    setTouchDragPreviewEnd(null)
  }, [])

  // Escape key to cancel drag
  useEffect(() => {
    if (!isTouchDragging) return

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
  }, [isTouchDragging, cancelDrag])

  return {
    isTouchActive,
    isTouchDragging,
    touchDragPreviewStart,
    touchDragPreviewEnd,
    handleTouchStart,
  }
}