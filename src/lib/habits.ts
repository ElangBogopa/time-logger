/**
 * What your own log says about when you do things.
 *
 * The suggester knew the research and nothing about you. It proposed the
 * gym at 6am to someone whose log showed a run at 6pm every time and sleep
 * until seven; it made every block an hour; and it waited for you to type
 * "gym" again each evening. The guide the research comes from ends on the
 * line that settles it: the best schedule is the one you actually follow.
 *
 * So: the usual hour and length of a thing, when you wake, and what you do
 * often enough to be worth offering. All of it read from entries already
 * in the log, with thresholds strict enough that a coincidence is not
 * mistaken for a habit.
 */

import type { TimeCategory } from './types'
import { activityMatch, activityKey } from './plan-adherence'
import { timeToMinutes } from './time-utils'

export interface HabitEntry {
  activity: string
  category: TimeCategory | null
  date: string
  start_time: string | null
  end_time: string | null
  duration_minutes: number
}

/** Fewer days than this is an occurrence, not a habit. */
const MIN_DAYS = 3
/** If the usual hour wanders more than this either side, there is no usual hour. */
const MAX_SPREAD_MINUTES = 90
const SLOT = 15

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
const roundTo = (value: number, step: number) => Math.round(value / step) * step

export interface Usual {
  /** Null when the thing is done often but at no settled hour. */
  startMinutes: number | null
  durationMinutes: number
  /** How many separate days this rests on. */
  days: number
  /** Whether it was recognised by name, or only by kind. */
  basis: 'activity' | 'category'
}

/**
 * The usual hour and length of a task, from the days it was logged. Looks
 * first for the task by name; failing that, for its kind — a first yoga
 * class can still borrow the hour you usually exercise.
 */
export function usualFor(
  title: string,
  category: TimeCategory | null,
  entries: HabitEntry[]
): Usual | null {
  const timed = entries.filter((e) => e.start_time && e.duration_minutes > 0)

  const byName = timed.filter((e) => activityMatch(title, e.activity) >= 1)
  const named = summarise(byName, 'activity')
  if (named) return named

  if (!category) return null
  return summarise(timed.filter((e) => e.category === category), 'category')
}

function summarise(matches: HabitEntry[], basis: Usual['basis']): Usual | null {
  // One reading per day: the day's longest instance speaks for it.
  const perDay = new Map<string, HabitEntry>()
  for (const entry of matches) {
    const existing = perDay.get(entry.date)
    if (!existing || entry.duration_minutes > existing.duration_minutes) perDay.set(entry.date, entry)
  }
  if (perDay.size < MIN_DAYS) return null

  const days = [...perDay.values()]
  const starts = days.map((e) => timeToMinutes(e.start_time as string))
  const mid = median(starts)
  const spread = median(starts.map((s) => Math.abs(s - mid)))

  return {
    startMinutes: spread <= MAX_SPREAD_MINUTES ? roundTo(mid, SLOT) : null,
    durationMinutes: Math.min(180, Math.max(SLOT, roundTo(median(days.map((e) => e.duration_minutes)), SLOT))),
    days: perDay.size,
    basis,
  }
}

/**
 * When you usually get up: the end of the sleep that finishes in the
 * morning. Null until there are a few mornings to go on.
 */
export function usualWakeMinutes(entries: HabitEntry[]): number | null {
  const perDay = new Map<string, number>()
  for (const entry of entries) {
    if (entry.category !== 'sleep' || !entry.start_time || !entry.end_time) continue
    const start = timeToMinutes(entry.start_time)
    const end = timeToMinutes(entry.end_time)
    // A night's sleep as it is logged here: begins after midnight (or is
    // the tail of the night) and ends before noon.
    if (end <= start || end > 12 * 60) continue
    perDay.set(entry.date, Math.max(perDay.get(entry.date) ?? 0, end))
  }
  if (perDay.size < MIN_DAYS) return null
  return roundTo(median([...perDay.values()]), SLOT)
}

/**
 * The kinds of thing the planner exists for: what has no owner and no
 * time unless you give it one. Sleep and meals happen anyway, meetings
 * belong to the calendar, and nobody needs reminding to watch television.
 */
const PLANNABLE: TimeCategory[] = [
  'deep_work', 'learning', 'creating',
  'exercise', 'movement',
  'social', 'calls',
  'self_care', 'errands', 'admin',
]

export interface Recurring {
  /** As you most often worded it. */
  title: string
  category: TimeCategory
  days: number
  /** How many of those days fell on the weekday being planned. */
  onThisWeekday: number
}

/**
 * What you do often enough to offer as a one-tap task for a given day,
 * most typical of that weekday first.
 */
export function recurringActivities(
  entries: HabitEntry[],
  {
    forDate,
    alreadyPlanned = [],
    limit = 4,
  }: { forDate: string; alreadyPlanned?: string[]; limit?: number }
): Recurring[] {
  const weekday = new Date(forDate + 'T12:00:00').getDay()
  const groups = new Map<string, { wordings: Map<string, number>; dates: Set<string>; weekdayDates: Set<string>; category: TimeCategory }>()

  for (const entry of entries) {
    if (!entry.category || !PLANNABLE.includes(entry.category)) continue
    const key = activityKey(entry.activity)
    if (!key) continue
    const group = groups.get(key) ?? { wordings: new Map(), dates: new Set(), weekdayDates: new Set(), category: entry.category }
    group.wordings.set(entry.activity, (group.wordings.get(entry.activity) ?? 0) + 1)
    group.dates.add(entry.date)
    if (new Date(entry.date + 'T12:00:00').getDay() === weekday) group.weekdayDates.add(entry.date)
    groups.set(key, group)
  }

  return [...groups.values()]
    .filter((group) => group.dates.size >= MIN_DAYS)
    .map((group) => ({
      title: [...group.wordings.entries()].sort((a, b) => b[1] - a[1])[0][0],
      category: group.category,
      days: group.dates.size,
      onThisWeekday: group.weekdayDates.size,
    }))
    .filter((item) => !alreadyPlanned.some((planned) => activityMatch(planned, item.title) >= 1 || activityMatch(item.title, planned) >= 1))
    .sort((a, b) => b.onThisWeekday - a.onThisWeekday || b.days - a.days || a.title.localeCompare(b.title))
    .slice(0, limit)
}
