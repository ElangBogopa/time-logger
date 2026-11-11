/**
 * Next up: the day's plan and calendar, as a list you can act on.
 *
 * The plan lived on the Plan tab and nowhere else. You planned tomorrow,
 * and tomorrow's Today screen showed three empty rings and "Morning — Not
 * logged": the thing you had committed to was one tab away from the place
 * you would do it from. This is the plan carried across — in time order,
 * with each item in one of a few plain states, so that the screen can say
 * what is next and ask about what has passed.
 *
 * It decides nothing new. Whether a plan happened is `comparePlanToActual`,
 * and whether a calendar event has been answered is `isEventLogged`; this
 * only arranges their answers around the clock.
 */

import { comparePlanToActual, type PlanRow, type EntryRow, type PlanOutcome } from './plan-adherence'
import { isEventLogged } from './calendar-match'
import { timeToMinutes } from './time-utils'

export type NextUpState =
  /** Happened: ticked, or recognised in the log. */
  | 'done'
  /** Its time has passed and nothing says what became of it. */
  | 'due'
  /** In its hour right now. */
  | 'now'
  | 'upcoming'
  /** Set aside for today by the user. */
  | 'skipped'

export interface NextUpItem {
  key: string
  kind: 'plan' | 'event'
  id: string
  title: string
  startTime: string
  endTime: string
  state: NextUpState
  /** A due plan: what was logged in its hour instead, if anything was. */
  loggedActivity: string | null
  /** A done plan: kept in its hour, or moved to another. */
  outcome: PlanOutcome | null
}

export interface NextUpEvent {
  id: string
  title: string
  startTime: string
  endTime: string
}

export interface NextUp {
  items: NextUpItem[]
  /** Tasks for the day that have no time yet. */
  untimed: PlanRow[]
  /** Items waiting on an answer. */
  dueCount: number
}

export function buildNextUp({
  plans,
  entries,
  events = [],
  nowMinutes,
  skipped = [],
}: {
  plans: PlanRow[]
  entries: (EntryRow & { start_time: string | null; end_time: string | null })[]
  events?: NextUpEvent[]
  /**
   * Minutes past midnight on today. `null` for a day that is over, where
   * nothing is still upcoming; `0` for a day that has not begun.
   */
  nowMinutes: number | null
  /** Keys the user has set aside, as `plan-<id>` or `event-<id>`. */
  skipped?: string[]
}): NextUp {
  const skippedKeys = new Set(skipped)
  const items: NextUpItem[] = []

  const stateByClock = (start: string, end: string): 'due' | 'now' | 'upcoming' => {
    if (nowMinutes === null) return 'due'
    if (nowMinutes < timeToMinutes(start)) return 'upcoming'
    if (nowMinutes < timeToMinutes(end)) return 'now'
    return 'due'
  }

  for (const comparison of comparePlanToActual({ plans, entries, nowMinutes })) {
    const key = `plan-${comparison.id}`
    const done = comparison.outcome === 'kept' || comparison.outcome === 'moved'
    const byClock = stateByClock(comparison.committedStart, comparison.committedEnd)
    items.push({
      key,
      kind: 'plan',
      id: comparison.id,
      title: comparison.title,
      startTime: comparison.committedStart,
      endTime: comparison.committedEnd,
      // Done wins over everything; a skip only matters once the hour has passed.
      state: done ? 'done' : byClock === 'due' && skippedKeys.has(key) ? 'skipped' : byClock,
      loggedActivity: done ? null : comparison.loggedActivity,
      outcome: done ? comparison.outcome : null,
    })
  }

  for (const event of events) {
    if (!event.startTime || !event.endTime) continue
    // An event something already covers is in the log as that entry.
    if (isEventLogged(event, entries)) continue
    const key = `event-${event.id}`
    const byClock = stateByClock(event.startTime, event.endTime)
    items.push({
      key,
      kind: 'event',
      id: event.id,
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      state: byClock === 'due' && skippedKeys.has(key) ? 'skipped' : byClock,
      loggedActivity: null,
      outcome: null,
    })
  }

  items.sort(
    (a, b) =>
      timeToMinutes(a.startTime) - timeToMinutes(b.startTime) ||
      // The fixed thing first when two start together: the plan fits around it.
      (a.kind === b.kind ? 0 : a.kind === 'event' ? -1 : 1)
  )

  return {
    items,
    untimed: plans.filter((plan) => !plan.committed_start || !plan.committed_end).filter((plan) => !plan.completed),
    dueCount: items.filter((item) => item.state === 'due').length,
  }
}

/** Where the "now" line goes: the index of the first item that has not started. */
export function nowLineIndex(items: NextUpItem[], nowMinutes: number | null): number | null {
  if (nowMinutes === null || items.length === 0) return null
  const index = items.findIndex((item) => timeToMinutes(item.startTime) > nowMinutes)
  return index === -1 ? items.length : index
}
