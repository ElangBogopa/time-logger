import { TimeEntry, TimeCategory } from '@/lib/types'
import { timeToMinutes, minutesToTime } from '@/lib/time-utils'
import { AGGREGATED_COLORS, CATEGORY_TO_AGGREGATED, PIXELS_PER_MINUTE, ENTRY_EDGE_ZONE } from './constants'

// Interfaces
export interface PlacedEntry extends TimeEntry {
  placedStartTime: string
  placedEndTime: string
  isEstimated: boolean
}

export interface TimeGap {
  startMinutes: number
  endMinutes: number
  startTime: string
  endTime: string
  durationMinutes: number
}

// Utility functions
export function getCategoryColors(category: TimeCategory): { bg: string; border: string; text: string } {
  const agg = CATEGORY_TO_AGGREGATED[category] || 'escape'
  const colors = AGGREGATED_COLORS[agg]
  return {
    bg: `${colors.bgLight} ${colors.bgDark}`,
    border: colors.border,
    text: 'text-zinc-800 dark:text-zinc-200',
  }
}

// Find gaps in the timeline where untimed entries could fit
export function findGaps(timedEntries: TimeEntry[], startHour: number, endHour: number): { start: number; end: number }[] {
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
export function smartPlaceEntries(
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
      const usedMinutes = alreadyPlacedBefore.reduce((sum, p) => {
        const entryEnd = timeToMinutes(p.placedEndTime)
        const entryStart = timeToMinutes(p.placedStartTime)
        return sum + (entryEnd - entryStart)
      }, 0)

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

// Snap minutes to :00 or :30 with bias toward :00
// Within each hour: 0-19 → :00, 20-39 → :30, 40-59 → next :00
// Gives :00 a 2:1 capture zone over :30
export function snapToHalfHour(totalMinutes: number): number {
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes - hour * 60
  if (minute < 20) return hour * 60        // snap to :00
  if (minute < 40) return hour * 60 + 30   // snap to :30
  return (hour + 1) * 60                   // snap to next :00
}

// Convert Y position (relative to grid) to time
export function yToTime(clientY: number, scrollContainerRef: React.RefObject<HTMLDivElement>, startHour: number): string {
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

  // Snap to :00 or :30 with bias toward :00
  const snappedMinutes = snapToHalfHour(totalMinutes)

  // Clamp to valid range (startHour to endHour - assuming 24 hour max)
  const minMinutes = startHour * 60
  const maxMinutes = 24 * 60
  const clampedMinutes = Math.max(minMinutes, Math.min(maxMinutes, snappedMinutes))

  return minutesToTime(clampedMinutes)
}

// Detect which zone of an entry was clicked (top edge, bottom edge, or middle)
export type EntryDragType = 'move' | 'resize-top' | 'resize-bottom'

export function detectEntryDragType(
  clientY: number,
  entryTop: number,
  entryHeight: number
): EntryDragType {
  const relativeY = clientY - entryTop
  const topZone = entryHeight * ENTRY_EDGE_ZONE
  const bottomZone = entryHeight * (1 - ENTRY_EDGE_ZONE)

  if (relativeY <= topZone) return 'resize-top'
  if (relativeY >= bottomZone) return 'resize-bottom'
  return 'move'
}