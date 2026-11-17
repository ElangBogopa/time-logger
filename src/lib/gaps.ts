/**
 * Unaccounted time in a session: the stretches between what you logged.
 *
 * The timeline asks you to operate a canvas — hold still 100ms, hold 400ms,
 * don't move 5px, drag 20px — to say what you were doing at 11am. A gap row
 * asks the question instead: "11:00–13:30 · 2h 30m unaccounted", one tap,
 * and the day closes up.
 *
 * The Afternoon and Evening search from the session's start (12:00, 18:00),
 * also when nothing is logged yet, so any hour of them can be answered from
 * the session screen. The Morning searches from the first thing logged,
 * because it begins at midnight and nobody wants to be asked to account for
 * being asleep. The far end is now, on today, so it never asks about time
 * that has not happened.
 */

import { TimeEntry } from './types'
import { timeToMinutes, minutesToTime } from './time-utils'

export interface Gap {
  startTime: string
  endTime: string
  durationMinutes: number
}

interface Busy {
  start: number
  end: number
}

export interface FindGapsParams {
  entries: TimeEntry[]
  /** Calendar events count as accounted for: confirming them is their own flow. */
  events?: { startTime: string; endTime: string }[]
  /** The session's bounds, in hours. */
  periodStart: number
  periodEnd: number
  /** Minutes past midnight, on today only. Omit for a finished day. */
  nowMinutes?: number | null
  /** Below this, a gap is a rounding error rather than a question. */
  minimumMinutes?: number
  /**
   * True for the Afternoon and Evening, whose start is a time people are
   * awake; false for the Morning, which starts at midnight.
   */
  fromSessionStart?: boolean
}

export function findUnaccountedGaps({
  entries,
  events = [],
  periodStart,
  periodEnd,
  nowMinutes = null,
  minimumMinutes = 30,
  fromSessionStart = false,
}: FindGapsParams): Gap[] {
  const windowStart = periodStart * 60
  const windowEnd = Math.min(periodEnd * 60, nowMinutes ?? Number.POSITIVE_INFINITY)
  if (!(windowEnd > windowStart)) return []

  const busy: Busy[] = []

  for (const entry of entries) {
    if (!entry.start_time) continue
    const start = timeToMinutes(entry.start_time)
    const end = entry.end_time ? timeToMinutes(entry.end_time) : start + entry.duration_minutes
    // An end at or before the start means it runs past midnight.
    busy.push({ start, end: end > start ? end : 24 * 60 })
  }

  for (const event of events) {
    if (!event.startTime || !event.endTime) continue
    const start = timeToMinutes(event.startTime)
    const end = timeToMinutes(event.endTime)
    busy.push({ start, end: end > start ? end : 24 * 60 })
  }

  // Clip to the session, drop anything outside it
  const clipped = busy
    .map(({ start, end }) => ({ start: Math.max(start, windowStart), end: Math.min(end, windowEnd) }))
    .filter(({ start, end }) => end > start)
    .sort((a, b) => a.start - b.start)

  // Nothing logged in this session yet: that is an empty session, not a gap.
  // "Same as yesterday" and the add button are the answer there.
  if (clipped.length === 0) {
    return fromSessionStart && windowEnd - windowStart >= minimumMinutes
      ? [toGap(windowStart, windowEnd)]
      : []
  }

  const merged: Busy[] = []
  for (const block of clipped) {
    const last = merged[merged.length - 1]
    if (last && block.start <= last.end) {
      last.end = Math.max(last.end, block.end)
    } else {
      merged.push({ ...block })
    }
  }

  const gaps: Gap[] = []
  let cursor = fromSessionStart ? windowStart : merged[0].start

  for (const block of merged) {
    if (block.start - cursor >= minimumMinutes) {
      gaps.push(toGap(cursor, block.start))
    }
    cursor = Math.max(cursor, block.end)
  }

  // And the stretch between the last thing logged and now
  if (windowEnd - cursor >= minimumMinutes) {
    gaps.push(toGap(cursor, windowEnd))
  }

  return gaps
}

function toGap(start: number, end: number): Gap {
  return {
    startTime: minutesToTime(start),
    endTime: minutesToTime(end),
    durationMinutes: end - start,
  }
}
