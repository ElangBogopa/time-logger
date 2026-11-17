/**
 * @jest-environment node
 *
 * Entries across midnight: which day a one-piece overnight row belongs to,
 * the part of it on its own date, the part that spills into the neighbour,
 * and what a save writes.
 */

import {
  crossesMidnight,
  overnightPlacement,
  overnightDuration,
  normalizeMidnightEnd,
  onDayTimes,
  splitAtMidnight,
  coveredOn,
  planOvernightSave,
} from '@/lib/overnight'

describe('crossesMidnight', () => {
  it('is true when the end is earlier than the start', () => {
    expect(crossesMidnight('23:00', '07:00')).toBe(true)
    expect(crossesMidnight('23:00:00', '07:00:00')).toBe(true)
  })

  it('is false for an end exactly at midnight', () => {
    expect(crossesMidnight('23:00', '00:00')).toBe(false)
    expect(crossesMidnight('23:00', '24:00')).toBe(false)
    expect(crossesMidnight('23:00:00', '00:00:00')).toBe(false)
  })

  it('is false inside one day or with a time missing', () => {
    expect(crossesMidnight('09:00', '10:00')).toBe(false)
    expect(crossesMidnight('09:00', null)).toBe(false)
    expect(crossesMidnight(null, '07:00')).toBe(false)
  })
})

describe('overnightPlacement', () => {
  it('puts an ordinary night on the wake-up day', () => {
    expect(overnightPlacement('23:00', '07:00')).toBe('wake-day')
  })

  it('puts a night mostly before midnight on the day it began', () => {
    expect(overnightPlacement('18:00', '01:00')).toBe('start-day')
  })

  it('gives a tie to the wake-up day', () => {
    expect(overnightPlacement('20:00', '04:00')).toBe('wake-day')
  })
})

describe('overnightDuration and normalizeMidnightEnd', () => {
  it('counts across midnight', () => {
    expect(overnightDuration('23:00', '07:00')).toBe(480)
  })

  it('stores a typed 00:00 end as 24:00', () => {
    expect(normalizeMidnightEnd('23:00', '00:00')).toBe('24:00')
    expect(normalizeMidnightEnd('23:00', '00:00:00')).toBe('24:00')
    expect(normalizeMidnightEnd('00:00', '00:00')).toBe('00:00')
    expect(normalizeMidnightEnd('09:00', '10:00')).toBe('10:00')
    expect(normalizeMidnightEnd(null, '00:00')).toBe('00:00')
  })
})

describe('onDayTimes', () => {
  it('is null without a start', () => {
    expect(onDayTimes({ start_time: null, end_time: '07:00' })).toBeNull()
  })

  it('is the entry\'s own times inside one day', () => {
    expect(onDayTimes({ start_time: '09:00:00', end_time: '10:30:00' })).toEqual({ start: '09:00', end: '10:30' })
    expect(onDayTimes({ start_time: '09:00', end_time: null })).toEqual({ start: '09:00', end: null })
  })

  it('does not treat 23:00–00:00 or 23:00–24:00 as crossing', () => {
    expect(onDayTimes({ start_time: '23:00', end_time: '00:00' })).toEqual({ start: '23:00', end: '00:00' })
    expect(onDayTimes({ start_time: '23:00', end_time: '24:00' })).toEqual({ start: '23:00', end: '24:00' })
  })

  it('is the morning for a wake-day night', () => {
    expect(onDayTimes({ start_time: '23:00', end_time: '07:00' })).toEqual({ start: '00:00', end: '07:00' })
    expect(onDayTimes({ start_time: '20:00', end_time: '04:00' })).toEqual({ start: '00:00', end: '04:00' })
  })

  it('is the evening for a start-day night', () => {
    expect(onDayTimes({ start_time: '18:00', end_time: '01:00' })).toEqual({ start: '18:00', end: '24:00' })
  })
})

describe('splitAtMidnight', () => {
  it('splits Monday 23:00–01:00 into Monday and Tuesday', () => {
    expect(splitAtMidnight('2026-11-16', '23:00', '01:00')).toEqual([
      { date: '2026-11-16', start_time: '23:00', end_time: '24:00', duration_minutes: 60 },
      { date: '2026-11-17', start_time: '00:00', end_time: '01:00', duration_minutes: 60 },
    ])
  })

  it('carries a month end into the next month', () => {
    const [, second] = splitAtMidnight('2026-11-30', '22:00', '02:00')
    expect(second.date).toBe('2026-12-01')
    const [, newYear] = splitAtMidnight('2026-12-31', '22:00', '02:00')
    expect(newYear.date).toBe('2027-01-01')
  })
})

