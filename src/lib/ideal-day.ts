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

import type { TimeCategory, AggregatedCategory } from './types'

export interface IdealWindow {
  /** Hours past midnight, [start, end), for someone who wakes at the reference time. */
  startHour: number
  endHour: number
  /** What the window is called on screen. */
  label: string
  /** Which ring it mostly feeds, for its colour. */
  bucket: AggregatedCategory
  /**
   * What the window is tied to. A `body` window follows your own clock and
   * moves with when you wake. A `clock` window is about other people, who
   * are free at lunch and in the evening whatever your chronotype.
   */
  anchor: 'body' | 'clock'
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
    label: 'Morning movement',
    bucket: 'body',
    anchor: 'body',
    categories: ['exercise', 'movement'],
    reason: 'Morning exercise lifts mood and focus for hours afterwards',
    source: 'exercise-cognition',
  },
  {
    startHour: 8,
    endHour: 9,
    label: 'Plan and refuel',
    bucket: 'ops',
    anchor: 'body',
    categories: ['admin', 'meals'],
    reason: 'Plan and refuel before anything reactive gets to you',
    source: 'circadian',
  },
  {
    startHour: 9,
    endHour: 12,
    label: 'Peak focus',
    bucket: 'focus',
    anchor: 'body',
    categories: ['deep_work', 'creating'],
    reason: 'Peak cognitive hours — cortisol and body temperature are rising',
    source: 'circadian',
  },
  {
    startHour: 12,
    endHour: 13,
    label: 'Midday, with people',
    bucket: 'connection',
    anchor: 'clock',
    categories: ['meals', 'social', 'calls'],
    reason: 'Refuel and connect before the post-lunch dip',
    source: 'harvard-happiness',
  },
  {
    startHour: 13,
    endHour: 14,
    label: 'The dip',
    bucket: 'ops',
    anchor: 'body',
    categories: ['shallow_work', 'admin', 'errands', 'chores'],
    reason: 'The post-lunch dip is for low-stakes work, not for fighting',
    source: 'circadian',
  },
  {
    startHour: 14,
    endHour: 16,
    label: 'Second wind',
    bucket: 'focus',
    anchor: 'body',
    categories: ['deep_work', 'creating'],
    reason: 'The second cognitive peak — good for one 90-minute block',
    source: 'ultradian',
  },
  {
    startHour: 16,
    endHour: 17,
    label: 'Taking things in',
    bucket: 'focus',
    anchor: 'body',
    categories: ['learning'],
    reason: 'Still engaged, past peak intensity: good for taking things in',
    source: 'circadian',
  },
  {
    startHour: 17,
    endHour: 19,
    label: 'Physical peak',
    bucket: 'body',
    anchor: 'body',
    categories: ['exercise', 'movement'],
    reason: 'Body temperature peaks — your best window for physical effort',
    source: 'exercise-cognition',
  },
  {
    startHour: 19,
    endHour: 21,
    label: 'People',
    bucket: 'connection',
    anchor: 'clock',
    categories: ['social', 'calls', 'meals', 'faith'],
    reason: 'Relationships compound, and evenings are when they happen',
    source: 'harvard-happiness',
  },
  {
    startHour: 21,
    endHour: 22,
    label: 'Wind-down',
    bucket: 'recovery',
    anchor: 'body',
    categories: ['entertainment', 'rest', 'self_care'],
    reason: 'A natural wind-down — active leisure beats scrolling',
    source: 'leisure-wellbeing',
  },
]

/** The windows that suit a category, best first. */
export function windowsFor(category: TimeCategory): IdealWindow[] {
  return IDEAL_DAY.filter((window) => window.categories.includes(category))
}

/* ── The same day, moved to when you actually wake ───────────────────────
   The table above is in clock time, for someone up at half past six. A
   person who wakes at five, or at ten, was being handed somebody else's
   day: peak focus at nine whether they had been up four hours or were
   still asleep. The body's windows follow the body, so they move with the
   wake time; the windows that are about other people stay where other
   people are. */

/** The wake time the table is written for. */
export const REFERENCE_WAKE_MINUTES = 6 * 60 + 30
/** The findings are averages; past this the table is being stretched too far. */
const EARLIEST_SHIFT = -120
const LATEST_SHIFT = 240
const DAY = 24 * 60

export interface DayWindow {
  id: string
  label: string
  bucket: AggregatedCategory
  anchor: 'body' | 'clock'
  categories: TimeCategory[]
  reason: string
  source: string
  startMinutes: number
  endMinutes: number
}

/** How far to move the body's windows for someone who wakes at this time, in minutes. */
export function wakeShift(wakeMinutes: number | null): number {
  if (wakeMinutes === null) return 0
  const raw = Math.round((wakeMinutes - REFERENCE_WAKE_MINUTES) / 30) * 30
  return Math.min(LATEST_SHIFT, Math.max(EARLIEST_SHIFT, raw))
}

/** The day's windows for someone who wakes at this time; the reference day when it is not known. */
export function windowsForWake(wakeMinutes: number | null): DayWindow[] {
  const shift = wakeShift(wakeMinutes)
  return IDEAL_DAY.map((window, index) => {
    const move = window.anchor === 'body' ? shift : 0
    return {
      id: `window-${index}`,
      label: window.label,
      bucket: window.bucket,
      anchor: window.anchor,
      categories: window.categories,
      reason: window.reason,
      source: window.source,
      // No window of the body's opens before the body is up: the table's
      // first one starts half an hour ahead of its own reference wake time.
      startMinutes: Math.max(
        window.anchor === 'body' && wakeMinutes !== null ? wakeMinutes : 0,
        window.startHour * 60 + move
      ),
      endMinutes: Math.min(DAY, window.endHour * 60 + move),
    }
  })
    .filter((window) => window.endMinutes > window.startMinutes)
    .sort((a, b) => a.startMinutes - b.startMinutes)
}

const REFERENCE_WINDOWS = windowsForWake(null)

/** The window that suits this category at this minute, if one does. */
export function windowAt(
  category: TimeCategory,
  minute: number,
  windows: DayWindow[] = REFERENCE_WINDOWS
): DayWindow | null {
  return (
    windows.find(
      (w) => w.categories.includes(category) && minute >= w.startMinutes && minute < w.endMinutes
    ) ?? null
  )
}

/** Every window open at this minute, the body's first. */
export function windowsOpenAt(minute: number, windows: DayWindow[]): DayWindow[] {
  return windows
    .filter((w) => minute >= w.startMinutes && minute < w.endMinutes)
    .sort((a, b) => (a.anchor === b.anchor ? 0 : a.anchor === 'body' ? -1 : 1))
}

/**
 * How well a minute suits a category: 1 inside one of its windows, falling
 * away over six hours from the nearest, never below zero. A category with
 * no window scores flat, so it lands wherever there is room.
 */
export function fitAt(
  category: TimeCategory,
  minute: number,
  windows: DayWindow[] = REFERENCE_WINDOWS
): number {
  const own = windows.filter((w) => w.categories.includes(category))
  if (own.length === 0) return 0.5

  let best = 0
  for (const window of own) {
    if (minute >= window.startMinutes && minute < window.endMinutes) return 1
    const distance =
      minute < window.startMinutes ? window.startMinutes - minute : minute - (window.endMinutes - 60)
    best = Math.max(best, Math.max(0, 1 - distance / 360))
  }
  return best
}

/**
 * How well an hour suits a category, on the reference day. Kept for callers
 * that think in whole hours; `fitAt` is the one that knows about wake time.
 */
export function fitAtHour(category: TimeCategory, hour: number): number {
  return fitAt(category, hour * 60)
}
