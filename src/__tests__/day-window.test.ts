/**
 * @jest-environment node
 *
 * Which hours the grid draws. The rule it exists to enforce: never make
 * someone scroll past the night to find the day they lived.
 */

import { dayWindow, isWholeDay } from '@/lib/day-window'

const at = (startHour: number, endHour: number) => ({
  startMinutes: startHour * 60,
  endMinutes: endHour * 60,
})

it('frames the day around what is on it', () => {
  expect(dayWindow({ blocks: [at(9, 11), at(14, 15)] })).toEqual({ startHour: 8, endHour: 16 })
})

it('never shows less than a readable span', () => {
  // A single half-hour block would otherwise give a two-hour grid.
  const window = dayWindow({ blocks: [at(9, 9.5)] })
  expect(window.endHour - window.startHour).toBeGreaterThanOrEqual(8)
})

it('keeps the current time inside the frame when it is nearby', () => {
  const window = dayWindow({ blocks: [at(9, 11)], nowMinutes: 13 * 60 })
  expect(window.startHour).toBeLessThanOrEqual(9)
  expect(window.endHour).toBeGreaterThanOrEqual(14)
})

it('does not stretch the day to reach a distant now', () => {
  // Logged 08:30–18:00, and it is 2am. Reaching for the now-line turned
  // that into a 2:00–19:00 grid: the empty night, back again.
  const window = dayWindow({ blocks: [at(8.5, 18)], nowMinutes: 2 * 60 })
  expect(window.startHour).toBeGreaterThanOrEqual(7)
  expect(window.endHour - window.startHour).toBeLessThanOrEqual(12)
})

it('sits around now on an empty day', () => {
  const window = dayWindow({ blocks: [], nowMinutes: 10 * 60 })
  expect(window.startHour).toBeLessThanOrEqual(10)
  expect(window.endHour).toBeGreaterThanOrEqual(11)
})

it('does not run off either end of the day', () => {
  const earlyStart = dayWindow({ blocks: [at(0, 1)] })
  expect(earlyStart.startHour).toBe(0)
  expect(earlyStart.endHour - earlyStart.startHour).toBeGreaterThanOrEqual(8)

  const lateFinish = dayWindow({ blocks: [at(23, 24)] })
  expect(lateFinish.endHour).toBe(24)
  expect(lateFinish.startHour).toBeGreaterThanOrEqual(0)
})

it('opens up to the whole day when the day fills it', () => {
  const window = dayWindow({ blocks: [at(0, 2), at(22, 24)] })
  expect(isWholeDay(window)).toBe(true)
})

it('ignores zero-length blocks', () => {
  expect(dayWindow({ blocks: [at(9, 9), at(14, 15)] }).endHour).toBe(16)
})

it('is stable: the same day always frames the same way', () => {
  const day = [at(7, 8), at(9, 12), at(13, 14)]
  expect(dayWindow({ blocks: day })).toEqual(dayWindow({ blocks: [...day].reverse() }))
})
