/**
 * @jest-environment node
 *
 * The three reminders: which is due, where the person is, and whether it is
 * still needed.
 */

import {
  REMINDER_KINDS,
  alreadyLogged,
  dueReminder,
  formatHour,
  localClock,
  notificationFor,
  reminderHour,
  reminderLabel,
} from '@/lib/reminders'
import { DEFAULT_REMINDER_TIMES } from '@/lib/types'

describe('the hour and the date where someone is', () => {
  it('is their own, not the server’s', () => {
    // 02:00 UTC on the 12th is nine in the evening of the 11th in Toronto.
    const now = new Date('2026-11-12T02:00:00Z')
    expect(localClock(now, 'America/Toronto')).toEqual({ hour: 21, date: '2026-11-11' })
    expect(localClock(now, 'UTC')).toEqual({ hour: 2, date: '2026-11-12' })
    expect(localClock(now, 'Pacific/Auckland')).toEqual({ hour: 15, date: '2026-11-12' })
  })

  it('reads midnight as hour 0', () => {
    expect(localClock(new Date('2026-11-12T00:10:00Z'), 'UTC').hour).toBe(0)
  })

  it('follows daylight saving', () => {
    // Noon in Toronto is 16:00 UTC in July and 17:00 UTC in November.
    expect(localClock(new Date('2026-07-01T16:05:00Z'), 'America/Toronto').hour).toBe(12)
    expect(localClock(new Date('2026-11-12T17:05:00Z'), 'America/Toronto').hour).toBe(12)
  })

  it('falls back to UTC for a timezone it is not given or does not know', () => {
    const now = new Date('2026-11-12T17:05:00Z')
    expect(localClock(now, null).hour).toBe(17)
    expect(localClock(now, 'Mars/Olympus_Mons').hour).toBe(17)
  })
})

describe('which reminder is due', () => {
  it('is the one set for this hour', () => {
    expect(dueReminder(DEFAULT_REMINDER_TIMES, 12)?.id).toBe('midday')
    expect(dueReminder(DEFAULT_REMINDER_TIMES, 18)?.id).toBe('evening')
    expect(dueReminder(DEFAULT_REMINDER_TIMES, 21)?.id).toBe('night')
  })

  it('is none in any other hour', () => {
    for (const hour of [0, 7, 11, 13, 17, 19, 20, 22, 23]) expect(dueReminder(DEFAULT_REMINDER_TIMES, hour)).toBeNull()
  })

  it('is none when that reminder is switched off', () => {
    const times = DEFAULT_REMINDER_TIMES.map((time) => (time.id === 'midday' ? { ...time, enabled: false } : time))
    expect(dueReminder(times, 12)).toBeNull()
    expect(dueReminder(times, 18)?.id).toBe('evening')
  })

  it('goes by the hour: the job runs once an hour, so 12:30 is sent with the twelves', () => {
    const times = [{ id: 'midday', label: 'x', time: '12:30', enabled: true }]
    expect(dueReminder(times, 12)?.id).toBe('midday')
    expect(dueReminder(times, 13)).toBeNull()
  })

  it('survives a time that is not one', () => {
    expect(reminderHour('soon')).toBe(-1)
    expect(dueReminder([{ id: 'midday', label: 'x', time: 'soon', enabled: true }], 12)).toBeNull()
    expect(dueReminder(null, 12)).toBeNull()
  })
})

describe('whether that part of the day still needs reminding', () => {
  it('does not when something in it has been logged', () => {
    expect(alreadyLogged('morning', [{ start_time: '09:30:00' }], [])).toBe(true)
    expect(alreadyLogged('afternoon', [{ start_time: '14:00:00' }], [])).toBe(true)
    expect(alreadyLogged('evening', [{ start_time: '19:00:00' }], [])).toBe(true)
  })

  it('still does when only another part of the day has', () => {
    expect(alreadyLogged('morning', [{ start_time: '14:00:00' }], [])).toBe(false)
    expect(alreadyLogged('afternoon', [{ start_time: '09:30:00' }, { start_time: '18:00:00' }], [])).toBe(false)
  })

  it('does not when the session was wrapped up or set aside', () => {
    expect(alreadyLogged('morning', [], [{ period: 'morning' }])).toBe(true)
    expect(alreadyLogged('morning', [], [{ period: 'afternoon' }])).toBe(false)
  })

  it('ignores an entry with no time: it cannot be placed in a part of the day', () => {
    expect(alreadyLogged('morning', [{ start_time: null }], [])).toBe(false)
  })
})

describe('what is sent', () => {
  it('asks for the part of the day just gone, and opens it', () => {
    expect(notificationFor('midday')).toEqual({
      title: 'Log your morning',
      body: REMINDER_KINDS.midday.body,
      url: '/log/morning',
      tag: 'reminder-morning',
    })
    expect(notificationFor('evening')).toMatchObject({ title: 'Log your afternoon', url: '/log/afternoon' })
    expect(notificationFor('night')).toMatchObject({ title: 'Log your evening', url: '/log/evening' })
  })

  it('is plain: no emoji, no streaks, nothing about being missed', () => {
    for (const kind of Object.values(REMINDER_KINDS)) {
      const text = `${kind.title} ${kind.body}`
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u)
      expect(text).not.toMatch(/streak|miss you|don.t break/i)
    }
  })

  it('has something to say for a reminder it does not know', () => {
    expect(notificationFor('something-new')).toMatchObject({ title: 'Log your day', url: '/' })
  })
})

describe('on the settings screen', () => {
  it('names a reminder by what it asks, not by the label it was stored with', () => {
    expect(reminderLabel({ id: 'midday', label: 'Midday check-in' })).toBe('Log your morning')
    expect(reminderLabel({ id: 'custom', label: 'My own' })).toBe('My own')
  })

  it('writes hours the way a clock does', () => {
    expect([0, 9, 12, 18, 21, 23].map(formatHour)).toEqual(['12 AM', '9 AM', '12 PM', '6 PM', '9 PM', '11 PM'])
  })
})
