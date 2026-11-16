/**
 * @jest-environment node
 *
 * Choosing the day a session repeats from, and moving its entries to today.
 */

import {
  findRepeatCandidate,
  entriesForRepeat,
  describeDay,
  repeatRowsLeft,
  retimeAfterClash,
  sameActivityName,
} from '@/lib/repeat-session'
import type { TimeEntry } from '@/lib/types'

const entry = (date: string, activity: string, start: string, minutes: number): TimeEntry =>
  ({
    id: `${date}-${activity}-${start}`,
    user_id: 'u1',
    date,
    activity,
    category: 'deep_work',
    duration_minutes: minutes,
    start_time: start,
    end_time: start,
    status: 'confirmed',
  }) as TimeEntry

const TODAY = '2026-11-03' // a Tuesday

describe('picking the day to repeat', () => {
  it('takes the most recent day that has entries in this session', () => {
    const candidate = findRepeatCandidate(
      [
        entry('2026-10-30', 'Older work', '09:00', 120),
        entry('2026-11-02', 'Work', '09:00', 240),
        entry('2026-11-02', 'Emails', '11:00', 30),
      ],
      'morning',
      TODAY
    )

    expect(candidate?.date).toBe('2026-11-02')
    expect(candidate?.entries.map((e) => e.activity)).toEqual(['Work', 'Emails'])
    expect(candidate?.totalMinutes).toBe(270)
  })

  it('skips days that logged a different session', () => {
    // Yesterday only has an evening entry, so the morning repeat has to reach
    // further back rather than offer an empty day.
    const candidate = findRepeatCandidate(
      [
        entry('2026-11-02', 'Netflix', '20:00', 90),
        entry('2026-10-31', 'Work', '09:00', 240),
      ],
      'morning',
      TODAY
    )

    expect(candidate?.date).toBe('2026-10-31')
  })

  it('ignores today and anything after it', () => {
    const candidate = findRepeatCandidate(
      [
        entry(TODAY, 'Work', '09:00', 60),
        entry('2026-11-04', 'Planned work', '09:00', 60),
      ],
      'morning',
      TODAY
    )

    expect(candidate).toBeNull()
  })

  it('ignores days older than the lookback window', () => {
    const old = findRepeatCandidate([entry('2026-10-01', 'Work', '09:00', 60)], 'morning', TODAY)
    expect(old).toBeNull()

    const within = findRepeatCandidate([entry('2026-10-01', 'Work', '09:00', 60)], 'morning', TODAY, 40)
    expect(within?.date).toBe('2026-10-01')
  })

  it('returns null when nothing has ever been logged', () => {
    expect(findRepeatCandidate([], 'afternoon', TODAY)).toBeNull()
  })

  it('orders the entries by start time, whatever order they arrive in', () => {
    const candidate = findRepeatCandidate(
      [
        entry('2026-11-02', 'Emails', '11:00', 30),
        entry('2026-11-02', 'Standup', '09:30', 15),
        entry('2026-11-02', 'Work', '09:00', 30),
      ],
      'morning',
      TODAY
    )

    expect(candidate?.entries.map((e) => e.activity)).toEqual(['Work', 'Standup', 'Emails'])
  })
})

describe('naming the day', () => {
  it('calls the day before yesterday', () => {
    expect(describeDay('2026-11-02', TODAY)).toBe('yesterday')
  })

  it('uses the weekday within the last week', () => {
    expect(describeDay('2026-11-01', TODAY)).toBe('Sunday')
    expect(describeDay('2026-10-28', TODAY)).toBe('Wednesday')
  })

  it('uses a date once a weekday would be ambiguous', () => {
    // Eight days back is the same weekday as yesterday; "Monday" would lie.
    expect(describeDay('2026-10-26', TODAY)).toBe('26 Oct')
  })
})

describe('copying the entries onto today', () => {
  // 13:00 would be the afternoon session, not the morning one.
  const candidate = findRepeatCandidate(
    [entry('2026-11-02', 'Work', '09:00', 240), entry('2026-11-02', 'Emails', '11:00', 30)],
    'morning',
    TODAY
  )!
  const ALL_IDS = new Set(candidate.entries.map((e) => e.id))

  it('keeps the times, the durations and the categories', () => {
    const copied = entriesForRepeat(candidate, TODAY, ALL_IDS)

    expect(copied).toEqual([
      { date: TODAY, activity: 'Work', category: 'deep_work', duration_minutes: 240, start_time: '09:00', end_time: '09:00' },
      { date: TODAY, activity: 'Emails', category: 'deep_work', duration_minutes: 30, start_time: '11:00', end_time: '11:00' },
    ])
  })

  it('carries the category across, so a repeat costs no model calls', () => {
    expect(entriesForRepeat(candidate, TODAY, ALL_IDS).every((e) => e.category !== null)).toBe(true)
  })
})

/** An entry with a real end time. */
const span = (date: string, activity: string, start: string, end: string, minutes: number, category: TimeEntry['category'] = 'deep_work'): TimeEntry =>
  ({ ...entry(date, activity, start, minutes), end_time: end, category }) as TimeEntry

