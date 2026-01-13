'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { TimeEntry, TimeCategory, isPendingEntryReadyToConfirm } from '@/lib/types'
import { formatDuration, formatHour, timeToMinutes, minutesToTime, formatTimeDisplay } from '@/lib/time-utils'
import TimeEntryModal from './TimeEntryModal'
import { Clock } from 'lucide-react'

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
  isPastDay = false
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

  const DRAG_THRESHOLD = 5 // pixels - if moved less than this, treat as click

  // Filter out calendar events that overlap with confirmed entries
  const ghostEvents = useMemo(() => {
    return calendarEvents.filter(event => {
      const eventStart = timeToMinutes(event.startTime)
      const eventEnd = timeToMinutes(event.endTime)

      return !entries.some(entry => {
        if (!entry.start_time || !entry.end_time) return false
        const entryStart = timeToMinutes(entry.start_time)
        const entryEnd = timeToMinutes(entry.end_time)

        const overlapStart = Math.max(eventStart, entryStart)
        const overlapEnd = Math.min(eventEnd, entryEnd)
        const overlap = Math.max(0, overlapEnd - overlapStart)
        const eventDuration = eventEnd - eventStart

        return overlap > eventDuration * 0.5
      })
    })
  }, [calendarEvents, entries])

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

  // Calculate drag preview position
  const getDragPreview = () => {
    if (!isDragging || !dragPreviewStart) return null

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
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600"></div>
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
            {isToday
              ? "No entries yet — click or drag to add"
              : isFutureDay
                ? "No plans yet — click or drag to schedule"
                : "No entries for this day"}
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
              className={`relative flex-1 ${onDragCreate ? 'cursor-crosshair' : ''} ${isDragging ? 'select-none' : ''}`}
              onMouseDown={handleMouseDown}
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

                // Pending entries get ghost styling
                if (isPending) {
                  return (
                    <div
                      key={entry.id}
                      data-entry-block
                      data-pending
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEntryClick(entry)
                      }}
                      className={`absolute left-1 right-1 cursor-pointer overflow-hidden rounded-lg border-2 border-dashed transition-all hover:opacity-80 ${
                        isReadyToConfirm
                          ? 'border-amber-400/80 bg-amber-100/50 dark:border-amber-500/60 dark:bg-amber-900/30'
                          : 'border-zinc-400/60 bg-zinc-100/50 dark:border-zinc-500/40 dark:bg-zinc-700/30'
                      } opacity-60`}
                      style={{ top, height }}
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
                              <span>{formatTimeDisplay(entry.placedStartTime)} - {formatTimeDisplay(entry.placedEndTime)}</span>
                              <span>({formatDuration(entry.duration_minutes)})</span>
                            </div>
                            {height > 70 && (
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

                // Confirmed entries - normal rendering
                return (
                  <div
                    key={entry.id}
                    data-entry-block
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEntryClick(entry)
                    }}
                    className={`absolute left-1 right-1 cursor-pointer overflow-hidden rounded-lg border-l-4 shadow-sm transition-all hover:shadow-md hover:brightness-105 ${colors.bg} ${colors.border} ${entry.isEstimated ? 'opacity-70' : ''}`}
                    style={{ top, height }}
                  >
                    <div className={`flex h-full flex-col justify-center px-2 py-1 ${colors.text}`}>
                      {isShort ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1 truncate text-xs font-medium">
                            {entry.isEstimated && <span className="opacity-70">~</span>}
                            {entry.activity}
                          </span>
                          <span className="shrink-0 text-xs opacity-80">{formatDuration(entry.duration_minutes)}</span>
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
                              {entry.isEstimated ? '~' : ''}{formatTimeDisplay(entry.placedStartTime)} - {formatTimeDisplay(entry.placedEndTime)}
                            </span>
                            <span>({formatDuration(entry.duration_minutes)})</span>
                          </div>
                          {entry.description && height > 70 && (
                            <span className="mt-1 truncate text-xs opacity-70">{entry.description}</span>
                          )}
                        </>
                      )}
                    </div>
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

                const now = new Date()
                const currentMinutes = now.getHours() * 60 + now.getMinutes()
                const hasEnded = !isToday || currentMinutes >= endMinutes

                return (
                  <div
                    key={`ghost-${event.id}`}
                    data-ghost-block
                    onClick={(e) => {
                      e.stopPropagation()
                      onGhostEntryClick?.(event)
                    }}
                    className="absolute left-1 right-1 cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-blue-400/60 bg-blue-100/40 opacity-60 transition-all hover:border-blue-500 hover:opacity-80 dark:border-blue-500/40 dark:bg-blue-900/20 dark:hover:border-blue-400"
                    style={{ top, height }}
                  >
                    <div className="flex h-full flex-col justify-center px-2 py-1 text-blue-700 dark:text-blue-300">
                      {isShort ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1 truncate text-xs font-medium">
                            <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {event.title}
                          </span>
                        </div>
                      ) : (
                        <>
                          <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {event.title}
                          </span>
                          <div className="mt-0.5 flex items-center gap-2 text-xs opacity-80">
                            <span>{event.startTime} - {event.endTime}</span>
                            <span>({formatDuration(durationMinutes)})</span>
                          </div>
                          {height > 70 && (
                            <span className="mt-1 text-xs opacity-70">
                              {hasEnded ? 'Tap to confirm' : 'Pending...'}
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
