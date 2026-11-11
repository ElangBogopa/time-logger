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
 *
 * And one preference: your own habit outranks the textbook. The research
 * says when a thing tends to go best; your log says when you actually do
 * it, and a plan that ignores that is a plan for somebody else. Where you
 * have a usual hour for something, that hour is proposed first, and the
 * research is quoted only where it happens to agree.
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
  /** The length to plan. Without one, the kind of task decides. */
  durationMinutes?: number
  /** When this person usually does it, from their own log. */
  usualStartMinutes?: number | null
}

export interface Suggestion {
  taskId: string
  title: string
  startTime: string
  endTime: string
  startMinutes: number
  endMinutes: number
  durationMinutes: number
  reason: string
  /** A library entry id, for "why do you say that". */
  source: string | null
  /** What decided the hour: your habit, the research, or simply room. */
  basis: SlotBasis
}

export type SlotBasis = 'habit' | 'research' | 'free'

/** A place a task could go, with why. */
export interface Slot {
  start: number
  score: number
  reason: string
  source: string | null
  basis: SlotBasis
}

export interface SuggestionResult {
  suggestions: Suggestion[]
  /** Tasks there was no honest room for, with why. */
  unplaced: { taskId: string; title: string; reason: string }[]
}

const DEFAULT_DURATION = 60
/**
 * How long a block of each kind tends to be worth planning. Everything was
 * an hour: an hour-long phone call, and an hour of the deep work the
 * library says needs ninety minutes to get anywhere.
 */
const DURATION_BY_CATEGORY: Partial<Record<TimeCategory, number>> = {
  deep_work: 90,
  creating: 90,
  social: 90,
  shallow_work: 45,
  chores: 45,
  calls: 30,
  movement: 30,
  self_care: 30,
  admin: 30,
  faith: 30,
}

export function defaultDuration(category: TimeCategory | null): number {
  return (category && DURATION_BY_CATEGORY[category]) || DEFAULT_DURATION
}

/** A habit counts as "when you usually do this" within this of its hour. */
const HABIT_EXACT = 30
/** Beyond this it has no pull on the choice at all. */
const HABIT_REACH = 120
/** How much a habit outweighs the research: enough to win, not to travel far for. */
const HABIT_WEIGHT = 1.5
/** Alternatives closer together than this are the same suggestion twice. */
const ALTERNATIVE_GAP = 90
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
  const lengthOf = (task: TaskToPlace) => task.durationMinutes ?? defaultDuration(task.category)
  const queue = [...tasks].sort((a, b) => lengthOf(b) - lengthOf(a))

  for (const task of queue) {
    const duration = lengthOf(task)

    if (duration > budget) {
      unplaced.push({
        taskId: task.id,
        title: task.title,
        reason: 'That would leave the day with no room in it',
      })
      continue
    }

    const placement = rankSlots({
      duration,
      category: task.category,
      usualStartMinutes: task.usualStartMinutes ?? null,
      taken,
      from: Math.max(earliestMinutes, nowMinutes ?? earliestMinutes),
      to: latestMinutes,
      limit: 1,
    })[0]

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
      durationMinutes: duration,
      reason: placement.reason,
      source: placement.source,
      basis: placement.basis,
    })
    taken.push({ startMinutes: placement.start, endMinutes: placement.start + duration })
    budget -= duration
  }

  return { suggestions: suggestions.sort((a, b) => a.startMinutes - b.startMinutes), unplaced }
}

/**
 * The places a task could go, best first, each far enough from the others
 * to be a different answer. The first is the suggestion; the rest are what
 * "another time" steps through.
 */
export function rankSlots({
  duration,
  category,
  usualStartMinutes = null,
  taken,
  from = EARLIEST,
  to = LATEST,
  limit = 4,
}: {
  duration: number
  category: TimeCategory | null
  usualStartMinutes?: number | null
  taken: Busy[]
  from?: number
  to?: number
  limit?: number
}): Slot[] {
  const candidates: { start: number; score: number }[] = []

  for (let start = roundUp(from); start + duration <= to; start += SLOT) {
    if (overlaps(start, start + duration, taken)) continue
    const fit = category ? fitAtHour(category, Math.floor(start / 60)) : 0.5
    const habit =
      usualStartMinutes === null ? 0 : Math.max(0, 1 - Math.abs(start - usualStartMinutes) / HABIT_REACH)
    candidates.push({ start, score: fit + HABIT_WEIGHT * habit })
  }

  // Best first; earlier wins ties, so a day fills forwards rather than at random.
  candidates.sort((a, b) => b.score - a.score || a.start - b.start)

  const picked: { start: number; score: number }[] = []
  for (const candidate of candidates) {
    if (picked.length >= limit) break
    if (picked.some((p) => Math.abs(p.start - candidate.start) < ALTERNATIVE_GAP)) continue
    picked.push(candidate)
  }

  return picked.map(({ start, score }) => ({ start, score, ...explain(start, category, usualStartMinutes) }))
}

/** Why this hour, in the words the suggestion will carry. */
function explain(
  start: number,
  category: TimeCategory | null,
  usualStartMinutes: number | null
): { reason: string; source: string | null; basis: SlotBasis } {
  const window = category ? windowFor(category, start) : null
  const offHabit = usualStartMinutes === null ? null : Math.abs(start - usualStartMinutes)

  if (offHabit !== null && offHabit <= HABIT_REACH) {
    const lead = offHabit <= HABIT_EXACT ? 'When you usually do this' : 'Close to when you usually do this'
    return {
      // The research is quoted only where it agrees with the habit.
      reason: window ? `${lead} — ${lowerFirst(window.reason)}` : lead,
      source: window?.source ?? null,
      basis: 'habit',
    }
  }

  if (window) return { reason: window.reason, source: window.source, basis: 'research' }
  return { reason: 'The first clear window in your day', source: null, basis: 'free' }
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
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