describe('what counts as left', () => {
  const copied = findRepeatCandidate(
    [span('2026-11-02', 'Dentist', '09:00', '10:00', 60), span('2026-11-02', 'Emails', '10:00', '10:30', 30)],
    'morning',
    TODAY
  )!

  it('drops a row once this session has the same name, however it is spelt or timed', () => {
    const rows = repeatRowsLeft(copied, [span(TODAY, '  dentist ', '07:00', '07:15', 15)], 'morning')
    expect(rows.map((r) => r.entry.activity)).toEqual(['Emails'])
  })

  it('keeps a row when the logged entry has a different name', () => {
    const rows = repeatRowsLeft(copied, [span(TODAY, 'Gym', '07:00', '07:30', 30)], 'morning')
    expect(rows.map((r) => r.entry.activity)).toEqual(['Dentist', 'Emails'])
  })

  it('keeps a row when the same name was logged in another session', () => {
    const rows = repeatRowsLeft(copied, [span(TODAY, 'Dentist', '20:00', '21:00', 60)], 'morning')
    expect(rows.map((r) => r.entry.activity)).toEqual(['Dentist', 'Emails'])
  })

  it('is empty once every name is logged', () => {
    const rows = repeatRowsLeft(
      copied,
      [span(TODAY, 'Dentist', '07:00', '08:00', 60), span(TODAY, 'emails', '08:00', '08:30', 30)],
      'morning'
    )
    expect(rows).toEqual([])
  })
})

describe('what counts as a clash', () => {
  const copied = findRepeatCandidate([span('2026-11-02', 'Dentist', '09:00', '10:00', 60)], 'morning', TODAY)!

  it('names the logged entry that covers more than half of the row', () => {
    const gym = span(TODAY, 'Gym', '08:00', '09:45', 105)
    expect(repeatRowsLeft(copied, [gym], 'morning')[0].clash).toBe(gym)
  })

  it('is not a clash at exactly half', () => {
    const gym = span(TODAY, 'Gym', '08:00', '09:30', 90)
    expect(repeatRowsLeft(copied, [gym], 'morning')[0].clash).toBeNull()
  })

  it('counts an entry from another session', () => {
    // 09:00-10:00 is a morning entry; the afternoon session still sees it as a clash
    const late = span(TODAY, 'Late', '09:00', '10:00', 60)
    expect(repeatRowsLeft(copied, [late], 'afternoon')[0].clash).toBe(late)
  })

  it('never clashes for a row with no end time', () => {
    const noEnd = { ...span('2026-11-02', 'Dentist', '09:00', '10:00', 60), end_time: null } as TimeEntry
    const c = findRepeatCandidate([noEnd], 'morning', TODAY)!
    expect(repeatRowsLeft(c, [span(TODAY, 'Gym', '08:00', '11:00', 180)], 'morning')[0].clash).toBeNull()
  })
})

describe('entries built from a partial selection', () => {
  const five = findRepeatCandidate(
    [
      span('2026-11-02', 'A', '06:00', '06:30', 30, 'exercise'),
      span('2026-11-02', 'B', '07:00', '07:30', 30, 'meals'),
      span('2026-11-02', 'C', '08:00', '08:45', 45, 'learning'),
      span('2026-11-02', 'D', '09:00', '10:00', 60, 'deep_work'),
      span('2026-11-02', 'E', '10:00', '11:00', 60, 'admin'),
    ],
    'morning',
    TODAY
  )!

  it('gives only the ticked ones, in candidate order, with the copied times and categories', () => {
    const ids = new Set([five.entries[3].id, five.entries[1].id])
    expect(entriesForRepeat(five, TODAY, ids)).toEqual([
      { date: TODAY, activity: 'B', category: 'meals', duration_minutes: 30, start_time: '07:00', end_time: '07:30' },
      { date: TODAY, activity: 'D', category: 'deep_work', duration_minutes: 60, start_time: '09:00', end_time: '10:00' },
    ])
  })

  it('gives none for an empty selection', () => {
    expect(entriesForRepeat(five, TODAY, new Set())).toEqual([])
  })
})

describe('same name and retiming', () => {
  it('compares names without case or spacing', () => {
    expect(sameActivityName(' Deep   Work', 'deep work')).toBe(true)
    expect(sameActivityName('Deep work', 'Work')).toBe(false)
  })

  it('starts a clashing row after the entry it overlaps, keeping its length', () => {
    const row = { entry: span('2026-11-02', 'Dentist', '09:00', '10:00', 60), clash: span(TODAY, 'Gym', '08:00', '09:45', 105) }
    expect(retimeAfterClash(row, 'morning')).toEqual({ startTime: '09:45', endTime: '10:45' })
  })

  it('offers no times when it would run past midnight', () => {
    const row = { entry: span('2026-11-02', 'Late', '22:00', '23:00', 60), clash: span(TODAY, 'Out', '22:00', '23:30', 90) }
    expect(retimeAfterClash(row, 'evening')).toBeNull()
  })

  it('offers no times when the move would start in the next session', () => {
    const row = { entry: span('2026-11-02', 'Dentist', '11:00', '11:30', 30), clash: span(TODAY, 'Gym', '10:30', '12:15', 105) }
    expect(retimeAfterClash(row, 'morning')).toBeNull()
  })
})
