/**
 * "What your log shows": at most one finding, from a fixed list of three,
 * with five days on each side, both counts stated and never a cause.
 */

import { logFinding, MIN_FINDING_DAYS } from '@/lib/log-findings'
import { windowsForWake } from '@/lib/ideal-day'
import { shiftDateString } from '@/lib/types'
import { minutesToTime, timeToMinutes } from '@/lib/time-utils'
import type { Row } from '@/lib/review-read'

const windows = windowsForWake(null)
const END = '2026-11-15'

function r(date: string, activity: string, category: string, start: string, minutes: number): Row {
  return {
    date,
    activity,
    category,
    start_time: start,
    end_time: minutesToTime(Math.min(24 * 60, timeToMinutes(start) + minutes)),
    duration_minutes: minutes,
  }
}

/**
 * Days that trained before noon and days that trained later, each two days
 * apart so no day follows another, with that day's focused work.
 */
function training(early: number, late: number, earlyFocus: number, lateFocus: number): Row[] {
  const rows: Row[] = []
  let gap = 0
  for (let i = 0; i < early; i++) {
    const d = shiftDateString(END, -(gap += 2))
    rows.push(r(d, 'Run', 'exercise', '07:00', 30), r(d, 'Essay', 'deep_work', '14:30', earlyFocus))
  }
  for (let i = 0; i < late; i++) {
    const d = shiftDateString(END, -(gap += 2))
    rows.push(r(d, 'Run', 'exercise', '18:00', 30), r(d, 'Essay', 'deep_work', '14:30', lateFocus))
  }
  return rows
}

const BANNED = /because|so that|leads? to|causes?|makes|helps|thanks to|%|score/i

it('needs five days on each side', () => {
  expect(MIN_FINDING_DAYS).toBe(5)
  expect(logFinding({ rows: training(5, 4, 190, 60), windows })).toBeNull()
})

it('states both day counts and both figures when five and five differ enough', () => {
  const finding = logFinding({ rows: training(5, 5, 190, 140), windows })
  expect(finding).toEqual({
    id: 'training-early-late',
    sentence:
      'On the 5 days you trained before noon, your focused work came to a median of 3h 10m. On the 5 days you trained later, 2h 20m.',
  })
})

it('says nothing about a small difference', () => {
  expect(logFinding({ rows: training(6, 6, 120, 100), windows })).toBeNull()
})

it('returns one finding when two qualify: the larger relative difference', () => {
  // Training: 3h of focus against 2h 30m (a sixth apart). The longest
  // block: 3h starting inside a focus window (14:30) on the early days, and
  // 1h 40m starting outside (18:30) on the late ones (nearly half apart).
  const rows = training(5, 5, 180, 100).flatMap((row) =>
    row.category === 'deep_work' && row.duration_minutes === 100
      ? [{ ...row, start_time: '18:30', end_time: '20:10' }, r(row.date, 'Notes', 'deep_work', '20:30', 50)]
      : [row]
  )
  const finding = logFinding({ rows, windows })
  expect(finding?.id).toBe('focus-start-in-window')
  expect(finding?.sentence).toBe(
    'On the 5 days your longest focused block started inside your focus window, its median length was 3h. On the 5 days it started outside, 1h 40m.'
  )
})

it('compares the day after a day with friends or family with the day after one without', () => {
  const rows: Row[] = []
  for (let i = 0; i < 12; i++) {
    // Three days apart, so the day after is never also the day before another.
    const d = shiftDateString(END, -3 * i - 1)
    const next = shiftDateString(d, 1)
    if (i < 6) rows.push(r(d, 'Dinner with friends', 'social', '19:00', 90), r(next, 'Essay', 'deep_work', '20:00', 60))
    else rows.push(r(d, 'Email', 'shallow_work', '19:00', 30), r(next, 'Essay', 'deep_work', '20:00', 200))
  }
  const finding = logFinding({ rows, windows })
  expect(finding?.id).toBe('people-then-next-day')
  expect(finding?.sentence).toBe(
    'On the 6 days after a day with friends or family, your focused work came to a median of 1h. After the 6 days without, 3h 20m.'
  )
})

it('never words a finding as a cause, a score or a percentage', () => {
  const findings = [
    logFinding({ rows: training(5, 5, 190, 140), windows }),
    logFinding({ rows: training(9, 7, 60, 200), windows }),
  ]
  for (const finding of findings) {
    expect(finding).not.toBeNull()
    expect(finding!.sentence).not.toMatch(BANNED)
  }
})
