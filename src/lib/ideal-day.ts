/**
 * When things belong in a day.
 *
 * This table has existed since the app was built — as prose on the guide
 * page, where nothing could act on it. It is the rule set behind the time
 * suggestions: each window says which kind of activity suits it, why, and
 * which entry in the library says so, so a suggestion can always answer
 * "why then?".
 *
 * It is a default, not a claim about you. Someone who works nights has a
 * different curve, and the honest fix for that is to learn it from their
 * own logged history rather than to argue with them — which is what
 * `rankSlots` in suggest-times.ts does: a usual hour read from the log by
 * lib/habits.ts outranks any window here.
 */

import type { TimeCategory } from './types'

export interface IdealWindow {
  /** Hours past midnight, [start, end). */
  startHour: number
  endHour: number
  /** The categories this window suits. */
  categories: TimeCategory[]
  /** Said to the person, in the suggestion itself. */
  reason: string
  /** An entry id in lib/library.ts, so the reason can be read in full. */
  source: string
}

export const IDEAL_DAY: IdealWindow[] = [
  {
    startHour: 6,
    endHour: 8,
    categories: ['exercise', 'movement'],
    reason: 'Morning exercise lifts mood and focus for hours afterwards',
    source: 'exercise-cognition',
  },
  {
    startHour: 8,
    endHour: 9,
    categories: ['admin', 'meals'],
    reason: 'Plan and refuel before anything reactive gets to you',
    source: 'circadian',
  },
  {
    startHour: 9,
    endHour: 12,
    categories: ['deep_work', 'creating'],
    reason: 'Peak cognitive hours — cortisol and body temperature are rising',
    source: 'circadian',
  },
  {
    startHour: 12,
    endHour: 13,
    categories: ['meals', 'social', 'calls'],
    reason: 'Refuel and connect before the post-lunch dip',
    source: 'harvard-happiness',
  },
  {
    startHour: 13,
    endHour: 14,
    categories: ['shallow_work', 'admin', 'errands', 'chores'],
    reason: 'The post-lunch dip is for low-stakes work, not for fighting',
    source: 'circadian',
  },
  {
    startHour: 14,
    endHour: 16,
    categories: ['deep_work', 'creating'],
    reason: 'The second cognitive peak — good for one 90-minute block',
    source: 'ultradian',
  },
  {
    startHour: 16,
    endHour: 17,
    categories: ['learning'],
    reason: 'Still engaged, past peak intensity: good for taking things in',
    source: 'circadian',
  },
  {
    startHour: 17,
    endHour: 19,
    categories: ['exercise', 'movement'],
    reason: 'Body temperature peaks — your best window for physical effort',
    source: 'exercise-cognition',
  },
  {
    startHour: 19,
    endHour: 21,
    categories: ['social', 'calls', 'meals', 'faith'],
    reason: 'Relationships compound, and evenings are when they happen',
    source: 'harvard-happiness',
  },
  {
    startHour: 21,
    endHour: 22,
    categories: ['entertainment', 'rest', 'self_care'],
    reason: 'A natural wind-down — active leisure beats scrolling',
    source: 'leisure-wellbeing',
  },
]

/** The windows that suit a category, best first. */
export function windowsFor(category: TimeCategory): IdealWindow[] {
  return IDEAL_DAY.filter((window) => window.categories.includes(category))
}

/**
 * How well an hour suits a category: 1 inside an ideal window, falling away
 * with distance from the nearest one, and never below zero. A category with
 * no opinion scores flat, so it lands wherever there is room.
 */
export function fitAtHour(category: TimeCategory, hour: number): number {
  const windows = windowsFor(category)
  if (windows.length === 0) return 0.5

  let best = 0
  for (const window of windows) {
    if (hour >= window.startHour && hour < window.endHour) return 1
    const distance = hour < window.startHour ? window.startHour - hour : hour - (window.endHour - 1)
    best = Math.max(best, Math.max(0, 1 - distance / 6))
  }
  return best
}
