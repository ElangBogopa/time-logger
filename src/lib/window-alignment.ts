/**
 * How much of what you did landed in the hours that suit it.
 *
 * The app says when focus, movement and people each go best; this is the
 * other half — whether the day actually put them there. It is reported as
 * time, "1h 30m of 2h", and never as a score: the app has one scoring
 * system, and a person whose best hours are not the textbook's is not doing
 * worse for it. Their own log already outranks the windows when the planner
 * suggests a time. This is information, not a mark.
 */

import type { TimeCategory, AggregatedCategory } from './types'
import type { DayWindow } from './ideal-day'
import { timeToMinutes } from './time-utils'

export interface AlignmentEntry {
  category: TimeCategory | null
  start_time: string | null
  end_time: string | null
  duration_minutes: number
}

export interface AlignmentFact {
  key: 'focus' | 'movement' | 'people'
  label: string
  /** The ring this feeds, for its colour. */
  bucket: AggregatedCategory
  /** Time logged in this kind of activity, with a start time. */
  totalMinutes: number
  /** How much of that fell inside a window that suits it. */
  inWindowMinutes: number
}

/**
 * The three things the windows are about. Meals and admin have windows too,
 * but nobody is asking whether lunch was on time.
 */
const GROUPS: { key: AlignmentFact['key']; label: string; bucket: AggregatedCategory; categories: TimeCategory[] }[] = [
  { key: 'focus', label: 'Focused work', bucket: 'focus', categories: ['deep_work', 'creating', 'learning'] },
  { key: 'movement', label: 'Exercise', bucket: 'body', categories: ['exercise', 'movement'] },
  { key: 'people', label: 'Time with people', bucket: 'connection', categories: ['social', 'calls'] },
]

/** Minutes of [start, end) covered by the union of the given intervals. */
function covered(start: number, end: number, intervals: [number, number][]): number {
  const clipped = intervals
    .map(([a, b]) => [Math.max(a, start), Math.min(b, end)] as [number, number])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0])

  let total = 0
  let cursor = start
  for (const [a, b] of clipped) {
    const from = Math.max(a, cursor)
    if (b > from) {
      total += b - from
      cursor = b
    }
  }
  return total
}

/**
 * For a set of entries — a day's, or a week's — how much focused work,
 * exercise and time with people fell inside the windows that suit each.
 * Kinds of activity with nothing logged are left out.
 */
export function windowAlignment(entries: AlignmentEntry[], windows: DayWindow[]): AlignmentFact[] {
  return GROUPS.map((group) => {
    let totalMinutes = 0
    let inWindowMinutes = 0

    for (const entry of entries) {
      if (!entry.category || !group.categories.includes(entry.category) || !entry.start_time) continue
      const start = timeToMinutes(entry.start_time)
      const end = entry.end_time ? timeToMinutes(entry.end_time) : start + entry.duration_minutes
      if (end <= start) continue

      const suited = windows
        .filter((window) => window.categories.includes(entry.category as TimeCategory))
        .map((window) => [window.startMinutes, window.endMinutes] as [number, number])

      totalMinutes += end - start
      inWindowMinutes += covered(start, end, suited)
    }

    return { key: group.key, label: group.label, bucket: group.bucket, totalMinutes, inWindowMinutes }
  }).filter((fact) => fact.totalMinutes > 0)
}

/** The share inside the windows, 0–100, for a sentence that needs one number. */
export function alignmentShare(fact: Pick<AlignmentFact, 'totalMinutes' | 'inWindowMinutes'>): number {
  return fact.totalMinutes > 0 ? Math.round((fact.inWindowMinutes / fact.totalMinutes) * 100) : 0
}
