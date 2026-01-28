import { useState, useRef, useEffect, useCallback } from 'react'
import { timeToMinutes, minutesToTime } from '@/lib/time-utils'
import { CalendarEvent } from '@/components/TimelineView'

export interface DragCreateData {
  startTime: string
  endTime: string
}

export interface UseGhostEventsParams {
  scrollContainerRef: React.RefObject<HTMLDivElement>
  startHour: number
  onGhostEntryClick?: (event: CalendarEvent) => void
  onDragCreate?: (data: DragCreateData) => void
  yToTime: (clientY: number) => string
  setIsDragging: (dragging: boolean) => void
  setDragPreviewStart: (time: string | null) => void
  setDragPreviewEnd: (time: string | null) => void
  setIsTouchDragging: (dragging: boolean) => void
  setTouchDragPreviewStart: (time: string | null) => void
  setTouchDragPreviewEnd: (time: string | null) => void
  dragDataRef: React.MutableRefObject<{
    startTime: string
    endTime: string
    startY: number
    hasMoved: boolean
  } | null>
  touchDataRef: React.MutableRefObject<{
    startTime: string
    endTime: string
    startY: number
    startClientY: number
    hasMoved: boolean
    isStillnessConfirmed: boolean
    isHoldConfirmed: boolean
  } | null>
}

export interface UseGhostEventsReturn {
  dismissedEventIds: Set<string>
  showDismissed: boolean
  setShowDismissed: (show: boolean) => void
  dismissGhostEvent: (eventId: string) => void
  restoreAllDismissed: () => void
  handleGhostMouseDown: (e: React.MouseEvent, event: CalendarEvent) => void
  handleGhostTouchStart: (e: React.TouchEvent, event: CalendarEvent) => void
}

const GHOST_TAP_THRESHOLD = 150 // ms - release before this = tap to confirm
const DRAG_THRESHOLD = 20 // pixels - minimum drag distance to count as intentional drag

