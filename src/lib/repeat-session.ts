/**
 * "Same as <day>" — repeat part of a session from an earlier day.
 *
 * Most days have a shape: the same work block, the same lunch, the same
 * commute. Logging them costs one modal per entry, which is why the app has
 * three days logged out of the last twenty-one. This finds the most recent
 * day whose matching session was logged, works out which of its activities
 * are still left to log, and builds the ticked ones for a single batch insert.
 *
 * Pure, so the choice of day and the copied times can be tested without a
 * database or a calendar.
 */

import { TimeEntry, TimePeriod, PERIOD_TIME_RANGES, shiftDateString } from './types'
import { getEntriesForPeriod } from './session-utils'
import { findMostlyOverlapping, timeToMinutes, minutesToTime } from './time-utils'

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

/** Equal after trimming, collapsing whitespace and lower-casing. */
export function sameActivityName(a: string, b: string): boolean {
  const norm = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase()
  return norm(a) === norm(b)
}

export interface RepeatRow {
  entry: TimeEntry
  /** The logged entry this row's time mostly sits on, if any. Such a row cannot be ticked. */
  clash: TimeEntry | null
}

/**
 * The candidate's entries that are still left to log on the selected date:
 * a row is gone once this session already has an entry with the same name,
 * however it was logged. Each left row says what it clashes with.
 *
 * @param dayEntries  the selected date's confirmed, visible entries (all sessions)
 */
export function repeatRowsLeft(candidate: RepeatCandidate, dayEntries: TimeEntry[], period: TimePeriod): RepeatRow[] {
  const inSession = getEntriesForPeriod(dayEntries, period)
  return candidate.entries
    .filter((entry) => !inSession.some((logged) => sameActivityName(logged.activity, entry.activity)))
    .map((entry) => ({
      entry,
      clash:
        entry.start_time && entry.end_time
          ? findMostlyOverlapping(entry.start_time, entry.end_time, dayEntries) ?? null
          : null,
    }))
}

/**
 * Where the add screen should start a clashing row: after the entry it
 * overlaps, keeping its length. A row belongs to the session its start falls
 * in, so a start that would land in a later session (or past midnight) is not
 * offered: the entry would be logged there and this session would keep
 * offering the row. The copied times are no use either, since the clash
 * already holds them and saving would be refused. So there is no suggestion
 * and the add screen is told to open with empty times (`blankTimes`), for the
 * person to choose. Without that it would fall to its own defaults, which can
 * sit in another session.
 */
export function retimeAfterClash(row: RepeatRow, period: TimePeriod): { startTime: string; endTime: string } | null {
  const { entry, clash } = row
  if (clash?.end_time) {
    const start = timeToMinutes(clash.end_time)
    const end = start + entry.duration_minutes
    if (end <= 1439 && start < PERIOD_TIME_RANGES[period].end * 60) return { startTime: minutesToTime(start), endTime: minutesToTime(end) }
    return null
  }
  const ownStart = entry.start_time ?? ''
  if (!ownStart) return null
  const ownEnd = entry.end_time ?? minutesToTime(timeToMinutes(ownStart) + entry.duration_minutes)
  return { startTime: ownStart, endTime: ownEnd }
}

/**
 * The ticked entries of the candidate, moved to `date`. Categories come across
 * with them, so repeating a session costs no model calls at all.
 */
export function entriesForRepeat(candidate: RepeatCandidate, date: string, ids: ReadonlySet<string>): RepeatableEntry[] {
  return candidate.entries
    .filter((entry) => ids.has(entry.id))
    .map((entry) => ({
      date,
      activity: entry.activity,
      category: entry.category,
      duration_minutes: entry.duration_minutes,
      start_time: entry.start_time ?? null,
      end_time: entry.end_time ?? null,
    }))
}
