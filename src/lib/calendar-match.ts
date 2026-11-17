/**
 * Which calendar events still need an answer.
 *
 * A calendar event is a claim about the day, not a record of it. Once an
 * entry covers most of its hour the claim has been answered — confirmed, or
 * overridden by whatever was logged instead — and the event should stop
 * being offered. The session view applied this rule and the planner did
 * not, so a meeting confirmed in one place was still listed as unconfirmed
 * in the other.
 */

import { timeToMinutes } from './time-utils'

interface EventTimes {
  startTime: string
  endTime: string
}

interface EntryTimes {
  start_time: string | null
  end_time: string | null
}

/** More than half of the event has to sit inside a single entry. */
const COVERAGE = 0.5

/**
 * The part of a timed range that sits on its own date, in minutes. A range
 * whose end is before its start (22:00-01:00) or at 00:00 runs to midnight
 * here: confirming it saves two entries, one on each day, or one row for a
 * sleep, and the day it was asked about holds the evening. A range with no
 * length stays empty.
 */
function onOwnDay(start: string, end: string): { from: number; to: number } | null {
  const from = timeToMinutes(start)
  const to = timeToMinutes(end)
  if (to === from) return null
  return { from, to: to < from || to === 0 ? 24 * 60 : to }
}

/**
 * How much of the event's own day an entry covers, as a fraction. Used by the
 * confirm sheet's overlap check as well as by `isEventLogged`, so a second
 * confirm of an event that crosses midnight is refused like any other.
 */
export function coverageOnDay(range: EventTimes, entries: EntryTimes[]): number {
  if (!range.startTime || !range.endTime) return 0
  const event = onOwnDay(range.startTime, range.endTime)
  if (!event) return 0
  const duration = event.to - event.from
  let best = 0
  for (const entry of entries) {
    if (!entry.start_time || !entry.end_time) continue
    const own = onOwnDay(entry.start_time, entry.end_time)
    if (!own) continue
    const overlap = Math.min(own.to, event.to) - Math.max(own.from, event.from)
    best = Math.max(best, overlap / duration)
  }
  return best
}

export function isEventLogged(event: EventTimes, entries: EntryTimes[]): boolean {
  return coverageOnDay(event, entries) > COVERAGE
}

export function unconfirmedEvents<E extends EventTimes>(events: E[], entries: EntryTimes[]): E[] {
  return events.filter((event) => !isEventLogged(event, entries))
}
