/**
 * @jest-environment node
 *
 * Next up. The plan and the calendar, arranged around the clock, so Today
 * can say what is next and ask about what has passed.
 */

import { buildNextUp, nowLineIndex } from '@/lib/next-up'
import type { PlanRow } from '@/lib/plan-adherence'

const plan = (title: string, start: string | null, end: string | null, completed = false): PlanRow => ({
  id: title,
  title,
  completed,
  committed_start: start,
  committed_end: end,
})

const entry = (activity: string, start: string, end: string) => ({
  activity,
  start_time: start,
  end_time: end,
  duration_minutes: 60,
})

const event = (title: string, startTime: string, endTime: string) => ({ id: title, title, startTime, endTime })

const states = (result: ReturnType<typeof buildNextUp>) => result.items.map((i) => [i.title, i.state])

const AT = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

it('puts the day in time order, plans and calendar together', () => {
  const result = buildNextUp({
    plans: [plan('Call home', '20:00', '20:30'), plan('Run', '18:00', '19:00')],
    entries: [],
    events: [event('Pricing review', '14:00', '15:00')],
    nowMinutes: AT('08:00'),
  })
  expect(result.items.map((i) => i.title)).toEqual(['Pricing review', 'Run', 'Call home'])
})

it('lists the fixed thing first when a plan starts at the same minute', () => {
  const result = buildNextUp({
    plans: [plan('Deep work', '09:30', '10:30')],
    entries: [],
    events: [event('Standup', '09:30', '09:45')],
    nowMinutes: AT('08:00'),
  })
  expect(result.items.map((i) => i.kind)).toEqual(['event', 'plan'])
})

it('reads each item off the clock', () => {
  const result = buildNextUp({
    plans: [plan('Write', '09:00', '10:00'), plan('Run', '18:00', '19:00'), plan('Call home', '20:00', '20:30')],
    entries: [],
    nowMinutes: AT('18:30'),
  })
  expect(states(result)).toEqual([
    ['Write', 'due'],
    ['Run', 'now'],
    ['Call home', 'upcoming'],
  ])
  expect(result.dueCount).toBe(1)
})

it('marks a plan done when the log shows it, with no tick needed', () => {
  const result = buildNextUp({
    plans: [plan('Run', '18:00', '19:00')],
    entries: [entry('Ran 5k', '18:00', '19:00')],
    nowMinutes: AT('21:00'),
  })
  expect(result.items[0]).toMatchObject({ state: 'done', outcome: 'kept' })
  expect(result.dueCount).toBe(0)
})

it('marks a plan done when it was done early, before its hour comes', () => {
  const result = buildNextUp({
    plans: [plan('Run', '18:00', '19:00')],
    entries: [entry('Ran 5k', '07:00', '08:00')],
    nowMinutes: AT('12:00'),
  })
  expect(result.items[0]).toMatchObject({ state: 'done', outcome: 'moved' })
})

it('says what took the hour when a plan is due and something else was logged', () => {
  const result = buildNextUp({
    plans: [plan('Run', '18:00', '19:00')],
    entries: [entry('Emails', '18:00', '19:00')],
    nowMinutes: AT('21:00'),
  })
  expect(result.items[0]).toMatchObject({ state: 'due', loggedActivity: 'Emails' })
})

it('leaves out a calendar event that an entry already covers', () => {
  const result = buildNextUp({
    plans: [],
    entries: [entry('Pricing review', '14:00', '15:00')],
    events: [event('Pricing review', '14:00', '15:00'), event('Standup', '09:30', '09:45')],
    nowMinutes: AT('16:00'),
  })
  expect(states(result)).toEqual([['Standup', 'due']])
})

it('sets a skipped item aside, but only once its hour has passed', () => {
  const plans = [plan('Write', '09:00', '10:00'), plan('Run', '18:00', '19:00')]
  const result = buildNextUp({
    plans,
    entries: [],
    nowMinutes: AT('12:00'),
    skipped: ['plan-Write', 'plan-Run'],
  })
  // A skip is an answer to "what became of this?" — there is no such
  // question about something that has not happened yet.
  expect(states(result)).toEqual([
    ['Write', 'skipped'],
    ['Run', 'upcoming'],
  ])
  expect(result.dueCount).toBe(0)
})

it('lets doing a skipped plan after all count', () => {
  const result = buildNextUp({
    plans: [plan('Run', '18:00', '19:00')],
    entries: [entry('Ran 5k', '18:00', '19:00')],
    nowMinutes: AT('21:00'),
    skipped: ['plan-Run'],
  })
  expect(result.items[0].state).toBe('done')
})

it('treats a finished day as having nothing upcoming', () => {
  const result = buildNextUp({
    plans: [plan('Run', '18:00', '19:00')],
    entries: [],
    events: [event('Standup', '09:30', '09:45')],
    nowMinutes: null,
  })
  expect(states(result)).toEqual([
    ['Standup', 'due'],
    ['Run', 'due'],
  ])
})

it('treats a day that has not begun as all upcoming', () => {
  const result = buildNextUp({
    plans: [plan('Run', '18:00', '19:00')],
    entries: [],
    events: [event('Standup', '09:30', '09:45')],
    nowMinutes: 0,
  })
  expect(result.items.every((i) => i.state === 'upcoming')).toBe(true)
})

it('keeps tasks without a time apart, and drops the ones already done', () => {
  const result = buildNextUp({
    plans: [plan('Buy stamps', null, null), plan('Renew passport', null, null, true), plan('Run', '18:00', '19:00')],
    entries: [],
    nowMinutes: AT('08:00'),
  })
  expect(result.untimed.map((p) => p.title)).toEqual(['Buy stamps'])
  expect(result.items.map((i) => i.title)).toEqual(['Run'])
})

describe('nowLineIndex', () => {
  const items = buildNextUp({
    plans: [plan('Write', '09:00', '10:00'), plan('Run', '18:00', '19:00')],
    entries: [],
    nowMinutes: AT('12:00'),
  }).items

  it('sits before the first thing that has not started', () => {
    expect(nowLineIndex(items, AT('12:00'))).toBe(1)
  })

  it('sits at the top before anything has started, and at the end after everything has', () => {
    expect(nowLineIndex(items, AT('06:00'))).toBe(0)
    expect(nowLineIndex(items, AT('22:00'))).toBe(2)
  })

  it('is absent on a day that is not today, and on an empty list', () => {
    expect(nowLineIndex(items, null)).toBeNull()
    expect(nowLineIndex([], AT('12:00'))).toBeNull()
  })
})
