/**
 * "Same as <day>" — the one-tap repeat for a session.
 *
 * Most days have a shape: the same work block, the same lunch, the same
 * commute. Logging them costs one modal per entry, which is why the app has
 * three days logged out of the last twenty-one. This finds the most recent
 * day whose matching session was logged, so it can be re-logged in a tap.
 *
 * Pure, so the choice of day and the copied times can be tested without a
 * database or a calendar.
 */

import { TimeEntry, TimePeriod, shiftDateString } from './types'
import { getEntriesForPeriod } from './session-utils'

export interface RepeatCandidate {
  /** The day being copied from. */
  date: string
  /** How to name it to the user: "yesterday", "Monday", "27 Oct". */
  label: string
  entries: TimeEntry[]
  totalMinutes: number
}

/** Fixed, so the label does not depend on the runtime's locale. */
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function describeDay(date: string, today: string): string {
  if (date === shiftDateString(today, -1)) return 'yesterday'
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  // Within the last week a weekday name is unambiguous; past that it is not.
  for (let back = 2; back <= 7; back++) {
    if (date === shiftDateString(today, -back)) return WEEKDAY_NAMES[parsed.getDay()]
  }
  return `${day} ${MONTH_NAMES[month - 1]}`
}

/**
 * The most recent day before `today` whose `period` has entries.
 *
 * @param entries  confirmed entries from the lookback window; days after
 *                 `today` and `today` itself are ignored
 */
export function findRepeatCandidate(
  entries: TimeEntry[],
  period: TimePeriod,
  today: string,
  lookbackDays = 14
): RepeatCandidate | null {
  const earliest = shiftDateString(today, -lookbackDays)

  const byDate = new Map<string, TimeEntry[]>()
  for (const entry of entries) {
    if (entry.date >= today || entry.date < earliest) continue
    const day = byDate.get(entry.date)
    if (day) day.push(entry)
    else byDate.set(entry.date, [entry])
  }

  const candidateDates = [...byDate.keys()].sort().reverse()
  for (const date of candidateDates) {
    const inPeriod = getEntriesForPeriod(byDate.get(date)!, period).sort((a, b) =>
      (a.start_time ?? '').localeCompare(b.start_time ?? '')
    )
    if (inPeriod.length === 0) continue
    return {
      date,
      label: describeDay(date, today),
      entries: inPeriod,
      totalMinutes: inPeriod.reduce((sum, entry) => sum + entry.duration_minutes, 0),
    }
  }

  return null
}

export interface RepeatableEntry {
  date: string
  activity: string
  category: TimeEntry['category']
  duration_minutes: number
  start_time: string | null
  end_time: string | null
}

/**
 * The candidate's entries, moved to `date`. Categories come across with them,
 * so repeating a session costs no model calls at all.
 */
export function entriesForRepeat(candidate: RepeatCandidate, date: string): RepeatableEntry[] {
  return candidate.entries.map((entry) => ({
    date,
    activity: entry.activity,
    category: entry.category,
    duration_minutes: entry.duration_minutes,
    start_time: entry.start_time ?? null,
    end_time: entry.end_time ?? null,
  }))
}
