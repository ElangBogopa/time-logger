import { useMemo } from 'react'
import { TimeEntry, isPendingEntryReadyToConfirm } from '@/lib/types'
import { timeToMinutes, minutesToTime, formatDuration } from '@/lib/time-utils'
import { CalendarEvent } from '@/components/TimelineView'
import { PlacedEntry } from '@/components/timeline/TimelineEntry'

// Re-export PlacedEntry for convenience
export type { PlacedEntry }

export interface UseTimelineDataParams {
  entries: TimeEntry[]
  calendarEvents: CalendarEvent[]
  dismissedEventIds: Set<string>
  showDismissed: boolean
  visibleStartHour?: number
  visibleEndHour?: number
  isToday?: boolean
  isFutureDay?: boolean
}

export interface TimeGap {
  startMinutes: number
  endMinutes: number
  startTime: string
  endTime: string
  durationMinutes: number
}

export interface UseTimelineDataReturn {
  totalMinutes: number
  ghostEvents: CalendarEvent[]
  overlappingGhostIds: Set<string>
  overlappingEntryIds: Set<string>
  timedEntries: TimeEntry[]
  untimedEntries: TimeEntry[]
  startHour: number
  endHour: number
  placedEntries: PlacedEntry[]
  timeGaps: TimeGap[]
  hours: number[]
  timelineHeight: number
  isEmpty: boolean
}

const PIXELS_PER_MINUTE = 1.5
const HOUR_HEIGHT = 60 * PIXELS_PER_MINUTE // 90px per hour

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

export function useTimelineData({
  entries,
  calendarEvents,
  dismissedEventIds,
  showDismissed,
  visibleStartHour,
  visibleEndHour,
  isToday = true,
  isFutureDay = false,
}: UseTimelineDataParams): UseTimelineDataReturn {
  // Memoize total minutes calculation
  const totalMinutes = useMemo(() => {
    return entries.reduce((sum, entry) => sum + entry.duration_minutes, 0)
  }, [entries])

  // Filter out dismissed ghost events AND ghosts that have been confirmed as entries
  const ghostEvents = useMemo(() => {
    return calendarEvents.filter(event => {
      // Filter out dismissed events (unless showing dismissed)
      if (!showDismissed && dismissedEventIds.has(event.id)) return false

      // Filter out ghosts that have a confirmed entry covering >50% of their time
      const eventStart = timeToMinutes(event.startTime)
      const eventEnd = timeToMinutes(event.endTime)
      const ghostDuration = eventEnd - eventStart

      const hasConfirmedOverlap = entries.some(entry => {
        if (!entry.start_time || !entry.end_time) return false
        if (entry.status !== 'confirmed') return false

        const entryStart = timeToMinutes(entry.start_time)
        const entryEnd = timeToMinutes(entry.end_time)

        // Calculate overlap
        const overlapStart = Math.max(eventStart, entryStart)
        const overlapEnd = Math.min(eventEnd, entryEnd)
        const overlapDuration = Math.max(0, overlapEnd - overlapStart)

        // Hide ghost if confirmed entry covers >50% of it
        return overlapDuration >= ghostDuration * 0.5
      })

      return !hasConfirmedOverlap
    })
  }, [calendarEvents, dismissedEventIds, showDismissed, entries])

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
  // Use props if provided, otherwise show full 24 hours
  const { startHour, endHour } = useMemo(() => {
    if (visibleStartHour !== undefined && visibleEndHour !== undefined) {
      return { startHour: visibleStartHour, endHour: visibleEndHour }
    }
    // Full 24-hour range: 12:00 AM (0) to 11:59 PM (24)
    return { startHour: 0, endHour: 24 }
  }, [visibleStartHour, visibleEndHour])

  // Smart place all entries
  const placedEntries = useMemo(() => {
    return smartPlaceEntries(timedEntries, untimedEntries, startHour, endHour)
  }, [timedEntries, untimedEntries, startHour, endHour])

  // Detect unlogged time gaps between confirmed entries
  const timeGaps: TimeGap[] = useMemo(() => {
    // Don't show gaps on future days or empty days
    if (isFutureDay) return []
    
    // Only consider confirmed entries with actual times
    const confirmedTimed = entries.filter(
      e => e.status === 'confirmed' && e.start_time && e.end_time
    )
    if (confirmedTimed.length === 0) return []

    // Sort by start time
    const sorted = [...confirmedTimed].sort(
      (a, b) => timeToMinutes(a.start_time!) - timeToMinutes(b.start_time!)
    )

    // Determine range: between first and last entry of the day
    // Default waking hours: 7am-11pm, but clamp to actual entries
    const firstEntryStart = timeToMinutes(sorted[0].start_time!)
    const lastEntryEnd = timeToMinutes(sorted[sorted.length - 1].end_time!)
    const rangeStart = Math.min(firstEntryStart, 7 * 60) // Don't start before 7am
    const rangeEnd = Math.max(lastEntryEnd, firstEntryStart) // At minimum, go to last entry

    // For today, also extend to current time
    let effectiveEnd = rangeEnd
    if (isToday) {
      const now = new Date()
      const currentMinutes = now.getHours() * 60 + now.getMinutes()
      effectiveEnd = Math.max(rangeEnd, currentMinutes)
    }

    // Build sorted list of occupied intervals (merge overlapping)
    const intervals: { start: number; end: number }[] = []
    for (const entry of sorted) {
      const s = timeToMinutes(entry.start_time!)
      const e = timeToMinutes(entry.end_time!)
      if (intervals.length > 0 && s <= intervals[intervals.length - 1].end) {
        // Overlapping or adjacent — extend
        intervals[intervals.length - 1].end = Math.max(intervals[intervals.length - 1].end, e)
      } else {
        intervals.push({ start: s, end: e })
      }
    }

    // Find gaps >= 30 minutes between occupied intervals
    const gaps: TimeGap[] = []
    let cursor = rangeStart

    for (const interval of intervals) {
      if (interval.start > cursor) {
        const gapDuration = interval.start - cursor
        if (gapDuration >= 30) {
          gaps.push({
            startMinutes: cursor,
            endMinutes: interval.start,
            startTime: minutesToTime(cursor),
            endTime: minutesToTime(interval.start),
            durationMinutes: gapDuration,
          })
        }
      }
      cursor = Math.max(cursor, interval.end)
    }

    // Check gap after last entry (up to effective end)
    if (effectiveEnd > cursor) {
      const gapDuration = effectiveEnd - cursor
      if (gapDuration >= 30) {
        gaps.push({
          startMinutes: cursor,
          endMinutes: effectiveEnd,
          startTime: minutesToTime(cursor),
          endTime: minutesToTime(effectiveEnd),
          durationMinutes: gapDuration,
        })
      }
    }

    return gaps
  }, [entries, isFutureDay, isToday])

  // Memoize hours array
  const hours = useMemo(() => {
    return Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i)
  }, [startHour, endHour])

  const timelineHeight = (endHour - startHour) * HOUR_HEIGHT

  // Check if this is an empty day (no entries, no ghost events)
  const isEmpty = entries.length === 0 && ghostEvents.length === 0

  return {
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
  }
}