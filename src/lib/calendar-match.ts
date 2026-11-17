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
import { crossesMidnight, onDayTimes, overnightPlacement } from './overnight'

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

const DAY = 24 * 60

interface Span {
  from: number
  to: number
}

/** An end at 00:00 after a later start is the end of the day. */
function endOfSpan(from: number, to: number): number {
  return to === 0 && from > 0 ? DAY : to
}

/**
 * The part of an event on the day it is listed on. One that runs past
 * midnight (22:00-01:00) holds its evening here: confirming it saves that
 * evening as an entry on this day. An event with no length has no part.
 */
function eventOnDay(event: EventTimes): Span | null {
  const from = timeToMinutes(event.startTime)
  const to = timeToMinutes(event.endTime)
  if (to === from) return null
  return { from, to: to < from ? DAY : endOfSpan(from, to) }
}

/**
 * The part of an entry on its own date, by `onDayTimes` and never the raw
 * times: last night's sleep, 22:30-06:30 on the morning's date, sits at
 * 00:00-06:30 and says nothing about that evening.
 */
function entryOnDay(entry: EntryTimes): Span | null {
  const times = onDayTimes(entry)
  if (!times || !times.end) return null
  const from = timeToMinutes(times.start)
  return { from, to: endOfSpan(from, timeToMinutes(times.end)) }
}

/**
 * Whether an entry is the one row a confirm of this event saved.
 *
 * A sleep confirmed from an event that crosses midnight is one row on the
 * event's date with the event's times. When more of it lies after midnight,
 * `onDayTimes` reads that row as the night before, so its part on the day
 * never meets the event's evening and the day comparison cannot see it. Here
 * the two are compared as whole nights instead. Only an event shaped like
 * that is asked (22:00-01:00 saves a row the day comparison already sees),
 * and each has to cover more than half of the other, so a night's sleep does
 * not answer a shorter late event inside it.
 *
 * A row made this way and last night's sleep typed in by hand are the same
 * row: with a nightly sleep event in the calendar, the morning's own log
 * answers that date's event. A second sleep row on the date would be counted
 * on the same day, so refusing it is the right answer for both.
 */
function isRowOfEvent(event: EventTimes, entry: EntryTimes): boolean {
  const { start_time: start, end_time: end } = entry
  if (!start || !end) return false
  if (!crossesMidnight(event.startTime, event.endTime)) return false
  if (overnightPlacement(event.startTime, event.endTime) !== 'wake-day') return false
  if (!crossesMidnight(start, end)) return false
  if (overnightPlacement(start, end) !== 'wake-day') return false

  const eventFrom = timeToMinutes(event.startTime)
  const eventTo = timeToMinutes(event.endTime) + DAY
  const entryFrom = timeToMinutes(start)
  const entryTo = timeToMinutes(end) + DAY
  const overlap = Math.min(eventTo, entryTo) - Math.max(eventFrom, entryFrom)
  return (
    overlap > (eventTo - eventFrom) * COVERAGE &&
    overlap > (entryTo - entryFrom) * COVERAGE
  )
}

function answers(event: EventTimes, entry: EntryTimes): boolean {
  const eventSpan = eventOnDay(event)
  if (!eventSpan) return false
  const entrySpan = entryOnDay(entry)
  if (entrySpan) {
    const overlap = Math.min(entrySpan.to, eventSpan.to) - Math.max(entrySpan.from, eventSpan.from)
    if (overlap > (eventSpan.to - eventSpan.from) * COVERAGE) return true
  }
  return isRowOfEvent(event, entry)
}

/**
 * Whether one of the day's entries answers the event. The entries are those
 * of the event's own date. The confirm sheet asks the same question of the
 * times it is about to save, so a second confirm is refused wherever the
 * lists have stopped offering the event.
 */
export function isEventLogged(event: EventTimes, entries: EntryTimes[]): boolean {
  if (!event.startTime || !event.endTime) return false
  return entries.some((entry) => answers(event, entry))
}

export function unconfirmedEvents<E extends EventTimes>(events: E[], entries: EntryTimes[]): E[] {
  return events.filter((event) => !isEventLogged(event, entries))
}
