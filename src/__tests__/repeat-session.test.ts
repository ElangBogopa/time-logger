/**
 * @jest-environment node
 *
 * Choosing the day a session repeats from, and moving its entries to today.
 */

import { findRepeatCandidate, entriesForRepeat, describeDay } from '@/lib/repeat-session'
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

  it('keeps the times, the durations and the categories', () => {
    const copied = entriesForRepeat(candidate, TODAY)

    expect(copied).toEqual([
      { date: TODAY, activity: 'Work', category: 'deep_work', duration_minutes: 240, start_time: '09:00', end_time: '09:00' },
      { date: TODAY, activity: 'Emails', category: 'deep_work', duration_minutes: 30, start_time: '11:00', end_time: '11:00' },
    ])
  })

  it('carries the category across, so a repeat costs no model calls', () => {
    expect(entriesForRepeat(candidate, TODAY).every((e) => e.category !== null)).toBe(true)
  })
})