describe('coveredOn', () => {
  const row = (id: string, date: string, start: string, end: string) => ({
    id,
    date,
    activity: 'Sleep',
    category: 'sleep' as const,
    start_time: start,
    end_time: end,
  })

  it('shows Monday 23:00–24:00 for a Tuesday 23:00–07:00 sleep', () => {
    const blocks = coveredOn('2026-11-16', [row('a', '2026-11-17', '23:00', '07:00')])
    expect(blocks).toEqual([
      {
        entryId: 'a',
        activity: 'Sleep',
        category: 'sleep',
        startTime: '23:00',
        endTime: '24:00',
        homeDate: '2026-11-17',
      },
    ])
  })

  it('shows Tuesday 00:00–01:00 for a Monday 18:00–01:00 sleep', () => {
    const blocks = coveredOn('2026-11-17', [row('b', '2026-11-16', '18:00', '01:00')])
    expect(blocks).toEqual([
      expect.objectContaining({ entryId: 'b', startTime: '00:00', endTime: '01:00', homeDate: '2026-11-16' }),
    ])
  })

  it('gives nothing for the entry\'s own date', () => {
    expect(coveredOn('2026-11-17', [row('a', '2026-11-17', '23:00', '07:00')])).toEqual([])
    expect(coveredOn('2026-11-16', [row('b', '2026-11-16', '18:00', '01:00')])).toEqual([])
  })

  it('gives nothing for the wrong neighbour or a row inside one day', () => {
    // A wake-day night dated yesterday spills into the day before it, not today.
    expect(coveredOn('2026-11-17', [row('a', '2026-11-16', '23:00', '07:00')])).toEqual([])
    expect(coveredOn('2026-11-16', [row('c', '2026-11-17', '09:00', '10:00')])).toEqual([])
  })

  it('crosses a month end', () => {
    const blocks = coveredOn('2026-11-30', [row('a', '2026-12-01', '23:00', '07:00')])
    expect(blocks).toHaveLength(1)
  })
})

describe('planOvernightSave', () => {
  const base = {
    date: '2026-11-16',
    activity: 'Dinner',
    category: 'meals',
    duration_minutes: 120,
  }

  it('leaves an entry inside one day as it is', () => {
    const row = { ...base, start_time: '18:00', end_time: '19:00', duration_minutes: 60 }
    expect(planOvernightSave(row, false)).toEqual([row])
  })

  it('stores a midnight end as 24:00 without splitting', () => {
    const row = { ...base, start_time: '23:00', end_time: '00:00', duration_minutes: 60 }
    expect(planOvernightSave(row, false)).toEqual([{ ...row, end_time: '24:00' }])
  })

  it('keeps a sleep as one row with its real duration', () => {
    const row = { ...base, activity: 'Sleep', category: 'sleep', start_time: '23:00', end_time: '07:00', duration_minutes: 0 }
    expect(planOvernightSave(row, true)).toEqual([{ ...row, duration_minutes: 480 }])
  })

  it('splits anything else into two pieces carrying the other fields', () => {
    const row = { ...base, start_time: '23:00', end_time: '01:00' }
    expect(planOvernightSave(row, false)).toEqual([
      { ...base, start_time: '23:00', end_time: '24:00', duration_minutes: 60 },
      { ...base, date: '2026-11-17', start_time: '00:00', end_time: '01:00', duration_minutes: 60 },
    ])
  })

  it('keeps the morning on a row dated its wake day, and puts the evening on the day before', () => {
    const row = { ...base, date: '2026-11-17', start_time: '23:00', end_time: '06:30' }
    expect(planOvernightSave(row, false, { dateIsWakeDay: true })).toEqual([
      { ...base, date: '2026-11-17', start_time: '00:00', end_time: '06:30', duration_minutes: 390 },
      { ...base, date: '2026-11-16', start_time: '23:00', end_time: '24:00', duration_minutes: 60 },
    ])
  })

  it('crosses a month start backwards', () => {
    const row = { ...base, date: '2026-12-01', start_time: '23:00', end_time: '06:30' }
    const [, evening] = planOvernightSave(row, false, { dateIsWakeDay: true })
    expect(evening.date).toBe('2026-11-30')
  })
})
