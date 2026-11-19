/**
 * What your log shows: at most one finding for the weekly review.
 *
 * A fixed list of three comparisons over the last three months of the log,
 * each between days that had something and days that did not. A finding
 * needs five days on each side, states both day counts and both figures and
 * nothing else, and is never worded as a cause: a pattern in a person's own
 * log is not evidence of why. It is written here from a template; the model
 * never sees or words it. Never a score, a percentage or a ring.
 */

import type { DayWindow } from './ideal-day'
import { heartMinutes } from './metrics-calc'
import { onDayTimes } from './overnight'
import { shiftDateString } from './types'
import { formatDuration, timeToMinutes } from './time-utils'
import { focusMinutes, longestFocusBlock, median, type Row } from './review-read'

export const MIN_FINDING_DAYS = 5

export type FindingId = 'training-early-late' | 'focus-start-in-window' | 'people-then-next-day'

export interface LogFinding {
  id: FindingId
  sentence: string
}

interface Comparison {
  id: FindingId
  withDays: number
  withoutDays: number
  a: number
  b: number
  /** Under this many minutes apart is too small to say. */
  small: number
  sentence: (a: string, b: string) => string
}

function byDate(rows: Row[]): Map<string, Row[]> {
  const map = new Map<string, Row[]>()
  for (const row of rows) map.set(row.date, [...(map.get(row.date) ?? []), row])
  return map
}

const startOf = (row: Row) => {
  const times = onDayTimes(row)
  return times ? timeToMinutes(times.start) : null
}

const isMovement = (row: Row) => row.category === 'exercise' || row.category === 'movement'

/** The largest movement row of the day: at least 20 real minutes, with a start time. */
function trainingStart(rows: Row[]): number | null {
  let best: Row | null = null
  for (const row of rows) {
    if (!isMovement(row) || row.duration_minutes < 20 || startOf(row) === null) continue
    if (!best || row.duration_minutes > best.duration_minutes) best = row
  }
  return best ? startOf(best) : null
}

/**
 * The finding over `rows` (the caller passes the 90 days ending at the week's
 * last finished day), or null when none of the three qualifies.
 */
export function logFinding({ rows, windows }: { rows: Row[]; windows: DayWindow[] }): LogFinding | null {
  const days = byDate(rows)
  const focusWindows = windows.filter((w) => w.categories.includes('deep_work'))
  const candidates: Comparison[] = []
  const days_ = (n: number) => (n === 1 ? '1 day' : `${n} days`)

  // Training before noon against training later: the day's focused work.
  {
    const early: number[] = []
    const late: number[] = []
    for (const dayRows of days.values()) {
      const start = trainingStart(dayRows)
      if (start === null) continue
      ;(start < 12 * 60 ? early : late).push(focusMinutes(dayRows))
    }
    candidates.push({
      id: 'training-early-late',
      withDays: early.length,
      withoutDays: late.length,
      a: median(early),
      b: median(late),
      small: 30,
      sentence: (a, b) =>
        `On the ${days_(early.length)} you trained before noon, your focused work came to a median of ${a}. On the ${days_(late.length)} you trained later, ${b}.`,
    })
  }

  // The longest focused block started inside a focus window, or outside: its length.
  {
    const inside: number[] = []
    const outside: number[] = []
    for (const dayRows of days.values()) {
      const block = longestFocusBlock(dayRows)
      const start = block ? startOf(block) : null
      if (!block || start === null) continue
      const isInside = focusWindows.some((w) => start >= w.startMinutes && start < w.endMinutes)
      ;(isInside ? inside : outside).push(block.duration_minutes)
    }
    candidates.push({
      id: 'focus-start-in-window',
      withDays: inside.length,
      withoutDays: outside.length,
      a: median(inside),
      b: median(outside),
      small: 15,
      sentence: (a, b) =>
        `On the ${days_(inside.length)} your longest focused block started inside your focus window, its median length was ${a}. On the ${days_(outside.length)} it started outside, ${b}.`,
    })
  }

  // A day with friends or family, or with none: the focused work of the day after.
  {
    const after: number[] = []
    const afterNone: number[] = []
    for (const [date, dayRows] of days) {
      const next = days.get(shiftDateString(date, 1))
      if (!next || next.length === 0) continue
      const heart = heartMinutes(dayRows)
      if (heart >= 30) after.push(focusMinutes(next))
      else if (heart === 0) afterNone.push(focusMinutes(next))
    }
    candidates.push({
      id: 'people-then-next-day',
      withDays: after.length,
      withoutDays: afterNone.length,
      a: median(after),
      b: median(afterNone),
      small: 30,
      sentence: (a, b) =>
        `On the ${days_(after.length)} after a day with friends or family, your focused work came to a median of ${a}. After the ${days_(afterNone.length)} without, ${b}.`,
    })
  }

  let best: { c: Comparison; relative: number } | null = null
  for (const c of candidates) {
    if (c.withDays < MIN_FINDING_DAYS || c.withoutDays < MIN_FINDING_DAYS) continue
    const a = Math.round(c.a)
    const b = Math.round(c.b)
    if (Math.abs(a - b) < c.small) continue
    const relative = Math.abs(a - b) / Math.max(a, b)
    if (!best || relative > best.relative) best = { c, relative }
  }
  if (!best) return null
  return {
    id: best.c.id,
    sentence: best.c.sentence(formatDuration(Math.round(best.c.a)), formatDuration(Math.round(best.c.b))),
  }
}
