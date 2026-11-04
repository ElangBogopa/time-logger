/**
 * @jest-environment node
 *
 * How a single day is reduced to one number for the year grid.
 *
 * /api/year-pixels used to score a day as 20 + entryCount × 10, raised by 10
 * for each session marked done and capped at 100 — so the grid coloured by
 * how diligently the day was logged. Six two-minute entries beat four hours
 * of deep work. It is now how many of Body, Mind and Heart reached their
 * target, which needs no threshold of its own.
 */

import { countMetricsOnTarget, calcBody, calcFocus, calcSocial, METRIC_THRESHOLDS } from '@/lib/metrics-calc'
import type { EntryRow } from '@/lib/metrics-calc'

const entry = (category: string, duration_minutes: number): EntryRow =>
  ({ category, duration_minutes }) as EntryRow

it('counts nothing for an empty day', () => {
  expect(countMetricsOnTarget([])).toBe(0)
})

it('counts a metric once it reaches its target', () => {
  // Four hours of deep work is the Mind target exactly, which scores 80.
  const day = [entry('deep_work', 240)]
  expect(calcFocus(day)).toBeGreaterThanOrEqual(METRIC_THRESHOLDS.green)
  expect(countMetricsOnTarget(day)).toBe(1)
})

it('counts all three on a balanced day', () => {
  const day = [
    entry('deep_work', 240), // Mind
    entry('exercise', 60), // Body
    entry('social', 60), // Heart
  ]
  expect(calcBody(day)).toBeGreaterThanOrEqual(METRIC_THRESHOLDS.green)
  expect(calcFocus(day)).toBeGreaterThanOrEqual(METRIC_THRESHOLDS.green)
  expect(calcSocial(day)).toBeGreaterThanOrEqual(METRIC_THRESHOLDS.green)
  expect(countMetricsOnTarget(day)).toBe(3)
})

it('does not reward a day for having many entries', () => {
  // The old formula gave this day 20 + 8 × 10, capped at 100 — the top of
  // the scale for 16 minutes of nothing in particular.
  const fragmented = Array.from({ length: 8 }, () => entry('admin', 2))
  expect(countMetricsOnTarget(fragmented)).toBe(0)

  // while one long block of real work counts
  expect(countMetricsOnTarget([entry('deep_work', 240)])).toBe(1)
})

it('prefers four hours of deep work to six short errands', () => {
  const deep = [entry('deep_work', 240)]
  const errands = Array.from({ length: 6 }, () => entry('errands', 20))
  expect(countMetricsOnTarget(deep)).toBeGreaterThan(countMetricsOnTarget(errands))
})

it('never exceeds three', () => {
  const huge = [
    entry('deep_work', 900),
    entry('exercise', 300),
    entry('social', 400),
    entry('faith', 200),
  ]
  expect(countMetricsOnTarget(huge)).toBe(3)
})

it('uses the shared green threshold rather than one of its own', () => {
  // A day sitting just under the line counts for nothing; just over, it
  // counts. Whatever the threshold is set to, this holds.
  const justUnder = [entry('social', 25)]
  const over = [entry('social', 70)]
  expect(calcSocial(justUnder)).toBeLessThan(METRIC_THRESHOLDS.green)
  expect(countMetricsOnTarget(justUnder)).toBe(0)
  expect(calcSocial(over)).toBeGreaterThanOrEqual(METRIC_THRESHOLDS.green)
  expect(countMetricsOnTarget(over)).toBe(1)
})
