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

export function isEventLogged(event: EventTimes, entries: EntryTimes[]): boolean {
  if (!event.startTime || !event.endTime) return false
  const eventStart = timeToMinutes(event.startTime)
  const eventEnd = timeToMinutes(event.endTime)
  const eventDuration = eventEnd - eventStart
  if (eventDuration <= 0) return false

  return entries.some((entry) => {
    if (!entry.start_time || !entry.end_time) return false
    const overlap =
      Math.min(timeToMinutes(entry.end_time), eventEnd) -
      Math.max(timeToMinutes(entry.start_time), eventStart)
    return overlap / eventDuration > COVERAGE
  })
}

export function unconfirmedEvents<E extends EventTimes>(events: E[], entries: EntryTimes[]): E[] {
  return events.filter((event) => !isEventLogged(event, entries))
}
