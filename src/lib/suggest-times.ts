/**
 * When to do the things nobody else has scheduled for you.
 *
 * Google Calendar holds commitments with other people, at times other
 * people chose. Everything else — the deep work, the gym, the call home —
 * has no owner and no time, which is most of why it does not happen. This
 * fits those around the fixed things, and says why it chose each hour.
 *
 * Three rules it will not break:
 *
 *   1. It never touches a calendar event or anything already placed. It
 *      only proposes, into space that is free.
 *   2. It leaves the day room to breathe. The leisure study in the library
 *      says too little free time costs as much as too much, so the app
 *      should not pack every gap it finds.
 *   3. Every suggestion carries its reason and its source. A suggestion you
 *      cannot interrogate is a guess with a confident voice.
 */

import type { TimeCategory } from './types'
import { fitAtHour, windowsFor, type IdealWindow } from './ideal-day'
import { minutesToTime } from './time-utils'

export interface Busy {
  startMinutes: number
  endMinutes: number
}

export interface TaskToPlace {
  id: string
  title: string
  /** From the categoriser; null means "no opinion about when". */
  category: TimeCategory | null
  /** Defaults to an hour, the length of a block someone will actually do. */
  durationMinutes?: number
}

export interface Suggestion {
  taskId: string
  title: string
  startTime: string
  endTime: string
  startMinutes: number
  endMinutes: number
  reason: string
  /** A library entry id, for "why do you say that". */
  source: string | null
}

export interface SuggestionResult {
  suggestions: Suggestion[]
  /** Tasks there was no honest room for, with why. */
  unplaced: { taskId: string; title: string; reason: string }[]
}

const DEFAULT_DURATION = 60
const SLOT = 15
/** Never schedule into the small hours, whatever the gaps say. */
const EARLIEST = 6 * 60
const LATEST = 22 * 60
/** Leave the day some slack: the library is explicit that free time matters. */
const MAX_SUGGESTED_MINUTES = 4 * 60

export function suggestTimes({
  tasks,
  busy,
  nowMinutes = null,
  earliestMinutes = EARLIEST,
  latestMinutes = LATEST,
}: {
  tasks: TaskToPlace[]
  busy: Busy[]
  /** On today, nothing is proposed in the past. */
  nowMinutes?: number | null
  earliestMinutes?: number
  latestMinutes?: number
}): SuggestionResult {
  const taken: Busy[] = busy
    .filter((b) => b.endMinutes > b.startMinutes)
    .map((b) => ({ ...b }))

  const suggestions: Suggestion[] = []
  const unplaced: SuggestionResult['unplaced'] = []
  let budget = MAX_SUGGESTED_MINUTES

  // Longest first: the awkward blocks need the choice of gaps, and a
  // 90-minute task placed after four short ones has nowhere left to go.
  const queue = [...tasks].sort(
    (a, b) => (b.durationMinutes ?? DEFAULT_DURATION) - (a.durationMinutes ?? DEFAULT_DURATION)
  )

  for (const task of queue) {
    const duration = task.durationMinutes ?? DEFAULT_DURATION

    if (duration > budget) {
      unplaced.push({
        taskId: task.id,
        title: task.title,
        reason: 'That would leave the day with no room in it',
      })
      continue
    }

    const placement = bestSlot({
      duration,
      category: task.category,
      taken,
      from: Math.max(earliestMinutes, nowMinutes ?? earliestMinutes),
      to: latestMinutes,
    })

    if (!placement) {
      unplaced.push({
        taskId: task.id,
        title: task.title,
        reason: 'No free window long enough today',
      })
      continue
    }

    suggestions.push({
      taskId: task.id,
      title: task.title,
      startTime: minutesToTime(placement.start),
      endTime: minutesToTime(placement.start + duration),
      startMinutes: placement.start,
      endMinutes: placement.start + duration,
      reason: placement.reason,
      source: placement.source,
    })
    taken.push({ startMinutes: placement.start, endMinutes: placement.start + duration })
    budget -= duration
  }

  return { suggestions: suggestions.sort((a, b) => a.startMinutes - b.startMinutes), unplaced }
}

function bestSlot({
  duration,
  category,
  taken,
  from,
  to,
}: {
  duration: number
  category: TimeCategory | null
  taken: Busy[]
  from: number
  to: number
}): { start: number; reason: string; source: string | null } | null {
  let best: { start: number; score: number } | null = null

  for (let start = roundUp(from); start + duration <= to; start += SLOT) {
    if (overlaps(start, start + duration, taken)) continue
    const score = category ? fitAtHour(category, Math.floor(start / 60)) : 0.5
    // Earlier wins ties, so a day fills forwards rather than at random.
    if (!best || score > best.score) best = { start, score }
  }

  if (!best) return null

  const window = category ? windowFor(category, best.start) : null
  return {
    start: best.start,
    reason: window ? window.reason : 'The first clear window in your day',
    source: window?.source ?? null,
  }
}

function windowFor(category: TimeCategory, startMinutes: number): IdealWindow | null {
  const hour = Math.floor(startMinutes / 60)
  return windowsFor(category).find((w) => hour >= w.startHour && hour < w.endHour) ?? null
}

function overlaps(start: number, end: number, taken: Busy[]): boolean {
  return taken.some((b) => start < b.endMinutes && end > b.startMinutes)
}

function roundUp(minutes: number): number {
  return Math.ceil(minutes / SLOT) * SLOT
}
