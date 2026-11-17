/**
 * @jest-environment node
 *
 * Which stretches of a session get offered back as "unaccounted".
 *
 * The rules that matter are the ones about what NOT to ask: never about
 * being asleep before the first thing you logged, never about time that has
 * not happened yet, and never about a stretch a calendar event already
 * covers.
 */

import { findUnaccountedGaps } from '@/lib/gaps'
import type { TimeEntry } from '@/lib/types'

const entry = (start: string, end: string): TimeEntry =>
  ({
    id: `${start}-${end}`,
    date: '2026-11-04',
    activity: 'Work',
    category: 'deep_work',
    start_time: start,
    end_time: end,
    duration_minutes: 60,
    status: 'confirmed',
  }) as TimeEntry

const AFTERNOON = { periodStart: 12, periodEnd: 18 }
const MORNING = { periodStart: 0, periodEnd: 12 }

it('offers the stretch between two entries', () => {
  // now == the end of the second entry, so the only question is the middle
  const gaps = findUnaccountedGaps({
    entries: [entry('12:00', '13:00'), entry('15:30', '16:00')],
    ...AFTERNOON,
    nowMinutes: 16 * 60,
  })

  expect(gaps).toEqual([{ startTime: '13:00', endTime: '15:30', durationMinutes: 150 }])
})

it('never asks about the hours before the first thing logged', () => {
  // The morning session starts at midnight. Asking someone to account for
  // 00:00–08:30 is asking them to account for being asleep.
  const gaps = findUnaccountedGaps({
    entries: [entry('08:30', '09:00'), entry('10:00', '11:00')],
    ...MORNING,
    nowMinutes: 11 * 60,
  })

  expect(gaps).toEqual([{ startTime: '09:00', endTime: '10:00', durationMinutes: 60 }])
})

it('asks about the time since the last entry, up to now', () => {
  const gaps = findUnaccountedGaps({
    entries: [entry('12:00', '13:00')],
    ...AFTERNOON,
    nowMinutes: 15 * 60 + 30,
  })

  expect(gaps).toEqual([{ startTime: '13:00', endTime: '15:30', durationMinutes: 150 }])
})

it('never asks about time that has not happened', () => {
  const gaps = findUnaccountedGaps({
    entries: [entry('12:00', '13:00')],
    ...AFTERNOON,
    nowMinutes: 13 * 60 + 10,
  })

  expect(gaps).toEqual([])
})

it('runs to the end of the session on a finished day', () => {
  const gaps = findUnaccountedGaps({ entries: [entry('12:00', '13:00')], ...AFTERNOON })

  expect(gaps).toEqual([{ startTime: '13:00', endTime: '18:00', durationMinutes: 300 }])
})

it('treats a calendar event as accounted for', () => {
  // Confirming calendar events is its own flow; a gap row over the top of
  // one would be two affordances for the same half hour.
  const gaps = findUnaccountedGaps({
    entries: [entry('12:00', '13:00')],
    events: [{ startTime: '13:00', endTime: '17:00' }],
    ...AFTERNOON,
    nowMinutes: 17 * 60,
  })

  expect(gaps).toEqual([])
})

it('says nothing when the Morning is empty', () => {
  // An empty Morning is not a gap — nobody is asked about being asleep.
  expect(findUnaccountedGaps({ entries: [], ...MORNING, nowMinutes: 11 * 60 })).toEqual([])
})

it('ignores anything shorter than the minimum', () => {
  const entries = [entry('12:00', '13:00'), entry('13:20', '14:00')]
  expect(findUnaccountedGaps({ entries, ...AFTERNOON, nowMinutes: 14 * 60 })).toEqual([])
  expect(
    findUnaccountedGaps({ entries, ...AFTERNOON, nowMinutes: 14 * 60, minimumMinutes: 15 })
  ).toEqual([{ startTime: '13:00', endTime: '13:20', durationMinutes: 20 }])
})

it('copes with overlapping and unordered entries', () => {
  const gaps = findUnaccountedGaps({
    entries: [entry('14:00', '15:00'), entry('12:00', '13:30'), entry('12:30', '14:00')],
    ...AFTERNOON,
    nowMinutes: 15 * 60,
  })

  expect(gaps).toEqual([])
})