export function useGhostEvents({
  scrollContainerRef,
  startHour,
  onGhostEntryClick,
  onDragCreate,
  yToTime,
  setIsDragging,
  setDragPreviewStart,
  setDragPreviewEnd,
  setIsTouchDragging,
  setTouchDragPreviewStart,
  setTouchDragPreviewEnd,
  dragDataRef,
  touchDataRef,
}: UseGhostEventsParams): UseGhostEventsReturn {
  // Dismissed ghost events (hidden from view)
  const [dismissedEventIds, setDismissedEventIds] = useState<Set<string>>(new Set())
  const [showDismissed, setShowDismissed] = useState(false)

  // Ghost event interaction tracking (tap vs hold+drag)
  const ghostInteractionRef = useRef<{
    eventId: string
    event: CalendarEvent
    startY: number
    startClientY: number
    isTouch: boolean
    hasMoved: boolean
    tapTimerFired: boolean
  } | null>(null)
  const ghostTapTimerRef = useRef<NodeJS.Timeout | null>(null)

  const dismissGhostEvent = useCallback((eventId: string) => {
    setDismissedEventIds(prev => new Set(prev).add(eventId))
  }, [])

  const restoreAllDismissed = useCallback(() => {
    setDismissedEventIds(new Set())
    setShowDismissed(false)
  }, [])

  // GHOST EVENT: Mouse down handler - detect tap vs hold+drag
  const handleGhostMouseDown = useCallback((e: React.MouseEvent, event: CalendarEvent) => {
    if (e.button !== 0) return // Only left click
    e.stopPropagation() // Don't trigger grid mousedown yet

    const time = yToTime(e.clientY)

    ghostInteractionRef.current = {
      eventId: event.id,
      event,
      startY: e.clientY,
      startClientY: e.clientY,
      isTouch: false,
      hasMoved: false,
      tapTimerFired: false
    }

    // Start timer - if it fires, user is holding (potential drag)
    ghostTapTimerRef.current = setTimeout(() => {
      if (ghostInteractionRef.current && !ghostInteractionRef.current.hasMoved) {
        ghostInteractionRef.current.tapTimerFired = true
        // Start drag-to-create mode
        dragDataRef.current = {
          startTime: time,
          endTime: time,
          startY: e.clientY,
          hasMoved: false
        }
        setIsDragging(true)
        setDragPreviewStart(time)
        setDragPreviewEnd(minutesToTime(timeToMinutes(time) + 30))
      }
    }, GHOST_TAP_THRESHOLD)
  }, [yToTime, setIsDragging, setDragPreviewStart, setDragPreviewEnd, dragDataRef])

  // GHOST EVENT: Touch start handler
  const handleGhostTouchStart = useCallback((e: React.TouchEvent, event: CalendarEvent) => {
    e.stopPropagation() // Don't trigger grid touchstart yet

    const touch = e.touches[0]
    const time = yToTime(touch.clientY)

    ghostInteractionRef.current = {
      eventId: event.id,
      event,
      startY: touch.clientY,
      startClientY: touch.clientY,
      isTouch: true,
      hasMoved: false,
      tapTimerFired: false
    }

    // Start timer - if it fires, user is holding (potential drag)
    ghostTapTimerRef.current = setTimeout(() => {
      if (ghostInteractionRef.current && !ghostInteractionRef.current.hasMoved) {
        ghostInteractionRef.current.tapTimerFired = true
        // Start touch drag-to-create mode
        touchDataRef.current = {
          startTime: time,
          endTime: time,
          startY: touch.clientY,
          startClientY: touch.clientY,
          hasMoved: false,
          isStillnessConfirmed: true,
          isHoldConfirmed: true
        }
        setIsTouchDragging(true)
        setTouchDragPreviewStart(time)
        setTouchDragPreviewEnd(minutesToTime(timeToMinutes(time) + 30))

        // Haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate(50)
        }
      }
    }, GHOST_TAP_THRESHOLD)
  }, [yToTime, setIsTouchDragging, setTouchDragPreviewStart, setTouchDragPreviewEnd, touchDataRef])

  // GHOST EVENT: Mouse/touch move and up handlers
  // These listeners are always active and check if there's an active ghost interaction
  useEffect(() => {
    const handleGhostMouseMove = (e: MouseEvent) => {
      if (!ghostInteractionRef.current || ghostInteractionRef.current.isTouch) return

      const deltaY = Math.abs(e.clientY - ghostInteractionRef.current.startClientY)
      if (deltaY > DRAG_THRESHOLD) {
        ghostInteractionRef.current.hasMoved = true

        // If timer hasn't fired yet but user moved, cancel timer and start drag immediately
        if (!ghostInteractionRef.current.tapTimerFired) {
          if (ghostTapTimerRef.current) {
            clearTimeout(ghostTapTimerRef.current)
            ghostTapTimerRef.current = null
          }

          const time = yToTime(ghostInteractionRef.current.startClientY)
          dragDataRef.current = {
            startTime: time,
            endTime: yToTime(e.clientY),
            startY: ghostInteractionRef.current.startClientY,
            hasMoved: true
          }
          setIsDragging(true)
          setDragPreviewStart(time)
          setDragPreviewEnd(yToTime(e.clientY))
          ghostInteractionRef.current.tapTimerFired = true // Prevent double-start
        }
      }
    }

    const handleGhostMouseUp = () => {
      if (!ghostInteractionRef.current || ghostInteractionRef.current.isTouch) return

      // Clear timer
      if (ghostTapTimerRef.current) {
        clearTimeout(ghostTapTimerRef.current)
        ghostTapTimerRef.current = null
      }

      const { event, hasMoved, tapTimerFired } = ghostInteractionRef.current

      // If timer didn't fire and user didn't move much = tap = open confirm modal
      if (!tapTimerFired && !hasMoved) {
        onGhostEntryClick?.(event)
      }
      // If drag started, the regular drag mouseup handler will handle it

      ghostInteractionRef.current = null
    }

    const handleGhostTouchMove = (e: TouchEvent) => {
      if (!ghostInteractionRef.current || !ghostInteractionRef.current.isTouch) return

      const touch = e.touches[0]
      const deltaY = Math.abs(touch.clientY - ghostInteractionRef.current.startClientY)

      if (deltaY > 5) { // SCROLL_CANCEL_THRESHOLD
        ghostInteractionRef.current.hasMoved = true

        // If timer hasn't fired yet but user moved, they're scrolling - cancel
        if (!ghostInteractionRef.current.tapTimerFired) {
          if (ghostTapTimerRef.current) {
            clearTimeout(ghostTapTimerRef.current)
            ghostTapTimerRef.current = null
          }
          // Let scroll happen naturally
          ghostInteractionRef.current = null
        }
      }
    }

    const handleGhostTouchEnd = () => {
      if (!ghostInteractionRef.current || !ghostInteractionRef.current.isTouch) return

      // Clear timer
      if (ghostTapTimerRef.current) {
        clearTimeout(ghostTapTimerRef.current)
        ghostTapTimerRef.current = null
      }

      const { event, hasMoved, tapTimerFired } = ghostInteractionRef.current

      // If timer didn't fire and user didn't move much = tap = open confirm modal
      if (!tapTimerFired && !hasMoved) {
        onGhostEntryClick?.(event)
      }
      // If drag started, the regular touch drag handler will handle it

      ghostInteractionRef.current = null
    }

    window.addEventListener('mousemove', handleGhostMouseMove)
    window.addEventListener('mouseup', handleGhostMouseUp)
    window.addEventListener('touchmove', handleGhostTouchMove, { passive: true })
    window.addEventListener('touchend', handleGhostTouchEnd)

    return () => {
      window.removeEventListener('mousemove', handleGhostMouseMove)
      window.removeEventListener('mouseup', handleGhostMouseUp)
      window.removeEventListener('touchmove', handleGhostTouchMove)
      window.removeEventListener('touchend', handleGhostTouchEnd)
    }
  }, [onGhostEntryClick, yToTime, setIsDragging, setDragPreviewStart, setDragPreviewEnd, setIsTouchDragging, setTouchDragPreviewStart, setTouchDragPreviewEnd, dragDataRef, touchDataRef])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (ghostTapTimerRef.current) {
        clearTimeout(ghostTapTimerRef.current)
      }
    }
  }, [])

  // Cancel ghost interaction function
  const cancelGhostInteraction = useCallback(() => {
    // Clear ghost interaction state
    if (ghostTapTimerRef.current) {
      clearTimeout(ghostTapTimerRef.current)
      ghostTapTimerRef.current = null
    }
    ghostInteractionRef.current = null
  }, [])

  // Escape key to cancel ghost interaction
  useEffect(() => {
    if (!ghostInteractionRef.current) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancelGhostInteraction()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [ghostInteractionRef.current !== null, cancelGhostInteraction])

  return {
    dismissedEventIds,
    showDismissed,
    setShowDismissed,
    dismissGhostEvent,
    restoreAllDismissed,
    handleGhostMouseDown,
    handleGhostTouchStart,
  }
}