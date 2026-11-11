/**
 * @jest-environment node
 *
 * Suggesting when to do the things Google Calendar does not hold.
 *
 * The rules that matter are the refusals: never over a meeting, never in
 * the past, never so much that the day has no air in it, and never a
 * suggestion without a reason attached.
 */

import { suggestTimes, rankSlots, defaultDuration } from '@/lib/suggest-times'
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

/**
 * Your own habit outranks the textbook. The suggester proposed the gym at
 * 6am to someone whose log showed a run at 6pm every time: correct by the
 * research and useless to the person.
 */
describe('a usual hour from the log', () => {
  const at = (h: number, m = 0) => h * 60 + m

  it('is proposed ahead of the research window', () => {
    const { suggestions } = suggestTimes({
      tasks: [{ id: 'run', title: 'Run', category: 'exercise' as never, usualStartMinutes: at(18) }],
      busy: [],
    })
    expect(suggestions[0]).toMatchObject({ startTime: '18:00', basis: 'habit' })
  })

  it('quotes the research where it agrees with the habit', () => {
    const { suggestions } = suggestTimes({
      tasks: [{ id: 'run', title: 'Run', category: 'exercise' as never, usualStartMinutes: at(18) }],
      busy: [],
    })
    expect(suggestions[0].reason).toBe(
      'When you usually do this — body temperature peaks — your best window for physical effort'
    )
    expect(suggestions[0].source).toBe('exercise-cognition')
  })

  it('stands on the habit alone where the research has nothing to say', () => {
    const { suggestions } = suggestTimes({
      tasks: [{ id: 'run', title: 'Run', category: 'exercise' as never, usualStartMinutes: at(13) }],
      busy: [],
    })
    expect(suggestions[0]).toMatchObject({
      startTime: '13:00',
      reason: 'When you usually do this',
      source: null,
      basis: 'habit',
    })
  })

  it('takes the nearest free time when the usual hour is taken', () => {
    const { suggestions } = suggestTimes({
      tasks: [{ id: 'run', title: 'Run', category: 'exercise' as never, usualStartMinutes: at(18) }],
      busy: [{ startMinutes: at(17, 30), endMinutes: at(19) }],
    })
    // 19:00 is an hour off the habit; 16:30, the nearest before, is 90 minutes off.
    expect(suggestions[0].startTime).toBe('19:00')
    expect(suggestions[0].reason).toMatch(/^Close to when you usually do this/)
  })

  it('falls back to the research when the habit is out of reach', () => {
    const { suggestions } = suggestTimes({
      tasks: [{ id: 'run', title: 'Run', category: 'exercise' as never, usualStartMinutes: at(18) }],
      busy: [{ startMinutes: at(15), endMinutes: at(22) }],
    })
    expect(suggestions[0]).toMatchObject({ startTime: '06:00', basis: 'research' })
  })

  it('changes nothing for a task with no habit', () => {
    const { suggestions } = suggestTimes({ tasks: [task('a', 'deep_work')], busy: [] })
    expect(suggestions[0]).toMatchObject({ startTime: '09:00', basis: 'research' })
  })
})

describe('how long to plan', () => {
  it.each([
    ['deep_work', 90],
    ['calls', 30],
    ['exercise', 60],
    ['social', 90],
    [null, 60],
  ])('gives %s a block of %i minutes', (category, minutes) => {
    expect(defaultDuration(category as never)).toBe(minutes)
    const { suggestions } = suggestTimes({
      tasks: [{ id: 'a', title: 'A', category: category as never }],
      busy: [],
    })
    expect(suggestions[0].durationMinutes).toBe(minutes)
    expect(suggestions[0].endMinutes - suggestions[0].startMinutes).toBe(minutes)
  })

  it('lets a stated length win', () => {
    const { suggestions } = suggestTimes({
      tasks: [{ id: 'a', title: 'A', category: 'deep_work' as never, durationMinutes: 45 }],
      busy: [],
    })
    expect(suggestions[0].durationMinutes).toBe(45)
  })
})

describe('starting the day when you do', () => {
  it('proposes nothing before the earliest minute it is given', () => {
    // Someone who gets up at seven is not offered the gym at six.
    const { suggestions } = suggestTimes({
      tasks: [task('gym', 'exercise')],
      busy: [],
      earliestMinutes: 7 * 60 + 30,
    })
    expect(suggestions[0].startMinutes).toBeGreaterThanOrEqual(7 * 60 + 30)
  })
})

describe('rankSlots', () => {
  it('offers different answers, not the same one a quarter of an hour later', () => {
    const slots = rankSlots({ duration: 60, category: 'exercise' as never, taken: [] })
    expect(slots.length).toBeGreaterThan(1)
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        expect(Math.abs(slots[i].start - slots[j].start)).toBeGreaterThanOrEqual(90)
      }
    }
  })

  it('puts the best first', () => {
    const slots = rankSlots({ duration: 60, category: 'exercise' as never, usualStartMinutes: 18 * 60, taken: [] })
    expect(slots[0].start).toBe(18 * 60)
    expect(slots.every((slot, i) => i === 0 || slot.score <= slots[i - 1].score)).toBe(true)
  })

  it('never offers anything on top of what is taken', () => {
    const taken = [{ startMinutes: 9 * 60, endMinutes: 17 * 60 }]
    for (const slot of rankSlots({ duration: 60, category: 'deep_work' as never, taken })) {
      expect(slot.start + 60 <= 9 * 60 || slot.start >= 17 * 60).toBe(true)
    }
  })

  it('returns nothing when there is no room', () => {
    expect(rankSlots({ duration: 60, category: null, taken: [{ startMinutes: 0, endMinutes: 1440 }] })).toEqual([])
  })
})
