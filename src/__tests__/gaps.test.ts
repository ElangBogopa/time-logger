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

it('says nothing when the session is empty', () => {
  // An empty session is not a gap — "same as yesterday" and the add button
  // are the answer there.
  expect(findUnaccountedGaps({ entries: [], ...AFTERNOON, nowMinutes: 17 * 60 })).toEqual([])
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
