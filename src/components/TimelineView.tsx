'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { TimeEntry, TimeCategory, isPendingEntryReadyToConfirm } from '@/lib/types'
import { formatDuration, formatHour, timeToMinutes, minutesToTime, formatTimeDisplay } from '@/lib/time-utils'
import TimeEntryModal from './TimeEntryModal'
import { Clock, X, Eye } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'

export interface CalendarEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  date: string
  isAllDay: boolean
}

export interface DragCreateData {
  startTime: string
  endTime: string
}

interface TimelineViewProps {
  entries: TimeEntry[]
  calendarEvents?: CalendarEvent[]
  isLoading: boolean
  onEntryDeleted: () => void
  onGhostEntryClick?: (event: CalendarEvent) => void
  onDragCreate?: (data: DragCreateData) => void
  onShowToast?: (message: string) => void
  selectedDate?: string
  isToday?: boolean
  isFutureDay?: boolean
  isPastDay?: boolean
  canLog?: boolean
}

const PIXELS_PER_MINUTE = 1.5
const HOUR_HEIGHT = 60 * PIXELS_PER_MINUTE // 90px per hour
const MIN_BLOCK_HEIGHT = 24 // Minimum height for very short entries

const CATEGORY_COLORS: Record<TimeCategory, { bg: string; border: string; text: string }> = {
  deep_work: { bg: 'bg-[#64748b]', border: 'border-[#475569]', text: 'text-white' },
  meetings: { bg: 'bg-[#8b7aa8]', border: 'border-[#6b5a88]', text: 'text-white' },
  admin: { bg: 'bg-[#9ca3af]', border: 'border-[#6b7280]', text: 'text-white' },
  learning: { bg: 'bg-[#5d9a9a]', border: 'border-[#4a7a7a]', text: 'text-white' },
  exercise: { bg: 'bg-[#6b9080]', border: 'border-[#4a6b5a]', text: 'text-white' },
  rest: { bg: 'bg-[#a8a4ce]', border: 'border-[#8884ae]', text: 'text-zinc-800' },
  meals: { bg: 'bg-[#b8a088]', border: 'border-[#98806a]', text: 'text-zinc-800' },
  self_care: { bg: 'bg-[#8fa387]', border: 'border-[#6f8367]', text: 'text-white' },
  relationships: { bg: 'bg-[#b08d8d]', border: 'border-[#906d6d]', text: 'text-white' },
  distraction: { bg: 'bg-[#c97e7e]', border: 'border-[#a95e5e]', text: 'text-white' },
  other: { bg: 'bg-[#71717a]', border: 'border-[#52525b]', text: 'text-white' },
}

interface PlacedEntry extends TimeEntry {
  placedStartTime: string
  placedEndTime: string
  isEstimated: boolean
}

// Find gaps in the timeline where untimed entries could fit
function findGaps(timedEntries: TimeEntry[], startHour: number, endHour: number): { start: number; end: number }[] {
  const gaps: { start: number; end: number }[] = []
  const startMinutes = startHour * 60
  const endMinutes = endHour * 60

  const sorted = [...timedEntries]
    .filter(e => e.start_time)
    .sort((a, b) => timeToMinutes(a.start_time!) - timeToMinutes(b.start_time!))

  let lastEnd = startMinutes

  for (const entry of sorted) {
    const entryStart = timeToMinutes(entry.start_time!)
    if (entryStart > lastEnd) {
      gaps.push({ start: lastEnd, end: entryStart })
    }
    const entryEnd = entry.end_time ? timeToMinutes(entry.end_time) : entryStart + entry.duration_minutes
    lastEnd = Math.max(lastEnd, entryEnd)
  }

  if (lastEnd < endMinutes) {
    gaps.push({ start: lastEnd, end: endMinutes })
  }

  return gaps
}

// Smart place untimed entries in gaps or at the start
function smartPlaceEntries(
  timedEntries: TimeEntry[],
  untimedEntries: TimeEntry[],
  startHour: number,
  endHour: number
): PlacedEntry[] {
  const placed: PlacedEntry[] = []

  for (const entry of timedEntries) {
    placed.push({
      ...entry,
      placedStartTime: entry.start_time!,
      placedEndTime: entry.end_time!,
      isEstimated: false,
    })
  }

  if (untimedEntries.length === 0) return placed

  const gaps = findGaps(timedEntries, startHour, endHour)

  let gapIndex = 0
  let currentGapOffset = 0

  for (const entry of untimedEntries) {
    let placedStart: number | null = null

    while (gapIndex < gaps.length) {
      const gap = gaps[gapIndex]
      const availableSpace = gap.end - gap.start - currentGapOffset

      if (availableSpace >= entry.duration_minutes) {
        placedStart = gap.start + currentGapOffset
        currentGapOffset += entry.duration_minutes
        break
      } else {
        gapIndex++
        currentGapOffset = 0
      }
    }

    if (placedStart === null) {
      const firstTimedStart = timedEntries.length > 0 && timedEntries[0].start_time
        ? Math.min(...timedEntries.filter(e => e.start_time).map(e => timeToMinutes(e.start_time!)))
        : startHour * 60 + 60

      const alreadyPlacedBefore = placed.filter(p => p.isEstimated && timeToMinutes(p.placedStartTime) < firstTimedStart)
      const usedMinutes = alreadyPlacedBefore.reduce((sum, p) => sum + p.duration_minutes, 0)

      placedStart = Math.max(startHour * 60, firstTimedStart - usedMinutes - entry.duration_minutes)
    }

    const placedEnd = placedStart + entry.duration_minutes

    placed.push({
      ...entry,
      placedStartTime: minutesToTime(placedStart),
      placedEndTime: minutesToTime(placedEnd),
      isEstimated: true,
    })
  }

  return placed
}

