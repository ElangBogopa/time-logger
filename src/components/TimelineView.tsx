'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { TimeEntry, TimeCategory } from '@/lib/types'
import { formatDuration, timeToMinutes } from '@/lib/time-utils'
import TimeEntryModal from './TimeEntryModal'
import { Skeleton } from '@/components/ui/skeleton'
import { Eye } from 'lucide-react'
import { useTimelineData, type PlacedEntry } from '@/hooks/useTimelineData'
import { useTimelineMouseCreate, type DragCreateData } from '@/hooks/useTimelineMouseCreate'
import { useTimelineTouchCreate } from '@/hooks/useTimelineTouchCreate'
import { useEntryAdjustment } from '@/hooks/useEntryAdjustment'
import { useGhostEvents } from '@/hooks/useGhostEvents'
import TimelineGrid from './timeline/TimelineGrid'
import TimelineEntry from './timeline/TimelineEntry'
import TimelineGap from './timeline/TimelineGap'
import TimelineGhost, { type CalendarEvent } from './timeline/TimelineGhost'
import { CurrentTimeIndicator, DragPreview } from './timeline'
import { yToTime as createYToTime } from './timeline/utils'

export type { CalendarEvent, DragCreateData, PlacedEntry }

export interface TimelineViewProps {
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
  visibleStartHour?: number
  visibleEndHour?: number
}

