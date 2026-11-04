/**
 * @jest-environment node
 *
 * Suggesting when to do the things Google Calendar does not hold.
 *
 * The rules that matter are the refusals: never over a meeting, never in
 * the past, never so much that the day has no air in it, and never a
 * suggestion without a reason attached.
 */

import { suggestTimes } from '@/lib/suggest-times'
import { LIBRARY } from '@/lib/library'

const busy = (startHour: number, endHour: number) => ({
  startMinutes: startHour * 60,
  endMinutes: endHour * 60,
})

const task = (id: string, category: string | null, durationMinutes = 60) => ({
  id,
  title: id,
  category: category as never,
  durationMinutes,
})

it('puts deep work in the morning peak', () => {
  const { suggestions } = suggestTimes({ tasks: [task('Write the memo', 'deep_work')], busy: [] })

  expect(suggestions).toHaveLength(1)
  expect(suggestions[0].startTime).toBe('09:00')
  expect(suggestions[0].reason).toMatch(/peak cognitive/i)
})

it('puts admin in the post-lunch dip rather than the morning', () => {
  const { suggestions } = suggestTimes({ tasks: [task('Expenses', 'admin')], busy: [] })
  const hour = suggestions[0].startMinutes / 60
  expect(hour).toBeGreaterThanOrEqual(8)
  expect(hour).toBeLessThan(14)
})

it('puts exercise where body temperature peaks when the morning is gone', () => {
  const { suggestions } = suggestTimes({
    tasks: [task('Gym', 'exercise')],
    busy: [busy(6, 12)],
  })
  expect(suggestions[0].startMinutes / 60).toBeGreaterThanOrEqual(17)
})

it('never schedules over anything already in the day', () => {
  // The 9–12 meeting is Google's; deep work has to go somewhere else.
  const { suggestions } = suggestTimes({
    tasks: [task('Write the memo', 'deep_work')],
    busy: [busy(9, 12)],
  })

  expect(suggestions[0].startMinutes).toBeGreaterThanOrEqual(12 * 60)
})

it('never schedules in the past', () => {
  const { suggestions } = suggestTimes({
    tasks: [task('Write the memo', 'deep_work')],
    busy: [],
    nowMinutes: 15 * 60,
  })

  expect(suggestions[0].startMinutes).toBeGreaterThanOrEqual(15 * 60)
})

it('does not stack two suggestions on the same hour', () => {
  const { suggestions } = suggestTimes({
    tasks: [task('Memo', 'deep_work'), task('Spec', 'deep_work')],
    busy: [],
  })

  expect(suggestions).toHaveLength(2)
  expect(suggestions[0].endMinutes).toBeLessThanOrEqual(suggestions[1].startMinutes)
})

it('leaves the day some air rather than filling every gap', () => {
  // Eight hours of tasks into an empty day: it should decline most of it.
  const tasks = Array.from({ length: 8 }, (_, i) => task(`Task ${i}`, 'deep_work'))
  const { suggestions, unplaced } = suggestTimes({ tasks, busy: [] })

  const scheduled = suggestions.reduce((sum, s) => sum + (s.endMinutes - s.startMinutes), 0)
  expect(scheduled).toBeLessThanOrEqual(4 * 60)
  expect(unplaced.length).toBeGreaterThan(0)
  expect(unplaced[0].reason).toMatch(/room/i)
})

it('says so when a day has no window long enough', () => {
  const { suggestions, unplaced } = suggestTimes({
    tasks: [task('Deep session', 'deep_work', 120)],
    busy: [busy(6, 21)],
  })

  expect(suggestions).toHaveLength(0)
  expect(unplaced[0].reason).toMatch(/no free window/i)
})

it('gives the longest task the pick of the day', () => {
  // Placed shortest-first, the 2h block would find nowhere to go.
  const { suggestions, unplaced } = suggestTimes({
    tasks: [task('Quick call', 'calls', 30), task('Deep session', 'deep_work', 120)],
    busy: [busy(6, 9), busy(11, 24)],
  })

  expect(unplaced).toHaveLength(1)
  expect(suggestions[0].title).toBe('Deep session')
})

it('attaches a source that exists in the library', () => {
  const { suggestions } = suggestTimes({
    tasks: [task('Write the memo', 'deep_work'), task('Gym', 'exercise')],
    busy: [],
  })

  const ids = LIBRARY.map((entry) => entry.id)
  for (const suggestion of suggestions) {
    expect(suggestion.reason.length).toBeGreaterThan(10)
    if (suggestion.source) expect(ids).toContain(suggestion.source)
  }
})

it('still places a task the rules have no opinion about', () => {
  const { suggestions } = suggestTimes({ tasks: [task('Something else', null)], busy: [] })

  expect(suggestions).toHaveLength(1)
  expect(suggestions[0].reason).toMatch(/clear window/i)
})

it('keeps everything inside waking hours', () => {
  const { suggestions } = suggestTimes({
    tasks: [task('Late thing', 'deep_work')],
    busy: [busy(6, 21)],
    latestMinutes: 23 * 60,
  })

  for (const suggestion of suggestions) {
    expect(suggestion.startMinutes).toBeGreaterThanOrEqual(6 * 60)
    expect(suggestion.endMinutes).toBeLessThanOrEqual(23 * 60)
  }
})
