/**
 * @jest-environment node
 *
 * How much of what you did landed in the hours that suit it. Reported as
 * time, never as a score.
 */

import { windowAlignment, alignmentShare, type AlignmentEntry } from '@/lib/window-alignment'
import { windowsForWake } from '@/lib/ideal-day'
import type { TimeCategory } from '@/lib/types'

const entry = (category: TimeCategory | null, start: string | null, end: string | null, minutes = 60): AlignmentEntry => ({
  category,
  start_time: start,
  end_time: end,
  duration_minutes: minutes,
})

const reference = windowsForWake(null) // peak focus 9–12, second wind 14–16, physical peak 17–19, people 19–21
const fact = (entries: AlignmentEntry[], key: string, windows = reference) =>
  windowAlignment(entries, windows).find((f) => f.key === key)

it('counts work done inside the focus windows', () => {
  expect(fact([entry('deep_work', '09:00', '11:00')], 'focus')).toMatchObject({
    totalMinutes: 120,
    inWindowMinutes: 120,
  })
})

it('counts only the part of an entry that overlaps a window', () => {
  // 8:00–10:00: the second hour is in peak focus, the first is before it.
  expect(fact([entry('deep_work', '08:00', '10:00')], 'focus')).toMatchObject({
    totalMinutes: 120,
    inWindowMinutes: 60,
  })
})

it('adds up across windows and entries', () => {
  const entries = [
    entry('deep_work', '09:00', '10:00'), // in
    entry('deep_work', '14:00', '15:00'), // in, second wind
    entry('creating', '20:00', '22:00'), // out
  ]
  expect(fact(entries, 'focus')).toMatchObject({ totalMinutes: 240, inWindowMinutes: 120 })
})

it('judges each kind of activity against its own windows', () => {
  // Learning has its own hour, 16–17: nine in the morning is not it.
  expect(fact([entry('learning', '09:00', '10:00')], 'focus')).toMatchObject({ inWindowMinutes: 0 })
  expect(fact([entry('learning', '16:00', '17:00')], 'focus')).toMatchObject({ inWindowMinutes: 60 })
})

it('reports exercise and time with people separately', () => {
  const facts = windowAlignment(
    [entry('exercise', '18:00', '19:00'), entry('social', '13:00', '14:00'), entry('calls', '20:00', '20:30')],
    reference
  )
  expect(facts.map((f) => [f.key, f.totalMinutes, f.inWindowMinutes])).toEqual([
    ['movement', 60, 60],
    ['people', 90, 30],
  ])
})

it('leaves out what was not done, and what the windows are not about', () => {
  const facts = windowAlignment(
    [entry('sleep', '00:00', '07:00'), entry('meals', '12:30', '13:00'), entry('meetings', '14:00', '15:00')],
    reference
  )
  expect(facts).toEqual([])
})

it('uses the windows of the person, not the reference day', () => {
  const owl = windowsForWake(9 * 60) // peak focus 11:30–14:30
  const morning = [entry('deep_work', '09:00', '11:00')]
  expect(fact(morning, 'focus')).toMatchObject({ inWindowMinutes: 120 })
  expect(fact(morning, 'focus', owl)).toMatchObject({ inWindowMinutes: 0 })
})

it('does not double-count where two suited windows overlap', () => {
  // A call at 12:30 for someone whose shifted day overlaps: still thirty minutes, once.
  const facts = windowAlignment([entry('calls', '19:00', '20:00'), entry('calls', '19:30', '20:00')], reference)
  expect(facts[0]).toMatchObject({ totalMinutes: 90, inWindowMinutes: 90 })
})

it('ignores entries with no time or no category', () => {
  expect(windowAlignment([entry('deep_work', null, null), entry(null, '09:00', '10:00')], reference)).toEqual([])
})

it('falls back to the duration when an entry has no end', () => {
  expect(fact([entry('deep_work', '09:00', null, 90)], 'focus')).toMatchObject({ totalMinutes: 90, inWindowMinutes: 90 })
})

it('gives a share for a sentence that needs one number', () => {
  expect(alignmentShare({ totalMinutes: 210, inWindowMinutes: 150 })).toBe(71)
  expect(alignmentShare({ totalMinutes: 0, inWindowMinutes: 0 })).toBe(0)
})