export default function TimelineView({
  entries,
  calendarEvents = [],
  isLoading,
  onEntryDeleted,
  onGhostEntryClick,
  onDragCreate,
  onShowToast,
  selectedDate,
  isToday = true,
  isFutureDay = false,
  isPastDay = false,
  canLog = true,
  visibleStartHour,
  visibleEndHour,
}: TimelineViewProps) {
  // Modal state (kept in main component)
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null)
  const [promptAddTimes, setPromptAddTimes] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  // Touch discovery hint state
  const [showTouchHint, setShowTouchHint] = useState(false)
  
  // Check if user has seen touch discovery hint
  useEffect(() => {
    const hasSeenHint = localStorage.getItem('timeline-touch-hint-seen')
    if (!hasSeenHint) {
      setShowTouchHint(true)
    }
  }, [])
  
  // Hide touch hint and remember user has seen it
  const hideTouchHint = useCallback(() => {
    setShowTouchHint(false)
    localStorage.setItem('timeline-touch-hint-seen', 'true')
  }, [])

  // Timeline data hook first (we need startHour for other hooks)
  const {
    totalMinutes,
    ghostEvents,
    overlappingGhostIds,
    overlappingEntryIds,
    timedEntries,
    untimedEntries,
    startHour,
    endHour,
    placedEntries,
    timeGaps,
    hours,
    timelineHeight,
    isEmpty,
  } = useTimelineData({
    entries,
    calendarEvents,
    dismissedEventIds: new Set(), // Will be properly set up below
    showDismissed: false,
    visibleStartHour,
    visibleEndHour,
    isToday,
    isFutureDay,
  })

  // Create yToTime function that uses the actual startHour
  const yToTime = useCallback((clientY: number) => {
    return createYToTime(clientY, scrollContainerRef as React.RefObject<HTMLDivElement>, startHour)
  }, [startHour])

  // Mouse drag creation
  const mouseCreateHook = useTimelineMouseCreate({
    scrollContainerRef: scrollContainerRef as React.RefObject<HTMLDivElement>,
    startHour,
    onDragCreate,
    yToTime,
  })

  // Touch drag creation
  const touchCreateHook = useTimelineTouchCreate({
    scrollContainerRef: scrollContainerRef as React.RefObject<HTMLDivElement>,
    startHour,
    onDragCreate,
    yToTime,
  })

  // Entry click handler
  const handleEntryClick = useCallback((entry: PlacedEntry) => {
    if (entry.isEstimated) {
      setSelectedEntry(entry)
      setPromptAddTimes(true)
    } else {
      setSelectedEntry(entry)
      setPromptAddTimes(false)
    }
  }, [])

  // Entry adjustment
  const entryAdjustmentHook = useEntryAdjustment({
    scrollContainerRef: scrollContainerRef as React.RefObject<HTMLDivElement>,
    startHour,
    onEntryDeleted,
    onShowToast,
    yToTime,
    onEntryClick: handleEntryClick,
  })

  // Persist dismissed ghost event IDs to localStorage so they survive reloads
  const dismissedStorageKey = `dismissed-ghosts-${selectedDate ?? 'unknown'}`

  const [dismissedEventIds, setDismissedEventIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem(dismissedStorageKey)
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set()
    } catch {
      return new Set()
    }
  })
  const [showDismissed, setShowDismissed] = useState(false)

  // Re-load dismissed IDs when selectedDate changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(dismissedStorageKey)
      setDismissedEventIds(stored ? new Set(JSON.parse(stored) as string[]) : new Set())
    } catch {
      setDismissedEventIds(new Set())
    }
  }, [dismissedStorageKey])

  // Sync to localStorage whenever dismissedEventIds changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (dismissedEventIds.size === 0) {
      localStorage.removeItem(dismissedStorageKey)
    } else {
      localStorage.setItem(dismissedStorageKey, JSON.stringify([...dismissedEventIds]))
    }
  }, [dismissedEventIds, dismissedStorageKey])

  // Clean up old dismissed keys (older than 7 days) on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const prefix = 'dismissed-ghosts-'
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 7)
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key?.startsWith(prefix)) {
          const dateStr = key.slice(prefix.length)
          if (dateStr < cutoff.toISOString().slice(0, 10)) {
            localStorage.removeItem(key)
          }
        }
      }
    } catch { /* ignore cleanup errors */ }
  }, [])

  const dismissGhostEvent = useCallback((eventId: string) => {
    setDismissedEventIds(prev => new Set(prev).add(eventId))
  }, [])

  const restoreAllDismissed = useCallback(() => {
    setDismissedEventIds(new Set())
    setShowDismissed(false)
  }, [])

  // Simple ghost event handlers
  const handleGhostMouseDown = useCallback((e: React.MouseEvent, event: CalendarEvent) => {
    if (e.button !== 0) return // Only left click
    e.stopPropagation()
    
    // For simplicity, just open the ghost entry click handler
    // In the future, this could integrate with the drag creation hooks
    onGhostEntryClick?.(event)
  }, [onGhostEntryClick])

  // Track ghost touch to distinguish tap vs scroll
  const ghostTouchRef = useRef<{ startY: number; event: CalendarEvent } | null>(null)

  const handleGhostTouchStart = useCallback((e: React.TouchEvent, event: CalendarEvent) => {
    e.stopPropagation()
    ghostTouchRef.current = { startY: e.touches[0].clientY, event }
  }, [])

  const handleGhostTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!ghostTouchRef.current) return
    const deltaY = Math.abs(e.changedTouches[0].clientY - ghostTouchRef.current.startY)
    // Only trigger if finger moved less than 10px (tap, not scroll)
    if (deltaY < 10) {
      onGhostEntryClick?.(ghostTouchRef.current.event)
    }
    ghostTouchRef.current = null
  }, [onGhostEntryClick])

  // Update the timeline data hook with the correct dismissed events
  const timelineData = useTimelineData({
    entries,
    calendarEvents,
    dismissedEventIds,
    showDismissed,
    visibleStartHour,
    visibleEndHour,
    isToday,
    isFutureDay,
  })

  // Use the updated data
  const {
    totalMinutes: updatedTotalMinutes,
    ghostEvents: updatedGhostEvents,
    overlappingGhostIds: updatedOverlappingGhostIds,
    overlappingEntryIds: updatedOverlappingEntryIds,
    timedEntries: updatedTimedEntries,
    untimedEntries: updatedUntimedEntries,
    startHour: updatedStartHour,
    endHour: updatedEndHour,
    placedEntries: updatedPlacedEntries,
    timeGaps: updatedTimeGaps,
    hours: updatedHours,
    timelineHeight: updatedTimelineHeight,
    isEmpty: updatedIsEmpty,
  } = timelineData

  // Scroll to appropriate position on load
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
        const currentTimeOffset = (currentMinutes - updatedStartHour * 60) * 1.5 // PIXELS_PER_MINUTE

        // Center it in the viewport (subtract half the container height)
        const scrollTo = currentTimeOffset - containerHeight / 2

        container.scrollTo({
          top: Math.max(0, scrollTo),
          behavior: 'instant'
        })
      } else if (updatedPlacedEntries.length > 0) {
        // Past or future day with entries: scroll to first entry
        const firstEntry = updatedPlacedEntries.reduce((earliest, entry) => {
          return timeToMinutes(entry.placedStartTime) < timeToMinutes(earliest.placedStartTime) ? entry : earliest
        }, updatedPlacedEntries[0])

        const entryOffset = (timeToMinutes(firstEntry.placedStartTime) - updatedStartHour * 60) * 1.5 // PIXELS_PER_MINUTE
        const scrollTo = entryOffset - 60 // 60px padding above

        container.scrollTo({
          top: Math.max(0, scrollTo),
          behavior: 'instant'
        })
      } else if (updatedGhostEvents.length > 0) {
        // Future day with ghost events but no entries: scroll to first ghost event
        const firstGhost = updatedGhostEvents.reduce((earliest, event) => {
          return timeToMinutes(event.startTime) < timeToMinutes(earliest.startTime) ? event : earliest
        }, updatedGhostEvents[0])

        const ghostOffset = (timeToMinutes(firstGhost.startTime) - updatedStartHour * 60) * 1.5 // PIXELS_PER_MINUTE
        const scrollTo = ghostOffset - 60 // 60px padding above

        container.scrollTo({
          top: Math.max(0, scrollTo),
          behavior: 'instant'
        })
      } else {
        // Empty day: scroll to 9am, centered in viewport
        const nineAMOffset = (9 * 60 - updatedStartHour * 60) * 1.5 // PIXELS_PER_MINUTE
        const scrollTo = nineAMOffset - containerHeight / 3

        container.scrollTo({
          top: Math.max(0, scrollTo),
          behavior: 'instant'
        })
      }
    })
  }, [updatedPlacedEntries, updatedGhostEvents, updatedStartHour, isToday])

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
              {/* Hour labels skeleton - faded text placeholders */}
              <div className="w-14 shrink-0 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
                {[8, 9, 10, 11, 12, 13, 14].map((hour) => (
                  <div key={hour} className="flex h-[90px] items-start justify-end pr-2 pt-0">
                    <div className="text-xs text-muted-foreground/30 font-medium">
                      {hour}:00
                    </div>
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

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
        {updatedIsEmpty ? (
          <span className="text-zinc-400 dark:text-zinc-500">
            {!canLog
              ? "No entries for this day"
              : isToday
                ? "No activities logged yet. Tap the timeline to get started!"
                : isFutureDay
                  ? "No plans yet — tap or drag to schedule activities"
                  : "No entries for this day — tap to add what happened"}
          </span>
        ) : (
          <>
            <span>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
            <span className="font-medium">Total: {formatDuration(updatedTotalMinutes)}</span>
          </>
        )}
      </div>

      {/* Timeline container */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <div
          ref={scrollContainerRef}
          className="h-[500px] overflow-y-scroll"
        >
          <TimelineGrid
            startHour={updatedStartHour}
            endHour={updatedEndHour}
            timelineHeight={updatedTimelineHeight}
            isDragging={mouseCreateHook.isDragging}
            isTouchDragging={touchCreateHook.isTouchDragging}
            isAdjustingEntry={entryAdjustmentHook.isAdjustingEntry}
            onMouseDown={mouseCreateHook.handleMouseDown}
            onTouchStart={touchCreateHook.handleTouchStart}
            onDragCreate={!!onDragCreate}
          >
            {/* Empty-state tutorial hint */}
            {updatedIsEmpty && canLog && showTouchHint && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                <div className="flex flex-col items-center gap-3 text-center px-8 pointer-events-auto">
                  <div className="relative">
                    {/* Pulsing circle with touch hint */}
                    <div className="relative">
                      <div className="animate-ping absolute inline-flex h-16 w-16 rounded-full bg-blue-400 opacity-20"></div>
                      <div className="relative inline-flex h-16 w-16 rounded-full bg-blue-500/30 items-center justify-center">
                        <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="bg-card rounded-lg px-4 py-2 border border-border shadow-lg">
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Hold to create entry
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Press and hold for 700ms anywhere on the timeline
                    </p>
                  </div>
                  <button 
                    onClick={hideTouchHint}
                    className="text-xs text-blue-600 dark:text-blue-400 underline hover:no-underline mt-2"
                  >
                    Got it
                  </button>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    Or tap anywhere for quick log
                  </p>
                </div>
              </div>
            )}

            {/* Entry blocks */}
            {updatedPlacedEntries.map((entry) => (
              <TimelineEntry
                key={entry.id}
                entry={entry}
                startHour={updatedStartHour}
                adjustPreview={entryAdjustmentHook.adjustPreview}
                overlappingEntryIds={updatedOverlappingEntryIds}
                onMouseDown={entryAdjustmentHook.handleEntryMouseDown}
                onTouchStart={entryAdjustmentHook.handleEntryTouchStart}
                onClick={handleEntryClick}
              />
            ))}

            {/* Ghost entries (from calendar) */}
            {updatedGhostEvents.map((event) => (
              <TimelineGhost
                key={`ghost-${event.id}`}
                event={event}
                startHour={updatedStartHour}
                isDismissed={dismissedEventIds.has(event.id)}
                isToday={isToday}
                overlappingGhostIds={updatedOverlappingGhostIds}
                onMouseDown={(e, event) => {
                  const isCurrentlyDragging = mouseCreateHook.isDragging || touchCreateHook.isTouchDragging
                  if (isCurrentlyDragging) return
                  handleGhostMouseDown(e, event)
                }}
                onTouchStart={(e, event) => {
                  const isCurrentlyDragging = mouseCreateHook.isDragging || touchCreateHook.isTouchDragging
                  if (isCurrentlyDragging) return
                  handleGhostTouchStart(e, event)
                }}
                onTouchEnd={(e) => {
                  handleGhostTouchEnd(e)
                }}
                onDismiss={dismissGhostEvent}
              />
            ))}

            {/* Unlogged time gap indicators */}
            {updatedTimeGaps.map((gap) => (
              <TimelineGap
                key={`gap-${gap.startTime}-${gap.endTime}`}
                gap={gap}
                startHour={updatedStartHour}
                onDragCreate={(data) => onDragCreate?.(data)}
              />
            ))}

            {/* Drag preview */}
            <DragPreview
              startTime={mouseCreateHook.dragPreviewStart || touchCreateHook.touchDragPreviewStart || ''}
              endTime={mouseCreateHook.dragPreviewEnd || touchCreateHook.touchDragPreviewEnd}
              startHour={updatedStartHour}
              isDragging={mouseCreateHook.isDragging}
              isTouchDragging={touchCreateHook.isTouchDragging}
            />

            {/* Current time indicator */}
            {isToday && (
              <CurrentTimeIndicator startHour={updatedStartHour} endHour={updatedEndHour} />
            )}
          </TimelineGrid>
        </div>

        {/* Legend for estimated entries */}
        {updatedUntimedEntries.length > 0 && (
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
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700/30"
              >
                <Eye className="h-3 w-3" />
                Restore all
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Below-timeline hint for discoverability */}
      {updatedIsEmpty && canLog && (
        <p className="text-center text-xs text-zinc-400 dark:text-zinc-500 mt-2">
          💡 Tip: Hold and drag on the timeline to create entries quickly
        </p>
      )}

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