export default function TimelineView({
  entries,
  calendarEvents = [],
  isLoading,
  onEntryDeleted,
  onGhostEntryClick,
  onDragCreate,
  onShowToast,
  isToday = true,
  isFutureDay = false,
  isPastDay = false,
  canLog = true
}: TimelineViewProps) {
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null)
  const [promptAddTimes, setPromptAddTimes] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const timelineGridRef = useRef<HTMLDivElement>(null)

  // Memoize total minutes calculation
  const totalMinutes = useMemo(() => {
    return entries.reduce((sum, entry) => sum + entry.duration_minutes, 0)
  }, [entries])

  // Simple drag state for creating new entries
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

  // Touch-specific state
  const [isTouchDragging, setIsTouchDragging] = useState(false)
  const touchHoldTimerRef = useRef<NodeJS.Timeout | null>(null)
  const touchDataRef = useRef<{
    startTime: string
    endTime: string
    startY: number
    startClientY: number
    hasMoved: boolean
    isHoldConfirmed: boolean
  } | null>(null)

  const DRAG_THRESHOLD = 10 // pixels - if moved less than this, treat as click
  const TOUCH_HOLD_DELAY = 500 // ms - hold this long before treating as drag-to-create
  const GHOST_TAP_THRESHOLD = 150 // ms - release before this = tap to confirm
  const ENTRY_EDGE_ZONE = 0.2 // 20% of entry height for resize zones
  const ENTRY_HOLD_DELAY = 200 // ms - hold before moving entry (touch only)

  // Entry adjustment state (move or resize existing entries)
  type EntryDragType = 'move' | 'resize-top' | 'resize-bottom'
  const [isAdjustingEntry, setIsAdjustingEntry] = useState(false)
  const [adjustPreview, setAdjustPreview] = useState<{
    entryId: string
    startTime: string
    endTime: string
  } | null>(null)

  const entryAdjustRef = useRef<{
    entry: PlacedEntry
    dragType: EntryDragType
    originalStartMins: number
    originalEndMins: number
    startY: number
    startClientY: number
    hasMoved: boolean
    isHoldConfirmed: boolean // For touch move (middle drag)
  } | null>(null)
  const entryHoldTimerRef = useRef<NodeJS.Timeout | null>(null)

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

  // Dismissed ghost events (hidden from view)
  const [dismissedEventIds, setDismissedEventIds] = useState<Set<string>>(new Set())
  const [showDismissed, setShowDismissed] = useState(false)

  const dismissGhostEvent = useCallback((eventId: string) => {
    setDismissedEventIds(prev => new Set(prev).add(eventId))
  }, [])

  const restoreAllDismissed = useCallback(() => {
    setDismissedEventIds(new Set())
    setShowDismissed(false)
  }, [])

  // Filter out dismissed ghost events only (keep overlapping ones for side-by-side display)
  const ghostEvents = useMemo(() => {
    return calendarEvents.filter(event => {
      // Filter out dismissed events (unless showing dismissed)
      if (!showDismissed && dismissedEventIds.has(event.id)) return false
      return true
    })
  }, [calendarEvents, dismissedEventIds, showDismissed])

  // Detect which ghosts overlap with confirmed entries (for side-by-side stacking)
  const overlappingGhostIds = useMemo(() => {
    const overlapping = new Set<string>()

    ghostEvents.forEach(event => {
      const eventStart = timeToMinutes(event.startTime)
      const eventEnd = timeToMinutes(event.endTime)

      const hasOverlap = entries.some(entry => {
        if (!entry.start_time || !entry.end_time) return false
        if (entry.status !== 'confirmed') return false

        const entryStart = timeToMinutes(entry.start_time)
        const entryEnd = timeToMinutes(entry.end_time)

        // Check for any overlap (not just 50%)
        return eventStart < entryEnd && eventEnd > entryStart
      })

      if (hasOverlap) {
        overlapping.add(event.id)
      }
    })

    return overlapping
  }, [ghostEvents, entries])

  // Track which entries overlap with ghosts (for side-by-side positioning)
  const overlappingEntryIds = useMemo(() => {
    const overlapping = new Set<string>()

    entries.forEach(entry => {
      if (!entry.start_time || !entry.end_time) return
      if (entry.status !== 'confirmed') return

      const entryStart = timeToMinutes(entry.start_time)
      const entryEnd = timeToMinutes(entry.end_time)

      const hasOverlap = ghostEvents.some(event => {
        const eventStart = timeToMinutes(event.startTime)
        const eventEnd = timeToMinutes(event.endTime)
        return entryStart < eventEnd && entryEnd > eventStart
      })

      if (hasOverlap) {
        overlapping.add(entry.id)
      }
    })

    return overlapping
  }, [entries, ghostEvents])

  // Separate entries with times from those without
  const { timedEntries, untimedEntries } = useMemo(() => {
    const timed: TimeEntry[] = []
    const untimed: TimeEntry[] = []
    entries.forEach(entry => {
      if (entry.start_time && entry.end_time) {
        timed.push(entry)
      } else {
        untimed.push(entry)
      }
    })
    return { timedEntries: timed, untimedEntries: untimed }
  }, [entries])

  // Calculate the time range for the timeline
  // ALWAYS show full 24 hours (midnight to midnight) for complete day coverage
  const { startHour, endHour } = useMemo(() => {
    // Full 24-hour range: 12:00 AM (0) to 11:59 PM (24)
    return { startHour: 0, endHour: 24 }
  }, [])

  // Smart place all entries
  const placedEntries = useMemo(() => {
    return smartPlaceEntries(timedEntries, untimedEntries, startHour, endHour)
  }, [timedEntries, untimedEntries, startHour, endHour])

  const timelineHeight = (endHour - startHour) * HOUR_HEIGHT

  // Memoize hours array
  const hours = useMemo(() => {
    return Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i)
  }, [startHour, endHour])

  // Convert Y position (relative to grid) to time
  const yToTime = (clientY: number): string => {
    if (!scrollContainerRef.current) {
      return '00:00'
    }

    // Get the scroll container's position and scroll state
    const containerRect = scrollContainerRef.current.getBoundingClientRect()
    const scrollTop = scrollContainerRef.current.scrollTop

    // Calculate Y position relative to the content (not just the visible area)
    const relativeY = clientY - containerRect.top + scrollTop

    // Convert pixels to minutes
    const minutesFromGridTop = relativeY / PIXELS_PER_MINUTE
    const totalMinutes = minutesFromGridTop + (startHour * 60)

    // Snap to 15-minute intervals
    const snappedMinutes = Math.round(totalMinutes / 15) * 15

    // Clamp to valid range (startHour to endHour)
    const minMinutes = startHour * 60
    const maxMinutes = endHour * 60
    const clampedMinutes = Math.max(minMinutes, Math.min(maxMinutes, snappedMinutes))

    return minutesToTime(clampedMinutes)
  }

  // MOUSE DOWN: Start drag
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only handle left click
    if (e.button !== 0) return

    // Don't start drag on existing entries or ghost blocks
    const target = e.target as HTMLElement
    if (target.closest('[data-entry-block]') || target.closest('[data-ghost-block]')) {
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
  }

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
  }, [isDragging, onDragCreate])

  // TOUCH START: Begin touch tracking with hold delay
  const handleTouchStart = (e: React.TouchEvent) => {
    // Don't start drag on existing entries or ghost blocks
    const target = e.target as HTMLElement
    if (target.closest('[data-entry-block]') || target.closest('[data-ghost-block]')) {
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
      isHoldConfirmed: false
    }

    // Start hold timer - if they hold for TOUCH_HOLD_DELAY ms, we enter drag mode
    touchHoldTimerRef.current = setTimeout(() => {
      if (touchDataRef.current && !touchDataRef.current.hasMoved) {
        touchDataRef.current.isHoldConfirmed = true
        setIsTouchDragging(true)
        setDragPreviewStart(touchDataRef.current.startTime)
        setDragPreviewEnd(minutesToTime(timeToMinutes(touchDataRef.current.startTime) + 30))

        // Haptic feedback if supported
        if (navigator.vibrate) {
          navigator.vibrate(50)
        }
      }
    }, TOUCH_HOLD_DELAY)
  }

  // TOUCH MOVE and TOUCH END handlers
  useEffect(() => {
    if (!isTouchDragging && !touchDataRef.current) return

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchDataRef.current) return

      const touch = e.touches[0]
      const deltaY = Math.abs(touch.clientY - touchDataRef.current.startClientY)

      // If user moved before hold was confirmed, cancel the hold timer and let scroll happen
      if (!touchDataRef.current.isHoldConfirmed) {
        if (deltaY > DRAG_THRESHOLD) {
          // User is scrolling - cancel hold timer
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
        setDragPreviewStart(touchDataRef.current.startTime)
        setDragPreviewEnd(currentTime)
      } else {
        setDragPreviewStart(currentTime)
        setDragPreviewEnd(touchDataRef.current.startTime)
      }
    }

    const handleTouchEnd = () => {
      // Clear hold timer
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
      setIsTouchDragging(false)
      setDragPreviewStart(null)
      setDragPreviewEnd(null)
    }

    const handleTouchCancel = () => {
      // Clear hold timer
      if (touchHoldTimerRef.current) {
        clearTimeout(touchHoldTimerRef.current)
        touchHoldTimerRef.current = null
      }

      // Reset touch state
      touchDataRef.current = null
      setIsTouchDragging(false)
      setDragPreviewStart(null)
      setDragPreviewEnd(null)
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
  }, [isTouchDragging, onDragCreate])

  // Cleanup hold timer on unmount
  useEffect(() => {
    return () => {
      if (touchHoldTimerRef.current) {
        clearTimeout(touchHoldTimerRef.current)
      }
      if (ghostTapTimerRef.current) {
        clearTimeout(ghostTapTimerRef.current)
      }
    }
  }, [])

  // Cancel drag function - resets all drag state without creating entry
  const cancelDrag = useCallback(() => {
    // Clear mouse drag state
    dragDataRef.current = null
    setIsDragging(false)

    // Clear touch drag state
    if (touchHoldTimerRef.current) {
      clearTimeout(touchHoldTimerRef.current)
      touchHoldTimerRef.current = null
    }
    touchDataRef.current = null
    setIsTouchDragging(false)

    // Clear ghost interaction state
    if (ghostTapTimerRef.current) {
      clearTimeout(ghostTapTimerRef.current)
      ghostTapTimerRef.current = null
    }
    ghostInteractionRef.current = null

    // Clear entry adjustment state
    if (entryHoldTimerRef.current) {
      clearTimeout(entryHoldTimerRef.current)
      entryHoldTimerRef.current = null
    }
    entryAdjustRef.current = null
    setIsAdjustingEntry(false)
    setAdjustPreview(null)

    // Clear preview
    setDragPreviewStart(null)
    setDragPreviewEnd(null)
  }, [])

  // Escape key to cancel drag
  useEffect(() => {
    const isAnyDragActive = isDragging || isTouchDragging || isAdjustingEntry

    if (!isAnyDragActive) return

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
  }, [isDragging, isTouchDragging, isAdjustingEntry, cancelDrag])

  // GHOST EVENT: Mouse down handler - detect tap vs hold+drag
  const handleGhostMouseDown = (e: React.MouseEvent, event: CalendarEvent) => {
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
  }

  // GHOST EVENT: Touch start handler
  const handleGhostTouchStart = (e: React.TouchEvent, event: CalendarEvent) => {
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
          isHoldConfirmed: true
        }
        setIsTouchDragging(true)
        setDragPreviewStart(time)
        setDragPreviewEnd(minutesToTime(timeToMinutes(time) + 30))

        // Haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate(50)
        }
      }
    }, GHOST_TAP_THRESHOLD)
  }

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

      if (deltaY > DRAG_THRESHOLD) {
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
  }, [onGhostEntryClick])

  // Detect which zone of an entry was clicked (top edge, bottom edge, or middle)
  const detectEntryDragType = (
    clientY: number,
    entryTop: number,
    entryHeight: number
  ): EntryDragType => {
    const relativeY = clientY - entryTop
    const topZone = entryHeight * ENTRY_EDGE_ZONE
    const bottomZone = entryHeight * (1 - ENTRY_EDGE_ZONE)

    if (relativeY <= topZone) return 'resize-top'
    if (relativeY >= bottomZone) return 'resize-bottom'
    return 'move'
  }

  // ENTRY ADJUSTMENT: Mouse down handler
  const handleEntryMouseDown = (e: React.MouseEvent, entry: PlacedEntry) => {
    if (e.button !== 0) return // Only left click
    e.stopPropagation() // Don't trigger grid mousedown

    // Don't allow adjusting entries without times (estimated entries)
    if (entry.isEstimated) return

    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const dragType = detectEntryDragType(e.clientY, rect.top, rect.height)

    const originalStartMins = timeToMinutes(entry.placedStartTime)
    const originalEndMins = timeToMinutes(entry.placedEndTime)

    entryAdjustRef.current = {
      entry,
      dragType,
      originalStartMins,
      originalEndMins,
      startY: e.clientY,
      startClientY: e.clientY,
      hasMoved: false,
      isHoldConfirmed: dragType !== 'move' // Resize starts immediately, move needs to confirm
    }

    // For resize operations, start immediately
    if (dragType !== 'move') {
      setIsAdjustingEntry(true)
      setAdjustPreview({
        entryId: entry.id,
        startTime: entry.placedStartTime,
        endTime: entry.placedEndTime
      })
    }
    // For move, we'll wait for actual movement
  }

  // ENTRY ADJUSTMENT: Touch start handler
  const handleEntryTouchStart = (e: React.TouchEvent, entry: PlacedEntry) => {
    e.stopPropagation() // Don't trigger grid touchstart

    // Don't allow adjusting entries without times (estimated entries)
    if (entry.isEstimated) return

    const touch = e.touches[0]
    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const dragType = detectEntryDragType(touch.clientY, rect.top, rect.height)

    const originalStartMins = timeToMinutes(entry.placedStartTime)
    const originalEndMins = timeToMinutes(entry.placedEndTime)

    entryAdjustRef.current = {
      entry,
      dragType,
      originalStartMins,
      originalEndMins,
      startY: touch.clientY,
      startClientY: touch.clientY,
      hasMoved: false,
      isHoldConfirmed: dragType !== 'move' // Resize starts immediately
    }

    // For resize operations, start immediately
    if (dragType !== 'move') {
      setIsAdjustingEntry(true)
      setAdjustPreview({
        entryId: entry.id,
        startTime: entry.placedStartTime,
        endTime: entry.placedEndTime
      })
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(30)
      }
    } else {
      // For move, set up hold timer
      entryHoldTimerRef.current = setTimeout(() => {
        if (entryAdjustRef.current && !entryAdjustRef.current.hasMoved) {
          entryAdjustRef.current.isHoldConfirmed = true
          setIsAdjustingEntry(true)
          setAdjustPreview({
            entryId: entry.id,
            startTime: entry.placedStartTime,
            endTime: entry.placedEndTime
          })
          // Haptic feedback
          if (navigator.vibrate) {
            navigator.vibrate(50)
          }
        }
      }, ENTRY_HOLD_DELAY)
    }
  }

  // ENTRY ADJUSTMENT: Update entry times in database
  const updateEntryTimes = useCallback(async (entryId: string, newStartTime: string, newEndTime: string) => {
    const startMins = timeToMinutes(newStartTime)
    const endMins = timeToMinutes(newEndTime)
    const newDuration = endMins - startMins

    if (newDuration < 5) return // Don't allow entries shorter than 5 minutes

    try {
      const { error } = await supabase
        .from('time_entries')
        .update({
          start_time: newStartTime,
          end_time: newEndTime,
          duration_minutes: newDuration
        })
        .eq('id', entryId)

      if (error) throw error

      // Refresh entries
      onEntryDeleted()
      onShowToast?.('Entry time updated')
    } catch (error) {
      console.error('Failed to update entry times:', error)
      onShowToast?.('Failed to update entry')
    }
  }, [onEntryDeleted, onShowToast])

  // ENTRY ADJUSTMENT: Mouse/touch move and up handlers
  useEffect(() => {
    if (!entryAdjustRef.current) return

    const handleAdjustMouseMove = (e: MouseEvent) => {
      if (!entryAdjustRef.current) return

      const { dragType, originalStartMins, originalEndMins, startClientY, isHoldConfirmed } = entryAdjustRef.current
      const deltaY = e.clientY - startClientY

      // Check if moved beyond threshold
      if (Math.abs(deltaY) > DRAG_THRESHOLD) {
        entryAdjustRef.current.hasMoved = true

        // For move operations, start adjusting on first significant movement
        if (dragType === 'move' && !isHoldConfirmed) {
          entryAdjustRef.current.isHoldConfirmed = true
          setIsAdjustingEntry(true)
        }
      }

      if (!entryAdjustRef.current.isHoldConfirmed) return

      let newStartMins = originalStartMins
      let newEndMins = originalEndMins
      const duration = originalEndMins - originalStartMins

      // For resize operations, use absolute cursor position for precise placement
      // This ensures dragging to a grid line puts the time exactly there
      const cursorTime = yToTime(e.clientY)
      const cursorMins = timeToMinutes(cursorTime)

      if (dragType === 'move') {
        // For move, calculate delta and apply to both start and end
        const deltaMinutes = Math.round((deltaY / PIXELS_PER_MINUTE) / 15) * 15
        newStartMins = Math.round((originalStartMins + deltaMinutes) / 15) * 15
        newEndMins = newStartMins + duration
        // Clamp to day bounds (0:00 to 24:00)
        if (newStartMins < 0) {
          newStartMins = 0
          newEndMins = duration
        }
        if (newEndMins > 24 * 60) {
          newEndMins = 24 * 60
          newStartMins = newEndMins - duration
        }
        if (newStartMins < 0) {
          newStartMins = 0
          newEndMins = Math.min(duration, 24 * 60)
        }
      } else if (dragType === 'resize-top') {
        // Use cursor position directly for the new start time
        newStartMins = cursorMins
        // Clamp: can't go past end time minus 15 min, can't go below 0
        newStartMins = Math.max(0, Math.min(newStartMins, originalEndMins - 15))
      } else if (dragType === 'resize-bottom') {
        // Use cursor position directly for the new end time
        newEndMins = cursorMins
        // If cursor is near bottom of timeline (past 23:30), snap to midnight (24:00)
        if (cursorMins >= 23 * 60 + 30) {
          newEndMins = 24 * 60 // Midnight = 24:00 = 1440 minutes
        }
        // Clamp: can't go before start time plus 15 min, can't exceed 24:00
        newEndMins = Math.min(24 * 60, Math.max(newEndMins, originalStartMins + 15))
      }

      setAdjustPreview({
        entryId: entryAdjustRef.current.entry.id,
        startTime: minutesToTime(newStartMins),
        endTime: minutesToTime(newEndMins)
      })
    }

    const handleAdjustMouseUp = () => {
      if (!entryAdjustRef.current) return

      const { entry, hasMoved, isHoldConfirmed } = entryAdjustRef.current

      // If user moved and confirmed, save the new times
      if (hasMoved && isHoldConfirmed && adjustPreview) {
        const { startTime, endTime } = adjustPreview
        // Only update if times actually changed
        if (startTime !== entry.placedStartTime || endTime !== entry.placedEndTime) {
          updateEntryTimes(entry.id, startTime, endTime)
        }
      } else if (!hasMoved) {
        // User just clicked - open edit modal
        setSelectedEntry(entry)
        setPromptAddTimes(false)
      }

      // Reset state
      entryAdjustRef.current = null
      setIsAdjustingEntry(false)
      setAdjustPreview(null)
    }

    const handleAdjustTouchMove = (e: TouchEvent) => {
      if (!entryAdjustRef.current) return

      const touch = e.touches[0]
      const { dragType, originalStartMins, originalEndMins, startClientY, isHoldConfirmed } = entryAdjustRef.current
      const deltaY = touch.clientY - startClientY

      // Check if moved beyond threshold (for canceling hold timer)
      if (Math.abs(deltaY) > DRAG_THRESHOLD) {
        entryAdjustRef.current.hasMoved = true

        // If hold wasn't confirmed yet and user moved, cancel (they're scrolling)
        if (!isHoldConfirmed) {
          if (entryHoldTimerRef.current) {
            clearTimeout(entryHoldTimerRef.current)
            entryHoldTimerRef.current = null
          }
          entryAdjustRef.current = null
          return // Let scroll happen
        }
      }

      if (!isHoldConfirmed) return

      // Prevent scrolling during adjustment
      e.preventDefault()

      let newStartMins = originalStartMins
      let newEndMins = originalEndMins
      const duration = originalEndMins - originalStartMins

      // For resize operations, use absolute cursor position for precise placement
      const cursorTime = yToTime(touch.clientY)
      const cursorMins = timeToMinutes(cursorTime)

      if (dragType === 'move') {
        // For move, calculate delta and apply to both start and end
        const deltaMinutes = Math.round((deltaY / PIXELS_PER_MINUTE) / 15) * 15
        newStartMins = Math.round((originalStartMins + deltaMinutes) / 15) * 15
        newEndMins = newStartMins + duration
        if (newStartMins < 0) {
          newStartMins = 0
          newEndMins = duration
        }
        if (newEndMins > 24 * 60) {
          newEndMins = 24 * 60
          newStartMins = newEndMins - duration
        }
        if (newStartMins < 0) {
          newStartMins = 0
          newEndMins = Math.min(duration, 24 * 60)
        }
      } else if (dragType === 'resize-top') {
        // Use cursor position directly for the new start time
        newStartMins = cursorMins
        newStartMins = Math.max(0, Math.min(newStartMins, originalEndMins - 15))
      } else if (dragType === 'resize-bottom') {
        // Use cursor position directly for the new end time
        newEndMins = cursorMins
        // If cursor is near bottom of timeline (past 23:30), snap to midnight (24:00)
        if (cursorMins >= 23 * 60 + 30) {
          newEndMins = 24 * 60 // Midnight = 24:00 = 1440 minutes
        }
        newEndMins = Math.min(24 * 60, Math.max(newEndMins, originalStartMins + 15))
      }

      setAdjustPreview({
        entryId: entryAdjustRef.current.entry.id,
        startTime: minutesToTime(newStartMins),
        endTime: minutesToTime(newEndMins)
      })
    }

    const handleAdjustTouchEnd = () => {
      // Clear hold timer
      if (entryHoldTimerRef.current) {
        clearTimeout(entryHoldTimerRef.current)
        entryHoldTimerRef.current = null
      }

      if (!entryAdjustRef.current) return

      const { entry, hasMoved, isHoldConfirmed } = entryAdjustRef.current

      // If user moved and confirmed, save the new times
      if (hasMoved && isHoldConfirmed && adjustPreview) {
        const { startTime, endTime } = adjustPreview
        if (startTime !== entry.placedStartTime || endTime !== entry.placedEndTime) {
          updateEntryTimes(entry.id, startTime, endTime)
        }
      } else if (!hasMoved && !isHoldConfirmed) {
        // User just tapped - open edit modal
        setSelectedEntry(entry)
        setPromptAddTimes(false)
      }

      // Reset state
      entryAdjustRef.current = null
      setIsAdjustingEntry(false)
      setAdjustPreview(null)
    }

    window.addEventListener('mousemove', handleAdjustMouseMove)
    window.addEventListener('mouseup', handleAdjustMouseUp)
    window.addEventListener('touchmove', handleAdjustTouchMove, { passive: false })
    window.addEventListener('touchend', handleAdjustTouchEnd)

    return () => {
      window.removeEventListener('mousemove', handleAdjustMouseMove)
      window.removeEventListener('mouseup', handleAdjustMouseUp)
      window.removeEventListener('touchmove', handleAdjustTouchMove)
      window.removeEventListener('touchend', handleAdjustTouchEnd)
    }
  }, [adjustPreview, updateEntryTimes])

  // Cleanup entry hold timer on unmount
  useEffect(() => {
    return () => {
      if (entryHoldTimerRef.current) {
        clearTimeout(entryHoldTimerRef.current)
      }
    }
  }, [])

  // Scroll to appropriate position on load
  // For today: center on current time
  // For other days: scroll to first event or default to 9am
  useEffect(() => {
    if (!scrollContainerRef.current) return

    const container = scrollContainerRef.current
    const containerHeight = container.clientHeight

    // Small delay to ensure container is properly rendered
    requestAnimationFrame(() => {
      if (isToday) {
        // TODAY: Center the current time in the viewport
        const now = new Date()
        const currentMinutes = now.getHours() * 60 + now.getMinutes()

        // Calculate position of current time
        const currentTimeOffset = (currentMinutes - startHour * 60) * PIXELS_PER_MINUTE

        // Center it in the viewport (subtract half the container height)
        const scrollTo = currentTimeOffset - containerHeight / 2

        container.scrollTo({
          top: Math.max(0, scrollTo),
          behavior: 'instant'
        })
      } else if (placedEntries.length > 0) {
        // Past or future day with entries: scroll to first entry
        const firstEntry = placedEntries.reduce((earliest, entry) => {
          return timeToMinutes(entry.placedStartTime) < timeToMinutes(earliest.placedStartTime) ? entry : earliest
        }, placedEntries[0])

        const entryOffset = (timeToMinutes(firstEntry.placedStartTime) - startHour * 60) * PIXELS_PER_MINUTE
        const scrollTo = entryOffset - 60 // 60px padding above

        container.scrollTo({
          top: Math.max(0, scrollTo),
          behavior: 'instant'
        })
      } else if (ghostEvents.length > 0) {
        // Future day with ghost events but no entries: scroll to first ghost event
        const firstGhost = ghostEvents.reduce((earliest, event) => {
          return timeToMinutes(event.startTime) < timeToMinutes(earliest.startTime) ? event : earliest
        }, ghostEvents[0])

        const ghostOffset = (timeToMinutes(firstGhost.startTime) - startHour * 60) * PIXELS_PER_MINUTE
        const scrollTo = ghostOffset - 60 // 60px padding above

        container.scrollTo({
          top: Math.max(0, scrollTo),
          behavior: 'instant'
        })
      } else {
        // Empty day: scroll to 9am, centered in viewport
        const nineAMOffset = (9 * 60 - startHour * 60) * PIXELS_PER_MINUTE
        const scrollTo = nineAMOffset - containerHeight / 3

        container.scrollTo({
          top: Math.max(0, scrollTo),
          behavior: 'instant'
        })
      }
    })
  }, [placedEntries, ghostEvents, startHour, isToday])

  const handleEntryClick = (entry: PlacedEntry) => {
    if (entry.isEstimated) {
      setSelectedEntry(entry)
      setPromptAddTimes(true)
    } else {
      setSelectedEntry(entry)
      setPromptAddTimes(false)
    }
  }

  // Calculate drag preview position (works for both mouse and touch)
  const getDragPreview = () => {
    // Show preview for either mouse or touch dragging
    if ((!isDragging && !isTouchDragging) || !dragPreviewStart) return null

    let previewStart = dragPreviewStart
    let previewEnd = dragPreviewEnd || dragPreviewStart

    // Check if user has dragged beyond threshold (different start/end times)
    const hasDraggedBeyondThreshold = dragPreviewEnd && dragPreviewEnd !== dragPreviewStart

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

    return { top, height, previewStart, previewEnd, duration }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Skeleton stats bar */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        {/* Skeleton timeline */}
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <div className="h-[500px] overflow-hidden">
            <div className="relative flex" style={{ height: '600px' }}>
              {/* Hour labels skeleton */}
              <div className="w-14 shrink-0 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
                {[8, 9, 10, 11, 12, 13, 14].map((hour) => (
                  <div key={hour} className="flex h-[90px] items-start justify-end pr-2 pt-0">
                    <Skeleton className="h-3 w-8" />
                  </div>
                ))}
              </div>
              {/* Entry blocks skeleton */}
              <div className="relative flex-1 p-2">
                <Skeleton className="absolute left-2 right-2 h-[70px] rounded-lg" style={{ top: '20px' }} />
                <Skeleton className="absolute left-2 right-2 h-[120px] rounded-lg" style={{ top: '180px' }} />
                <Skeleton className="absolute left-2 right-2 h-[45px] rounded-lg" style={{ top: '350px' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Check if this is an empty day (no entries, no ghost events)
  const isEmpty = entries.length === 0 && ghostEvents.length === 0

  const dragPreview = getDragPreview()

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
        {isEmpty ? (
          <span className="text-zinc-400 dark:text-zinc-500">
            {!canLog
              ? "No entries for this day"
              : isToday
                ? "No entries yet — tap or hold & drag to add"
                : isFutureDay
                  ? "No plans yet — tap or hold & drag to schedule"
                  : "No entries for this day — tap to add"}
          </span>
        ) : (
          <>
            <span>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
            <span className="font-medium">Total: {formatDuration(totalMinutes)}</span>
          </>
        )}
      </div>

      {/* Timeline container - ALWAYS scrollable with fixed height */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <div
          ref={scrollContainerRef}
          className="h-[500px] overflow-y-scroll"
        >
          <div className="relative flex" style={{ height: timelineHeight }}>
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
              ref={timelineGridRef}
              className={`relative flex-1 ${onDragCreate ? 'cursor-crosshair' : ''} ${isDragging || isTouchDragging || isAdjustingEntry ? 'select-none' : ''}`}
              style={{ touchAction: isTouchDragging || isAdjustingEntry ? 'none' : 'auto' }}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
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

              {/* Entry blocks */}
              {placedEntries.map((entry) => {
                const startMinutes = timeToMinutes(entry.placedStartTime)
                const endMinutes = timeToMinutes(entry.placedEndTime)
                const top = (startMinutes - startHour * 60) * PIXELS_PER_MINUTE
                const height = Math.max((endMinutes - startMinutes) * PIXELS_PER_MINUTE, MIN_BLOCK_HEIGHT)
                const colors = entry.category ? CATEGORY_COLORS[entry.category] : CATEGORY_COLORS.other
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
                      onMouseDown={hasTimes ? (e) => handleEntryMouseDown(e, entry) : undefined}
                      onTouchStart={hasTimes ? (e) => handleEntryTouchStart(e, entry) : undefined}
                      onClick={!hasTimes ? (e) => {
                        e.stopPropagation()
                        handleEntryClick(entry)
                      } : undefined}
                      className={`absolute left-1 right-1 overflow-hidden rounded-lg border-2 border-dashed transition-all ${
                        pendingIsBeingAdjusted
                          ? 'z-30 shadow-xl ring-2 ring-primary/50 opacity-80'
                          : 'hover:opacity-80 opacity-60'
                      } ${
                        isReadyToConfirm
                          ? 'border-amber-400/80 bg-amber-100/50 dark:border-amber-500/60 dark:bg-amber-900/30'
                          : 'border-zinc-400/60 bg-zinc-100/50 dark:border-zinc-500/40 dark:bg-zinc-700/30'
                      } ${hasTimes ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                      style={{ top: pendingDisplayTop, height: pendingDisplayHeight }}
                    >
                      <div className={`flex h-full flex-col justify-center px-2 py-1 ${isReadyToConfirm ? 'text-amber-700 dark:text-amber-300' : 'text-zinc-600 dark:text-zinc-300'}`}>
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
                    onMouseDown={(e) => handleEntryMouseDown(e, entry)}
                    onTouchStart={(e) => handleEntryTouchStart(e, entry)}
                    className={`absolute overflow-hidden rounded-lg border-l-4 shadow-sm transition-all ${
                      isBeingAdjusted
                        ? 'z-30 shadow-xl ring-2 ring-primary/50'
                        : 'hover:shadow-md hover:brightness-105'
                    } ${colors.bg} ${colors.border} ${entry.isEstimated ? 'opacity-70 cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
                    style={{
                      top: displayTop,
                      height: displayHeight,
                      left: '4px',
                      right: entryHasOverlap ? '50%' : '4px',
                    }}
                  >
                    {/* Top resize handle (visual indicator) */}
                    {!entry.isEstimated && height >= 50 && (
                      <div className="absolute inset-x-0 top-0 h-3 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-ns-resize">
                        <div className="h-0.5 w-8 rounded-full bg-white/50" />
                      </div>
                    )}

                    <div className={`flex h-full flex-col justify-center px-2 py-1 ${colors.text}`}>
                      {isShort ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1 truncate text-xs font-medium">
                            {entry.isEstimated && <span className="opacity-70">~</span>}
                            {entry.activity}
                          </span>
                          <span className="shrink-0 text-xs opacity-80">
                            {isBeingAdjusted ? formatDuration(displayDuration) : formatDuration(entry.duration_minutes)}
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

                    {/* Bottom resize handle (visual indicator) */}
                    {!entry.isEstimated && height >= 50 && (
                      <div className="absolute inset-x-0 bottom-0 h-3 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-ns-resize">
                        <div className="h-0.5 w-8 rounded-full bg-white/50" />
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Ghost entries (from calendar) */}
              {ghostEvents.map((event) => {
                const startMinutes = timeToMinutes(event.startTime)
                const endMinutes = timeToMinutes(event.endTime)
                const durationMinutes = endMinutes - startMinutes
                const top = (startMinutes - startHour * 60) * PIXELS_PER_MINUTE
                const height = Math.max(durationMinutes * PIXELS_PER_MINUTE, MIN_BLOCK_HEIGHT)
                const isShort = height < 50
                const isDismissed = dismissedEventIds.has(event.id)

                const now = new Date()
                const currentMinutes = now.getHours() * 60 + now.getMinutes()
                const hasEnded = !isToday || currentMinutes >= endMinutes

                // During drag, ghost events should not block interaction
                const isCurrentlyDragging = isDragging || isTouchDragging

                // Check if this ghost overlaps with an entry (for side-by-side layout)
                const ghostHasOverlap = overlappingGhostIds.has(event.id)

                return (
                  <div
                    key={`ghost-${event.id}`}
                    data-ghost-block
                    onMouseDown={(e) => {
                      if (isCurrentlyDragging || isDismissed) return
                      handleGhostMouseDown(e, event)
                    }}
                    onTouchStart={(e) => {
                      if (isCurrentlyDragging || isDismissed) return
                      handleGhostTouchStart(e, event)
                    }}
                    className={`absolute overflow-hidden rounded-lg border-2 border-dashed transition-all ${
                      isDismissed
                        ? 'border-zinc-400/50 bg-zinc-200/30 opacity-50 dark:border-zinc-500/40 dark:bg-zinc-700/30'
                        : 'border-blue-500/70 bg-blue-100/60 hover:border-blue-600 hover:bg-blue-100/80 dark:border-blue-400/60 dark:bg-blue-900/40 dark:hover:border-blue-300'
                    } ${isCurrentlyDragging ? 'pointer-events-none' : 'cursor-pointer'}`}
                    style={{
                      top,
                      height,
                      left: ghostHasOverlap ? '50%' : '4px',
                      right: '4px',
                    }}
                  >
                    <div className={`flex h-full flex-col justify-center px-2 py-1 ${
                      isDismissed
                        ? 'text-zinc-600 dark:text-zinc-400'
                        : 'text-blue-800 dark:text-blue-200'
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
                                dismissGhostEvent(event.id)
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation()
                                dismissGhostEvent(event.id)
                              }}
                              className="shrink-0 rounded p-0.5 opacity-60 hover:bg-blue-500/20 hover:opacity-100"
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
                                  dismissGhostEvent(event.id)
                                }}
                                onTouchStart={(e) => {
                                  e.stopPropagation()
                                  dismissGhostEvent(event.id)
                                }}
                                className="shrink-0 rounded p-0.5 opacity-60 hover:bg-blue-500/20 hover:opacity-100"
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
              })}

              {/* Drag preview */}
              {dragPreview && (
                <div
                  className="absolute left-1 right-1 z-20 overflow-hidden rounded-lg border-2 border-dashed border-primary bg-primary/20 shadow-lg pointer-events-none"
                  style={{ top: dragPreview.top, height: Math.max(dragPreview.height, MIN_BLOCK_HEIGHT) }}
                >
                  <div className="flex h-full flex-col items-center justify-center px-2 py-1 text-primary">
                    <span className="text-sm font-medium">
                      {formatTimeDisplay(dragPreview.previewStart)} - {formatTimeDisplay(dragPreview.previewEnd)}
                    </span>
                    <span className="text-xs opacity-80">
                      {formatDuration(dragPreview.duration)}
                    </span>
                  </div>
                </div>
              )}

              {/* Current time indicator */}
              {isToday && <CurrentTimeIndicator startHour={startHour} endHour={endHour} />}
            </div>
          </div>
        </div>

        {/* Legend for estimated entries */}
        {untimedEntries.length > 0 && (
          <div className="border-t border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              <span className="mr-1 rounded bg-zinc-200 px-1 dark:bg-zinc-600">est</span>
              = estimated placement (no times set). Click to add actual times.
            </p>
          </div>
        )}

        {/* Show/restore dismissed ghost events */}
        {dismissedEventIds.size > 0 && (
          <div className="border-t border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {dismissedEventIds.size} calendar {dismissedEventIds.size === 1 ? 'event' : 'events'} hidden
              </p>
              <button
                onClick={restoreAllDismissed}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
              >
                <Eye className="h-3 w-3" />
                Restore all
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedEntry && (
        <TimeEntryModal
          entry={selectedEntry}
          onClose={() => {
            setSelectedEntry(null)
            setPromptAddTimes(false)
          }}
          onUpdate={() => {
            setSelectedEntry(null)
            setPromptAddTimes(false)
            onEntryDeleted()
          }}
          onDelete={() => {
            setSelectedEntry(null)
            setPromptAddTimes(false)
            onEntryDeleted()
          }}
          promptAddTimes={promptAddTimes}
          onShowToast={onShowToast}
        />
      )}
    </div>
  )
}

// Current time indicator component
function CurrentTimeIndicator({ startHour, endHour }: { startHour: number; endHour: number }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = startHour * 60
  const endMinutes = endHour * 60

  if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
    return null
  }

  const top = (currentMinutes - startMinutes) * PIXELS_PER_MINUTE

  return (
    <div
      className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
      style={{ top }}
    >
      <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
      <div className="h-0.5 flex-1 bg-red-500" />
    </div>
  )
}