it('uses an entry duration when it has no end time', () => {
  const untimed = { ...entry('12:00', '13:00'), end_time: null, duration_minutes: 90 } as TimeEntry
  const gaps = findUnaccountedGaps({ entries: [untimed], ...AFTERNOON, nowMinutes: 16 * 60 })

  expect(gaps).toEqual([{ startTime: '13:30', endTime: '16:00', durationMinutes: 150 }])
})

it('clips entries that run past the session', () => {
  // A block from 11:00 to 14:00 only accounts for the afternoon from 12.
  const gaps = findUnaccountedGaps({
    entries: [entry('11:00', '14:00')],
    ...AFTERNOON,
    nowMinutes: 15 * 60,
  })

  expect(gaps).toEqual([{ startTime: '14:00', endTime: '15:00', durationMinutes: 60 }])
})

describe('from the session start (Afternoon and Evening)', () => {
  const EVENING = { periodStart: 18, periodEnd: 24 }
  const from = { fromSessionStart: true }
  const g = (a: string, b: string, d: number) => ({ startTime: a, endTime: b, durationMinutes: d })

  it('offers the time before the first entry', () => {
    expect(
      findUnaccountedGaps({ entries: [entry('14:00', '15:00')], ...AFTERNOON, ...from, nowMinutes: 15 * 60 })
    ).toEqual([g('12:00', '14:00', 120)])
  })

  it('offers an empty Afternoon from 12:00 to now', () => {
    expect(
      findUnaccountedGaps({ entries: [], ...AFTERNOON, ...from, nowMinutes: 15 * 60 + 30 })
    ).toEqual([g('12:00', '15:30', 210)])
  })

  it('offers an empty Afternoon of a finished day whole', () => {
    expect(findUnaccountedGaps({ entries: [], ...AFTERNOON, ...from })).toEqual([g('12:00', '18:00', 360)])
  })

  it('says nothing under the minimum or before the session', () => {
    expect(findUnaccountedGaps({ entries: [], ...AFTERNOON, ...from, nowMinutes: 12 * 60 + 20 })).toEqual([])
    expect(findUnaccountedGaps({ entries: [], ...AFTERNOON, ...from, nowMinutes: 11 * 60 })).toEqual([])
    expect(
      findUnaccountedGaps({ entries: [entry('12:10', '15:00')], ...AFTERNOON, ...from, nowMinutes: 15 * 60 })
    ).toEqual([])
  })

  it('offers the Evening around an entry', () => {
    expect(
      findUnaccountedGaps({ entries: [entry('19:00', '20:00')], ...EVENING, ...from, nowMinutes: 21 * 60 })
    ).toEqual([g('18:00', '19:00', 60), g('20:00', '21:00', 60)])
  })

  it('offers an empty Evening of a finished day whole', () => {
    expect(findUnaccountedGaps({ entries: [], ...EVENING, ...from })).toEqual([g('18:00', '24:00', 360)])
  })

  it('does not ask about an entry that started in the previous session', () => {
    expect(
      findUnaccountedGaps({ entries: [entry('11:30', '12:45')], ...AFTERNOON, ...from, nowMinutes: 15 * 60 })
    ).toEqual([g('12:45', '15:00', 135)])
    expect(
      findUnaccountedGaps({ entries: [entry('17:15', '18:40')], ...EVENING, ...from, nowMinutes: 20 * 60 })
    ).toEqual([g('18:40', '20:00', 80)])
  })

  it('counts an event only for its own time', () => {
    expect(
      findUnaccountedGaps({
        entries: [entry('14:00', '15:00')],
        events: [{ startTime: '11:30', endTime: '12:30' }],
        ...AFTERNOON,
        ...from,
        nowMinutes: 15 * 60,
      })
    ).toEqual([g('12:30', '14:00', 90)])
  })

  it('treats an entry that runs past midnight as running to 24:00', () => {
    expect(findUnaccountedGaps({ entries: [entry('22:00', '00:00')], ...EVENING, ...from })).toEqual([
      g('18:00', '22:00', 240),
    ])
    expect(findUnaccountedGaps({ entries: [entry('23:00', '01:00')], ...EVENING, ...from })).toEqual([
      g('18:00', '23:00', 300),
    ])
  })

  it('leaves the Morning as it was', () => {
    expect(
      findUnaccountedGaps({ entries: [entry('08:30', '09:00')], ...MORNING, nowMinutes: 11 * 60 })
    ).toEqual([g('09:00', '11:00', 120)])
    expect(findUnaccountedGaps({ entries: [], ...MORNING, nowMinutes: 11 * 60 })).toEqual([])
  })
})
