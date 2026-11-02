/**
 * Date-string shifting tests
 *
 * Regression cover for the UTC round-trip bug: computing a local date and then
 * formatting it with toISOString() shifts the result by a day for users east of
 * UTC, and in the evening for users west of it.
 *
 * Every assertion here must hold in ANY ambient timezone — that is the property
 * the old helpers broke. Jest cannot switch zones mid-run (V8 caches the zone
 * per worker), so `npm run test:tz` re-runs this file with TZ set east of UTC,
 * west of UTC and at the extremes, where the old implementations failed.
 */

import { shiftDateString, getWeekStartForDate, getLocalDateString } from '../types'

const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

describe(`shiftDateString (TZ=${ZONE})`, () => {
  it('moves forward a day', () => {
    expect(shiftDateString('2026-11-01', 1)).toBe('2026-11-02')
  })

  it('moves back a day', () => {
    expect(shiftDateString('2026-11-01', -1)).toBe('2026-10-31')
  })

  it('is a no-op for a zero delta', () => {
    expect(shiftDateString('2026-11-01', 0)).toBe('2026-11-01')
  })

  it('shifts a full week in both directions', () => {
    expect(shiftDateString('2026-06-15', 7)).toBe('2026-06-22')
    expect(shiftDateString('2026-06-15', -7)).toBe('2026-06-08')
    expect(shiftDateString(shiftDateString('2026-06-15', 7), -7)).toBe('2026-06-15')
  })

  it('crosses month and year boundaries', () => {
    expect(shiftDateString('2026-01-31', 1)).toBe('2026-02-01')
    expect(shiftDateString('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDateString('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDateString('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('handles leap days', () => {
    expect(shiftDateString('2028-02-28', 1)).toBe('2028-02-29')
    expect(shiftDateString('2028-03-01', -1)).toBe('2028-02-29')
  })

  it('crosses a spring-forward DST boundary without losing a day', () => {
    // 2026-03-08 in North America, 2026-03-29 in Europe
    expect(shiftDateString('2026-03-07', 1)).toBe('2026-03-08')
    expect(shiftDateString('2026-03-08', 1)).toBe('2026-03-09')
    expect(shiftDateString('2026-03-28', 1)).toBe('2026-03-29')
    expect(shiftDateString('2026-03-29', 1)).toBe('2026-03-30')
  })

  it('crosses a fall-back DST boundary without repeating a day', () => {
    // 2026-11-01 in North America, 2026-10-25 in Europe
    expect(shiftDateString('2026-10-31', 1)).toBe('2026-11-01')
    expect(shiftDateString('2026-11-01', 1)).toBe('2026-11-02')
    expect(shiftDateString('2026-10-24', 1)).toBe('2026-10-25')
    expect(shiftDateString('2026-10-25', 1)).toBe('2026-10-26')
  })

  it('steps through a whole year one day at a time', () => {
    // Catches any zone where a shift silently stalls or skips.
    let date = '2026-01-01'
    let steps = 0
    while (date !== '2027-01-01') {
      date = shiftDateString(date, 1)
      steps++
      if (steps > 400) break
    }
    expect(steps).toBe(365)
  })

  it('agrees with the local calendar for today and its neighbours', () => {
    const today = getLocalDateString()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    expect(shiftDateString(today, -1)).toBe(getLocalDateString(yesterday))
    expect(shiftDateString(today, 1)).toBe(getLocalDateString(tomorrow))
  })
})

describe(`getWeekStartForDate (TZ=${ZONE})`, () => {
  it('returns the Monday of the week by default', () => {
    expect(getWeekStartForDate('2026-11-04')).toBe('2026-11-02') // Wed -> Mon
    expect(getWeekStartForDate('2026-11-02')).toBe('2026-11-02') // Mon -> itself
    expect(getWeekStartForDate('2026-11-08')).toBe('2026-11-02') // Sun -> previous Mon
  })

  it('returns the Sunday of the week when asked', () => {
    expect(getWeekStartForDate('2026-11-04', 0)).toBe('2026-11-01') // Wed -> Sun
    expect(getWeekStartForDate('2026-11-01', 0)).toBe('2026-11-01') // Sun -> itself
    expect(getWeekStartForDate('2026-11-07', 0)).toBe('2026-11-01') // Sat -> Sun
  })

  it('is stable across every hour of the day', () => {
    // The old helper carried the current time-of-day into the result, so late
    // local hours crossed UTC midnight and returned the wrong week start.
    for (let hour = 0; hour < 24; hour++) {
      const wednesday = new Date(2026, 10, 4, hour, 30, 0)
      expect(getWeekStartForDate(getLocalDateString(wednesday))).toBe('2026-11-02')
    }
  })

  it('is idempotent', () => {
    const start = getWeekStartForDate('2026-11-04')
    expect(getWeekStartForDate(start)).toBe(start)
  })

  it('crosses a year boundary', () => {
    expect(getWeekStartForDate('2027-01-01')).toBe('2026-12-28') // Fri -> Mon
  })

  it('groups a full week onto the same start, and the next day onto the next', () => {
    const week = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']
    week.forEach((d) => expect(getWeekStartForDate(d)).toBe('2026-11-02'))
    expect(getWeekStartForDate('2026-11-09')).toBe('2026-11-09')
  })
})
