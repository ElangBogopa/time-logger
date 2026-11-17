/**
 * Entries whose times cross midnight.
 *
 * Anything that is not sleep is split at midnight into two ordinary entries,
 * one on each day (`splitAtMidnight`, applied by the entries API through
 * `planOvernightSave`). Sleep stays one row on the date it was logged on, and
 * its end may be earlier than its start.
 *
 * Which side of midnight a one-piece row sits on is worked out from its own
 * date and times: the day that holds more of it is its day, and a tie goes to
 * the wake-up day.
 *
 * - wake-day: the entry's date is the day it ended; it began the evening
 *   before. 23:00–07:00 on Tuesday is Monday 23:00 to Tuesday 07:00.
 * - start-day: the entry's date is the day it began; it ends the next
 *   morning. 18:00–01:00 on Monday is Monday 18:00 to Tuesday 01:00.
 *
 * Anything that places an entry in a day reads `onDayTimes`, never the raw
 * times. The part on the neighbouring day is `coveredOn`: display only, never
 * summed — the row's whole duration counts on its own date.
 */

import { timeToMinutes, minutesToTime } from './time-utils'
import { shiftDateString, TimeCategory } from './types'

const DAY = 24 * 60

/** HH:MM from a stored HH:MM or HH:MM:SS. */
function hhmm(time: string): string {
  return minutesToTime(timeToMinutes(time))
}

function isMidnight(time: string): boolean {
  const m = timeToMinutes(time)
  return m === 0 || m === DAY
}

/**
 * Start and end both set, the end earlier than the start, and the end not
 * midnight. An end of 00:00 or 24:00 ends exactly at midnight: it does not
 * cross.
 */
export function crossesMidnight(start?: string | null, end?: string | null): boolean {
  if (!start || !end) return false
  if (isMidnight(end)) return false
  return timeToMinutes(end) < timeToMinutes(start)
}

export type OvernightPlacement = 'wake-day' | 'start-day'

/** The day holding more of it; a tie goes to the wake-up day. */
export function overnightPlacement(start: string, end: string): OvernightPlacement {
  const before = DAY - timeToMinutes(start)
  const after = timeToMinutes(end)
  return before > after ? 'start-day' : 'wake-day'
}

/** Minutes from start to end across midnight. */
export function overnightDuration(start: string, end: string): number {
  return DAY - timeToMinutes(start) + timeToMinutes(end)
}

/**
 * A typed end of 00:00 after a later start means the end of the day: stored
 * as 24:00, what dragging on the timeline already writes.
 */
export function normalizeMidnightEnd(start: string | null, end: string | null): string | null {
  if (!start || !end) return end
  if (timeToMinutes(end) === 0 && timeToMinutes(start) > 0) return '24:00'
  return end
}

/** The part of an entry that sits on its own date. No start → null. */
export function onDayTimes(entry: {
  start_time: string | null
  end_time: string | null
}): { start: string; end: string | null } | null {
  const { start_time: start, end_time: end } = entry
  if (!start) return null
  if (!crossesMidnight(start, end)) {
    return { start: hhmm(start), end: end ? hhmm(end) : null }
  }
  if (overnightPlacement(start, end as string) === 'wake-day') {
    return { start: '00:00', end: hhmm(end as string) }
  }
  return { start: hhmm(start), end: '24:00' }
}

export interface MidnightPiece {
  date: string
  start_time: string
  end_time: string
  duration_minutes: number
}

/** The two pieces of a non-sleep entry that crosses midnight. */
export function splitAtMidnight(
  date: string,
  start: string,
  end: string
): [MidnightPiece, MidnightPiece] {
  const s = timeToMinutes(start)
  const e = timeToMinutes(end)
  return [
    { date, start_time: hhmm(start), end_time: '24:00', duration_minutes: DAY - s },
    { date: shiftDateString(date, 1), start_time: '00:00', end_time: hhmm(end), duration_minutes: e },
  ]
}

export interface CoveredBlock {
  entryId: string
  activity: string
  category: TimeCategory | null
  startTime: string
  endTime: string
  /** The date the entry is stored on and counted on. */
  homeDate: string
}

interface CoverableRow {
  id: string
  date: string
  activity: string
  category: TimeCategory | null
  start_time: string | null
  end_time: string | null
}

/**
 * The parts of neighbouring days' one-piece overnight rows that spill into
 * `date`. Rows dated `date` itself give nothing.
 */
export function coveredOn(date: string, rows: readonly CoverableRow[]): CoveredBlock[] {
  const next = shiftDateString(date, 1)
  const prev = shiftDateString(date, -1)
  const blocks: CoveredBlock[] = []
  for (const row of rows) {
    const { start_time: start, end_time: end } = row
    if (!start || !end || !crossesMidnight(start, end)) continue
    const placement = overnightPlacement(start, end)
    const base = {
      entryId: row.id,
      activity: row.activity,
      category: row.category,
      homeDate: row.date,
    }
    if (placement === 'wake-day' && row.date === next) {
      blocks.push({ ...base, startTime: hhmm(start), endTime: '24:00' })
    } else if (placement === 'start-day' && row.date === prev) {
      blocks.push({ ...base, startTime: '00:00', endTime: hhmm(end) })
    }
  }
  return blocks
}

interface SavableRow {
  date: string
  start_time?: string | null
  end_time?: string | null
  duration_minutes: number
}

/**
 * What a save writes: the row as it is (with a typed 00:00 end stored as
 * 24:00), one overnight sleep with its real duration, or two pieces split at
 * midnight, each carrying the row's other fields. The first is what the row
 * itself becomes and keeps the row's date.
 *
 * `dateIsWakeDay` says the row's date is the morning it ended, as for a
 * stored one-piece night placed on its wake day: the evening piece then goes
 * on the day before and the row keeps the morning piece. Otherwise the date
 * is the evening and the morning piece goes on the day after.
 */
export function planOvernightSave<T extends SavableRow>(
  row: T,
  isSleep: boolean,
  { dateIsWakeDay = false }: { dateIsWakeDay?: boolean } = {}
): T[] {
  const start = row.start_time ?? null
  const end = normalizeMidnightEnd(start, row.end_time ?? null)
  const normalized: T = end === (row.end_time ?? null) ? row : { ...row, end_time: end }

  if (!crossesMidnight(start, end)) return [normalized]

  if (isSleep) {
    return [{ ...normalized, duration_minutes: overnightDuration(start as string, end as string) }]
  }

  if (dateIsWakeDay) {
    const [evening, morning] = splitAtMidnight(shiftDateString(row.date, -1), start as string, end as string)
    return [
      { ...normalized, ...morning },
      { ...normalized, ...evening },
    ]
  }

  const [first, second] = splitAtMidnight(row.date, start as string, end as string)
  return [
    { ...normalized, ...first },
    { ...normalized, ...second },
  ]
}
