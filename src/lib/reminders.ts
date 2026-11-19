/**
 * The three reminders, and when each is due.
 *
 * Log your morning at lunch, your afternoon at about six, your evening at
 * nine. Each asks about the part of the day that has just gone, while it
 * can still be remembered, and each is skipped when that part is already
 * logged — a reminder to do what you have done is how reminders get turned
 * off.
 *
 * The job is called late and irregularly, so each reminder has a window
 * rather than an hour: it runs until the next reminder's hour, or midnight.
 * The `reminder_sends` table is what stops a second send inside a window.
 *
 * This is the whole of the deciding. The job in /api/cron/reminders asks
 * these functions and sends what they say, so what is tested here is what
 * runs.
 */

import { getCurrentPeriod, type ReminderTime, type TimePeriod } from './types'
import { onDayTimes } from './overnight'

export interface ReminderKind {
  /** The part of the day it asks about. */
  period: TimePeriod
  title: string
  body: string
}

/**
 * Keyed by the ids the preferences have always been stored under, which
 * name when the reminder arrives rather than what it is about: "midday" is
 * the one about the morning.
 */
export const REMINDER_KINDS: Record<string, ReminderKind> = {
  midday: {
    period: 'morning',
    title: 'Log your morning',
    body: 'A minute now is easier than remembering tonight.',
  },
  evening: {
    period: 'afternoon',
    title: 'Log your afternoon',
    body: 'Where did the afternoon go? A minute now saves guessing later.',
  },
  night: {
    period: 'evening',
    title: 'Log your evening',
    body: 'Close the day, then read your review.',
  },
}

export interface LocalClock {
  /** 0–23, where this person is. */
  hour: number
  /** YYYY-MM-DD, where this person is. */
  date: string
}

/**
 * The hour and the date in someone's timezone. The server's own clock is
 * no use for either: at nine in the evening in Toronto it is already
 * tomorrow in UTC, which is how "have they logged today?" used to be asked
 * about the wrong day.
 */
export function localClock(now: Date, timeZone: string | null | undefined): LocalClock {
  const read = (zone: string): LocalClock => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now)
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
    return { hour: Number(part('hour')) % 24, date: `${part('year')}-${part('month')}-${part('day')}` }
  }
  try {
    return read(timeZone || 'UTC')
  } catch {
    // A timezone the runtime does not know.
    return read('UTC')
  }
}

/** The hour a stored reminder time falls in. Minutes are ignored: the job runs once an hour. */
export function reminderHour(time: string): number {
  const hour = Number(time.split(':')[0])
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : -1
}

/** Before this hour a reminder is sent in its own hour only, never late. */
const SMALL_HOURS_END = 5

/**
 * The one reminder a run at this hour may send: the switched-on reminder
 * with the latest hour that has already come today. A run that arrives
 * late still finds it, until the next reminder's hour takes over or the
 * day ends; one set for the small hours (before 5) is sent in its own
 * hour only. An earlier one that was missed is left: one reminder at a
 * time, and the most recent part of the day is the one still remembered.
 */
export function dueReminder(times: ReminderTime[] | null | undefined, hour: number): ReminderTime | null {
  let best: ReminderTime | null = null
  let bestHour = -1
  for (const time of times ?? []) {
    if (!time.enabled) continue
    const at = reminderHour(time.time)
    if (at < 0 || at > hour) continue
    // A reminder set for the small hours gets no late window: run at
    // 7 it would be about the new day, not the one it was meant to close.
    if (at < SMALL_HOURS_END && at !== hour) continue
    if (at >= bestHour) {
      best = time
      bestHour = at
    }
  }
  return best
}

/**
 * Whether that part of the day needs no reminding: something in it has a
 * time, or the session was wrapped up or set aside.
 */
export function alreadyLogged(
  period: TimePeriod,
  entries: { start_time: string | null; end_time?: string | null }[],
  completions: { period: string }[]
): boolean {
  if (completions.some((completion) => completion.period === period)) return true
  return entries.some((entry) => {
    // Where it starts on this date: an older one-piece row of 23:00–07:00 is
    // this morning's, not this evening's (lib/overnight.ts).
    const start = onDayTimes({ start_time: entry.start_time, end_time: entry.end_time ?? null })?.start
    if (!start) return false
    return getCurrentPeriod(Number(start.split(':')[0])) === period
  })
}

export interface ReminderNotification {
  title: string
  body: string
  /** Where a tap goes: the session being asked about. */
  url: string
  /** One per part of the day, so a second send replaces the first instead of stacking. */
  tag: string
}

export function notificationFor(reminderId: string): ReminderNotification {
  const kind = REMINDER_KINDS[reminderId]
  if (!kind) return { title: 'Log your day', body: 'A minute now is easier than remembering later.', url: '/', tag: 'reminder' }
  return { title: kind.title, body: kind.body, url: `/log/${kind.period}`, tag: `reminder-${kind.period}` }
}

/** What the settings screen calls a reminder: by what it asks, not by a stored label. */
export function reminderLabel(reminder: Pick<ReminderTime, 'id' | 'label'>): string {
  return REMINDER_KINDS[reminder.id]?.title ?? reminder.label
}

/** "12 PM", for a picker of whole hours. */
export function formatHour(hour: number): string {
  const twelve = hour % 12 === 0 ? 12 : hour % 12
  return `${twelve} ${hour < 12 ? 'AM' : 'PM'}`
}
