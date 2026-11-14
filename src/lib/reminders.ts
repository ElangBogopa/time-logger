/**
 * The three reminders, and when each is due.
 *
 * Log your morning at lunch, your afternoon at about six, your evening at
 * nine. Each asks about the part of the day that has just gone, while it
 * can still be remembered, and each is skipped when that part is already
 * logged — a reminder to do what you have done is how reminders get turned
 * off.
 *
 * This is the whole of the deciding. The job in /api/cron/reminders asks
 * these functions and sends what they say, so what is tested here is what
 * runs.
 */

import { getCurrentPeriod, type ReminderTime, type TimePeriod } from './types'

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

/** The reminder that is due in this hour, if one is switched on for it. */
export function dueReminder(times: ReminderTime[] | null | undefined, hour: number): ReminderTime | null {
  return (times ?? []).find((time) => time.enabled && reminderHour(time.time) === hour) ?? null
}

/**
 * Whether that part of the day needs no reminding: something in it has a
 * time, or the session was wrapped up or set aside.
 */
export function alreadyLogged(
  period: TimePeriod,
  entries: { start_time: string | null }[],
  completions: { period: string }[]
): boolean {
  if (completions.some((completion) => completion.period === period)) return true
  return entries.some((entry) => {
    if (!entry.start_time) return false
    return getCurrentPeriod(Number(entry.start_time.split(':')[0])) === period
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
